import { describe, expect, it } from 'vitest';
import { breast, local, MIN } from '../../test/helpers';
import { applyBreastEdit, breastMeta, entryMinutes, segmentsFromMinutes } from './breastEntry';

const T = local(2026, 10, 5, 9);

describe('segmentsFromMinutes', () => {
  it('builds sequential segments, first side first, skipping empty sides', () => {
    expect(segmentsFromMinutes(T, { right: 12, left: 9 }, 'left')).toEqual([
      { side: 'left', startedAt: T, endedAt: T + 9 * MIN },
      { side: 'right', startedAt: T + 9 * MIN, endedAt: T + 21 * MIN },
    ]);
    expect(segmentsFromMinutes(T, { right: 0, left: 5 }, 'right')).toEqual([
      { side: 'left', startedAt: T, endedAt: T + 5 * MIN },
    ]);
  });
});

describe('applyBreastEdit', () => {
  const entry = breast(T, [
    ['right', 10],
    ['left', 8],
    ['right', 2],
  ]);

  it('keeps exact segments when only the start time / note change', () => {
    const edited = applyBreastEdit(entry, {
      startedAt: T - 30 * MIN,
      minutes: entryMinutes(entry),
      note: '  ok ',
    })!;
    expect(edited.segments).toHaveLength(3);
    expect(edited.startedAt).toBe(T - 30 * MIN);
    expect(edited.endedAt).toBe(T - 10 * MIN);
    expect(edited.note).toBe('ok');
    expect(edited.id).toBe(entry.id);
  });

  it('rebuilds segments in the original side order when minutes change, and drops an empty note', () => {
    const edited = applyBreastEdit(
      { ...entry, note: 'old' },
      { startedAt: T, minutes: { right: 15, left: 5 }, note: '' },
    )!;
    expect(edited.segments.map((s) => [s.side, (s.endedAt - s.startedAt) / MIN])).toEqual([
      ['right', 15],
      ['left', 5],
    ]);
    expect(edited.endedAt).toBe(T + 20 * MIN);
    expect(edited).not.toHaveProperty('note');
  });

  it('returns null when both sides are zero', () => {
    expect(
      applyBreastEdit(entry, { startedAt: T, minutes: { right: 0, left: 0 }, note: '' }),
    ).toBeNull();
  });
});

describe('breastMeta', () => {
  it('lists sides in order and merges a pause-split side', () => {
    const e = breast(T, [
      ['right', 12],
      ['left', 9],
    ]);
    expect(breastMeta(e)).toEqual(['ימין 12 ד׳', 'שמאל 9 ד׳']);
    const paused = {
      segments: [
        { side: 'left' as const, startedAt: T, endedAt: T + 5 * MIN },
        { side: 'left' as const, startedAt: T + 8 * MIN, endedAt: T + 10 * MIN },
      ],
    };
    expect(breastMeta(paused)).toEqual(['שמאל 7 ד׳']);
  });
});
