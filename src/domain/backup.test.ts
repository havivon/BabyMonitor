import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  csvCell,
  feedingsToCsv,
  measurementsToCsv,
  parseBackup,
  parseRecord,
  serializeBackup,
  validateBackupData,
  type BackupData,
} from './backup';
import { startTimer } from './timer';
import { DEFAULT_SETTINGS } from './types';
import { bottle, breast, local, measurement, solid } from '../test/helpers';

const NOW = local(2026, 10, 5, 12);

function sampleData(): BackupData {
  return {
    babies: [
      {
        id: 'baby1',
        name: 'נועה',
        birthDate: '2026-06-01',
        sex: 'female',
        birthWeightG: 3200,
        createdAt: NOW,
      },
    ],
    entries: [
      breast(
        local(2026, 10, 5, 6),
        [
          ['left', 10],
          ['right', 7],
        ],
        { id: 'e1', note: 'רגוע' },
      ),
      bottle(local(2026, 10, 5, 9, 30), 120, { id: 'e2', content: 'breastmilk' }),
      solid(local(2026, 10, 5, 11), ['אבוקדו', 'בננה'], {
        id: 'e3',
        isNewFood: true,
        amount: '2 כפיות',
        reaction: 'פריחה קלה',
      }),
    ],
    measurements: [
      measurement('2026-07-01', { id: 'm1', weightG: 4300, lengthMm: 545, headMm: 372 }),
    ],
    activeTimers: { baby1: startTimer('baby1', 'right', NOW) },
    settings: { ...DEFAULT_SETTINGS, activeBabyId: 'baby1' },
  };
}

function withData(mutate: (d: Record<string, unknown>) => void): string {
  const file = JSON.parse(serializeBackup(sampleData(), NOW)) as { data: Record<string, unknown> };
  mutate(file.data);
  return JSON.stringify(file);
}

describe('JSON backup', () => {
  it('round-trips losslessly', () => {
    const data = sampleData();
    const json = serializeBackup(data, NOW);
    const parsed = parseBackup(json);
    expect(parsed).toEqual({ ok: true, data, exportedAt: NOW });
    const header = JSON.parse(json) as Record<string, unknown>;
    expect(header).toMatchObject({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: NOW,
    });
  });

  it('accepts a UTF-8 BOM and fills optional sections with defaults', () => {
    const json =
      '﻿' +
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: { babies: [], entries: [] } });
    expect(parseBackup(json)).toEqual({
      ok: true,
      data: {
        babies: [],
        entries: [],
        measurements: [],
        activeTimers: {},
        settings: { ...DEFAULT_SETTINGS },
      },
    });
  });

  it('strips unknown properties', () => {
    const res = parseBackup(
      withData((d) => ((d.babies as Record<string, unknown>[])[0]!.evil = '<script>')),
    );
    expect(res.ok && 'evil' in (res.data.babies[0] ?? {})).toBe(false);
  });

  it('repairs a dangling activeBabyId instead of rejecting', () => {
    const res = parseBackup(
      withData((d) => ((d.settings as Record<string, unknown>).activeBabyId = 'ghost')),
    );
    expect(res.ok && res.data.settings.activeBabyId).toBe('baby1');
  });

  it.each([
    ['not json', '{oops', 'INVALID_JSON', undefined],
    ['other json', JSON.stringify({ hello: 1 }), 'NOT_A_BACKUP', undefined],
    ['array', '[]', 'NOT_A_BACKUP', undefined],
    [
      'future version',
      JSON.stringify({ format: BACKUP_FORMAT, version: 99, data: {} }),
      'UNSUPPORTED_VERSION',
      'version',
    ],
    ['missing data', JSON.stringify({ format: BACKUP_FORMAT, version: 1 }), 'INVALID_DATA', 'data'],
  ])('rejects %s', (_label, json, code, path) => {
    const res = parseBackup(json);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(code);
      if (path) expect(res.error.path).toBe(path);
    }
  });

  it.each<[string, (d: Record<string, unknown>) => void, string, string]>([
    [
      'negative amount',
      (d) => ((d.entries as Record<string, unknown>[])[1]!.amountMl = -5),
      'INVALID_DATA',
      'data.entries[1].amountMl',
    ],
    [
      'bad enum',
      (d) => ((d.entries as Record<string, unknown>[])[1]!.content = 'juice'),
      'INVALID_DATA',
      'data.entries[1].content',
    ],
    [
      'bad type',
      (d) => ((d.entries as Record<string, unknown>[])[0]!.type = 'nap'),
      'INVALID_DATA',
      'data.entries[0].type',
    ],
    [
      'bad birth date',
      (d) => ((d.babies as Record<string, unknown>[])[0]!.birthDate = '2026-02-30'),
      'INVALID_DATA',
      'data.babies[0].birthDate',
    ],
    [
      'empty name',
      (d) => ((d.babies as Record<string, unknown>[])[0]!.name = '  '),
      'INVALID_DATA',
      'data.babies[0].name',
    ],
    [
      'bad sex',
      (d) => ((d.babies as Record<string, unknown>[])[0]!.sex = 'x'),
      'INVALID_DATA',
      'data.babies[0].sex',
    ],
    [
      'seconds timestamp',
      (d) => ((d.entries as Record<string, unknown>[])[1]!.at = 1_790_000_000),
      'INVALID_DATA',
      'data.entries[1].at',
    ],
    [
      'segment reversed',
      (d) => {
        const seg = (
          (d.entries as Record<string, unknown>[])[0]!.segments as Record<string, number>[]
        )[0]!;
        seg.endedAt = (seg.startedAt ?? 0) - 1;
      },
      'INVALID_DATA',
      'data.entries[0].segments[0].endedAt',
    ],
    [
      'feed reversed',
      (d) => {
        const e = (d.entries as Record<string, number>[])[0]!;
        e.endedAt = (e.startedAt ?? 0) - 1;
      },
      'INVALID_DATA',
      'data.entries[0].endedAt',
    ],
    [
      'foods not strings',
      (d) => ((d.entries as Record<string, unknown>[])[2]!.foods = [1]),
      'INVALID_DATA',
      'data.entries[2].foods[0]',
    ],
    [
      'isNewFood not bool',
      (d) => ((d.entries as Record<string, unknown>[])[2]!.isNewFood = 'yes'),
      'INVALID_DATA',
      'data.entries[2].isNewFood',
    ],
    ['entries not array', (d) => (d.entries = {}), 'INVALID_DATA', 'data.entries'],
    ['entry not object', (d) => (d.entries = [null]), 'INVALID_DATA', 'data.entries[0]'],
    [
      'duplicate id',
      (d) => ((d.entries as Record<string, unknown>[])[1]!.id = 'e1'),
      'DUPLICATE_ID',
      'data.entries[1].id',
    ],
    [
      'unknown baby',
      (d) => ((d.measurements as Record<string, unknown>[])[0]!.babyId = 'ghost'),
      'UNKNOWN_BABY',
      'data.measurements[0].babyId',
    ],
    [
      'bad measurement date',
      (d) => ((d.measurements as Record<string, unknown>[])[0]!.date = 'yesterday'),
      'INVALID_DATA',
      'data.measurements[0].date',
    ],
    [
      'bad note',
      (d) => ((d.measurements as Record<string, unknown>[])[0]!.note = 5),
      'INVALID_DATA',
      'data.measurements[0].note',
    ],
    [
      'timer key mismatch',
      (d) =>
        (d.activeTimers = {
          other: { babyId: 'baby1', segments: [{ side: 'left', startedAt: NOW }] },
        }),
      'INVALID_DATA',
      'data.activeTimers.other.babyId',
    ],
    [
      'timer for unknown baby',
      (d) =>
        (d.activeTimers = {
          ghost: { babyId: 'ghost', segments: [{ side: 'left', startedAt: NOW }] },
        }),
      'UNKNOWN_BABY',
      'data.activeTimers.ghost',
    ],
    [
      'empty timer',
      (d) => (d.activeTimers = { baby1: { babyId: 'baby1', segments: [] } }),
      'INVALID_DATA',
      'data.activeTimers.baby1.segments',
    ],
    [
      'timer segment reversed',
      (d) =>
        (d.activeTimers = {
          baby1: {
            babyId: 'baby1',
            segments: [{ side: 'left', startedAt: NOW, endedAt: NOW - 1 }],
          },
        }),
      'INVALID_DATA',
      'data.activeTimers.baby1.segments[0].endedAt',
    ],
    [
      'bad theme',
      (d) => ((d.settings as Record<string, unknown>).theme = 'neon'),
      'INVALID_DATA',
      'data.settings.theme',
    ],
  ])('rejects %s with a precise error and no partial data', (_label, mutate, code, path) => {
    const res = parseBackup(withData(mutate));
    expect(res).toEqual({ ok: false, error: expect.objectContaining({ code, path }) as unknown });
  });

  it('accepts paused timers and timer segments with endedAt', () => {
    const res = parseBackup(
      withData(
        (d) =>
          (d.activeTimers = {
            baby1: {
              babyId: 'baby1',
              pausedAt: NOW + 5,
              segments: [{ side: 'left', startedAt: NOW, endedAt: NOW + 5 }],
            },
          }),
      ),
    );
    expect(res.ok && res.data.activeTimers.baby1?.pausedAt).toBe(NOW + 5);
  });

  it('validateBackupData validates a raw data object', () => {
    expect(validateBackupData(sampleData()).ok).toBe(true);
    expect(validateBackupData('nope')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_DATA', path: 'data' },
    });
  });

  it('suggests a dated file name', () => {
    expect(backupFileName(NOW)).toBe('babymonitor-backup-2026-10-05.json');
  });
});

describe('CSV export', () => {
  it('starts with a BOM, uses CRLF and Hebrew headers', () => {
    const csv = feedingsToCsv([], []);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe(
      '﻿תינוק,סוג,תאריך,שעת התחלה,שעת סיום,משך (דקות),שמאל (דקות),ימין (דקות),צד אחרון,תוכן,כמות (מ״ל),מזונות,כמות מוצקים,מזון חדש,תגובה,הערה\r\n',
    );
  });

  it('exports each feeding type newest first with local times', () => {
    const data = sampleData();
    const lines = feedingsToCsv(data.entries, data.babies).replace('﻿', '').split('\r\n');
    expect(lines).toHaveLength(5); // header + 3 rows + trailing empty
    expect(lines[1]).toBe('נועה,מוצקים,2026-10-05,11:00,,,,,,,,אבוקדו; בננה,2 כפיות,כן,פריחה קלה,');
    expect(lines[2]).toBe('נועה,בקבוק,2026-10-05,09:30,,,,,,חלב אם,120,,,,,');
    expect(lines[3]).toBe('נועה,הנקה,2026-10-05,06:00,06:17,17,10,7,ימין,,,,,,,רגוע');
  });

  it('escapes quotes/commas/newlines and neutralises formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(undefined)).toBe('');
  });

  it('exports measurements oldest first in g / cm', () => {
    const data = sampleData();
    const ms = [
      ...data.measurements,
      measurement('2026-06-15', { babyId: 'baby1', weightG: 3600 }),
    ];
    const lines = measurementsToCsv(ms, data.babies).replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('תינוק,תאריך,משקל (גרם),אורך (ס״מ),היקף ראש (ס״מ),הערה');
    expect(lines[1]).toBe('נועה,2026-06-01,3200,,,מדידות לידה'); // from the baby profile
    expect(lines[2]).toBe('נועה,2026-06-15,3600,,,');
    expect(lines[3]).toBe('נועה,2026-07-01,4300,54.5,37.2,');
  });

  it('exports birth length and head circumference from the profile', () => {
    const baby = {
      id: 'b',
      name: 'איתי',
      birthDate: '2026-01-01',
      sex: 'male' as const,
      createdAt: NOW,
      birthLengthMm: 505,
      birthHeadMm: 345,
    };
    const lines = measurementsToCsv([], [baby]).replace('\uFEFF', '').split('\r\n');
    expect(lines[1]).toBe('איתי,2026-01-01,,50.5,34.5,מדידות לידה');
  });

  it('leaves unknown baby names blank', () => {
    const lines = feedingsToCsv([bottle(NOW, 60, { babyId: 'ghost' })], []).split('\r\n');
    expect(lines[1]?.startsWith(',בקבוק,')).toBe(true);
    expect(
      measurementsToCsv([measurement('2026-06-15', { babyId: 'ghost' })], []).split('\r\n')[1],
    ).toBe(',2026-06-15,,,,');
  });
});

describe('birth length / head circumference (backward compatible)', () => {
  it('round-trips the new optional fields and accepts old backups without them', () => {
    const data = sampleData();
    const baby = { ...data.babies[0]!, birthLengthMm: 498, birthHeadMm: 341 };
    const withFields = { ...data, babies: [baby] };
    expect(parseBackup(serializeBackup(withFields, NOW))).toMatchObject({
      ok: true,
      data: { babies: [baby] },
    });
    const old = parseBackup(serializeBackup(data, NOW));
    expect(old.ok && 'birthLengthMm' in (old.data.babies[0] ?? {})).toBe(false);
  });

  it('rejects invalid values', () => {
    const res = parseBackup(
      withData((d) => ((d.babies as Record<string, unknown>[])[0]!.birthHeadMm = -3)),
    );
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'INVALID_DATA', path: 'data.babies[0].birthHeadMm' },
    });
  });
});

describe('parseRecord', () => {
  it('validates single records and strips unknown fields', () => {
    const data = sampleData();
    expect(parseRecord('baby', { ...data.babies[0], extra: 1 })).toEqual(data.babies[0]);
    expect(parseRecord('entry', data.entries[1])).toEqual(data.entries[1]);
    expect(parseRecord('measurement', data.measurements[0])).toEqual(data.measurements[0]);
    expect(parseRecord('timer', data.activeTimers.baby1)).toEqual(data.activeTimers.baby1);
  });

  it('returns null for malformed records', () => {
    expect(parseRecord('entry', { id: 'x', type: 'bottle' })).toBeNull();
    expect(parseRecord('baby', null)).toBeNull();
    expect(parseRecord('timer', { babyId: 'b', segments: [] })).toBeNull();
  });
});
