import { beforeAll, describe, expect, it } from 'vitest';
import { growthInsights, type GrowthInsight } from './insights';
import { valueAtPercentile } from './percentiles';
import { loadWhoTables, type WhoTables } from './who';
import { addDaysToKey } from '../dates';
import type { Measurement, Sex } from '../types';
import { local, measurement } from '../../test/helpers';

let tables: WhoTables;
beforeAll(async () => {
  tables = await loadWhoTables();
});

const BIRTH = '2026-06-01';
const onDay = (day: number) => addDaysToKey(BIRTH, day);
const nowAtDay = (day: number) => {
  const [y, m, d] = onDay(day).split('-').map(Number) as [number, number, number];
  return local(y, m, d, 12);
};
const kinds = (list: GrowthInsight[]) => list.map((i) => i.kind);

function run(opts: {
  sex?: Sex;
  birthWeightG?: number;
  measurements: Measurement[];
  today: number;
  withTables?: boolean;
}) {
  return growthInsights({
    baby: {
      birthDate: BIRTH,
      sex: opts.sex ?? 'male',
      ...(opts.birthWeightG ? { birthWeightG: opts.birthWeightG } : {}),
    },
    measurements: opts.measurements,
    tables: opts.withTables === false ? {} : tables,
    now: nowAtDay(opts.today),
  });
}

describe('newborn weight loss / regain', () => {
  it('flags > 10 % loss as alert, > 7 % as warn, ≤ 7 % as info (largest loss in first 14 days)', () => {
    const base = { birthWeightG: 3500, today: 5, withTables: false };
    const alert = run({
      ...base,
      measurements: [
        measurement(onDay(3), { weightG: 3150 }),
        measurement(onDay(4), { weightG: 3100 }),
      ],
    });
    expect(alert[0]).toMatchObject({ kind: 'birthWeightLoss', severity: 'alert', ageDays: 4 });
    expect((alert[0] as { pct: number }).pct).toBeCloseTo(11.43, 2);

    const warn = run({ ...base, measurements: [measurement(onDay(3), { weightG: 3200 })] });
    expect(warn[0]).toMatchObject({ kind: 'birthWeightLoss', severity: 'warn' });

    const info = run({ ...base, measurements: [measurement(onDay(3), { weightG: 3300 })] });
    expect(info[0]).toMatchObject({ kind: 'birthWeightLoss', severity: 'info' });

    // Exactly 10 % is "warn" (consult threshold is MORE than 10 %).
    const ten = run({ ...base, measurements: [measurement(onDay(3), { weightG: 3150 })] });
    expect(ten[0]).toMatchObject({ severity: 'warn', pct: 10 });
  });

  it('reports birth weight regained by day 14 (on time) and late', () => {
    const onTime = run({
      birthWeightG: 3500,
      today: 13,
      withTables: false,
      measurements: [
        measurement(onDay(3), { weightG: 3300 }),
        measurement(onDay(12), { weightG: 3550 }),
      ],
    });
    expect(onTime).toContainEqual({
      kind: 'birthWeightRegained',
      severity: 'info',
      ageDays: 12,
      date: onDay(12),
      onTime: true,
    });
    expect(kinds(onTime)).not.toContain('birthWeightNotRegained');

    const late = run({
      birthWeightG: 3500,
      today: 20,
      withTables: false,
      measurements: [measurement(onDay(18), { weightG: 3510 })],
    });
    expect(late).toContainEqual(
      expect.objectContaining({ kind: 'birthWeightRegained', onTime: false }),
    );
  });

  it('flags not regained after day 14', () => {
    const list = run({
      birthWeightG: 3500,
      today: 21,
      withTables: false,
      measurements: [measurement(onDay(20), { weightG: 3400 })],
    });
    expect(list).toContainEqual(
      expect.objectContaining({ kind: 'birthWeightNotRegained', severity: 'warn', ageDays: 20 }),
    );
    // Not yet flagged on day 12.
    expect(
      kinds(
        run({
          birthWeightG: 3500,
          today: 12,
          withTables: false,
          measurements: [measurement(onDay(12), { weightG: 3400 })],
        }),
      ),
    ).not.toContain('birthWeightNotRegained');
  });

  it('hides newborn-only insights after 4 weeks and without birth weight', () => {
    const ms = [
      measurement(onDay(3), { weightG: 3100 }),
      measurement(onDay(12), { weightG: 3600 }),
    ];
    expect(run({ birthWeightG: 3500, today: 40, withTables: false, measurements: ms })).toEqual([]);
    expect(run({ today: 5, withTables: false, measurements: ms })).toEqual([]);
  });
});

describe('percentile flags', () => {
  it('flags below P3 and above P97 on the latest measurement', () => {
    const low = run({ birthWeightG: 2300, today: 1, measurements: [] });
    expect(low).toContainEqual(
      expect.objectContaining({ kind: 'lowPercentile', indicator: 'weight', severity: 'warn' }),
    );

    const high = run({ today: 30, measurements: [measurement(onDay(30), { headMm: 400 })] });
    expect(high).toContainEqual(
      expect.objectContaining({ kind: 'highPercentile', indicator: 'head' }),
    );

    const normal = run({ birthWeightG: 3346, today: 1, measurements: [] });
    expect(normal).toEqual([]);
  });

  it('flags crossing ≥ 2 major percentile lines downward (after day 14)', () => {
    const w = (day: number, p: number) =>
      valueAtPercentile(tables.weight, 'weight', 'female', day, p) ?? 0;
    const list = run({
      sex: 'female',
      today: 121,
      measurements: [
        measurement(onDay(30), { weightG: Math.round(w(30, 90)) }),
        measurement(onDay(60), { weightG: Math.round(w(60, 70)) }),
        measurement(onDay(120), { weightG: Math.round(w(120, 10)) }),
      ],
    });
    const crossing = list.find((i) => i.kind === 'percentileCrossingDown');
    expect(crossing).toMatchObject({
      indicator: 'weight',
      linesCrossed: 3,
      fromDate: onDay(30),
      toDate: onDay(120),
    });

    // Crossing a single line (P85 → P60) is not flagged.
    const one = run({
      sex: 'female',
      today: 121,
      measurements: [
        measurement(onDay(30), { weightG: Math.round(w(30, 88)) }),
        measurement(onDay(120), { weightG: Math.round(w(120, 60)) }),
      ],
    });
    expect(kinds(one)).not.toContain('percentileCrossingDown');
  });

  it('ignores the early physiological-loss period for crossings', () => {
    const w = (day: number, p: number) =>
      valueAtPercentile(tables.weight, 'weight', 'male', day, p) ?? 0;
    const list = run({
      birthWeightG: Math.round(w(0, 90)),
      today: 30,
      measurements: [
        measurement(onDay(5), { weightG: Math.round(w(5, 80)) }),
        measurement(onDay(30), { weightG: Math.round(w(30, 20)) }),
      ],
    });
    expect(kinds(list)).not.toContain('percentileCrossingDown');
  });
});

describe('weight gain flag', () => {
  it('flags gain below the typical range for age', () => {
    const list = run({
      birthWeightG: 3500,
      today: 45,
      withTables: false,
      measurements: [
        measurement(onDay(30), { weightG: 4200 }),
        measurement(onDay(44), { weightG: 4300 }),
      ],
    });
    expect(list).toContainEqual(
      expect.objectContaining({
        kind: 'lowWeightGain',
        severity: 'warn',
        gPerWeek: 50,
        minGPerWeek: 150,
        days: 14,
      }),
    );
  });

  it('does not flag normal gain, short spans or babies ≥ 12 months', () => {
    const ok = run({
      birthWeightG: 3500,
      today: 45,
      withTables: false,
      measurements: [
        measurement(onDay(30), { weightG: 4200 }),
        measurement(onDay(44), { weightG: 4560 }),
      ],
    });
    expect(kinds(ok)).not.toContain('lowWeightGain');
    const short = run({
      today: 45,
      withTables: false,
      measurements: [
        measurement(onDay(40), { weightG: 4200 }),
        measurement(onDay(44), { weightG: 4200 }),
      ],
    });
    expect(kinds(short)).not.toContain('lowWeightGain');
    const older = run({
      today: 420,
      withTables: false,
      measurements: [
        measurement(onDay(380), { weightG: 9500 }),
        measurement(onDay(410), { weightG: 9500 }),
      ],
    });
    expect(older).toEqual([]);
  });
});

it('sorts insights by severity (alert → warn → info)', () => {
  const list = run({
    birthWeightG: 3500,
    today: 4,
    measurements: [measurement(onDay(3), { weightG: 3100 })],
  });
  const ranks = list.map((i) => ({ alert: 0, warn: 1, info: 2 })[i.severity]);
  expect(ranks).toEqual([...ranks].sort());
  expect(list[0]?.severity).toBe('alert');
});
