import { describe, expect, it } from 'vitest';
import { bottle, breast, HOUR, local, solid } from '../../test/helpers';
import { chartDays, daysWithData, delta, isMainlyBottleFed, statsSummary } from './statsModel';

const NOW = local(2026, 10, 5, 12); // Monday

/** n bottle feeds of `ml` every 3h on the local day `d` days before today. */
function day(daysAgo: number, n: number, ml: number) {
  return Array.from({ length: n }, (_, i) => bottle(local(2026, 10, 5 - daysAgo, 1 + i * 3), ml));
}

describe('statsSummary', () => {
  it('averages complete days only and compares with the previous period', () => {
    const entries = [
      ...Array.from({ length: 7 }, (_, i) => day(i + 1, 8, 100)).flat(), // current: 8/day, 800 ml
      ...Array.from({ length: 7 }, (_, i) => day(i + 8, 6, 100)).flat(), // previous: 6/day, 600 ml
      ...day(0, 3, 500), // today — excluded
    ];
    const { current, previous } = statsSummary(entries, 7, NOW);
    expect(current).toMatchObject({
      activeDays: 7,
      feedsPerDay: 8,
      bottleMlPerDay: 800,
      breastMinPerDay: 0,
    });
    expect(previous).toMatchObject({ activeDays: 7, feedsPerDay: 6, bottleMlPerDay: 600 });
    expect(current.avgIntervalMs).toBeGreaterThan(2.9 * HOUR);
    expect(current.avgIntervalMs).toBeLessThan(3.5 * HOUR);
    expect(delta(current.feedsPerDay, previous.feedsPerDay)).toBe(2);
  });

  it('only averages days since tracking started', () => {
    const entries = [...day(1, 6, 100), ...day(2, 8, 100)];
    const { current, previous } = statsSummary(entries, 7, NOW);
    expect(current).toMatchObject({ activeDays: 2, feedsPerDay: 7 });
    expect(previous).toEqual({
      activeDays: 0,
      feedsPerDay: null,
      bottleMlPerDay: null,
      breastMinPerDay: null,
      avgIntervalMs: null,
    });
    expect(delta(current.feedsPerDay, previous.feedsPerDay)).toBeNull();
  });

  it('counts breast minutes and handles no data', () => {
    const entries = [
      breast(local(2026, 10, 4, 8), [
        ['left', 10],
        ['right', 20],
      ]),
      solid(local(2026, 10, 4, 12), ['גזר']),
    ];
    expect(statsSummary(entries, 7, NOW).current).toMatchObject({
      feedsPerDay: 1,
      breastMinPerDay: 30,
      avgIntervalMs: null,
    });
    expect(statsSummary([], 14, NOW).current.activeDays).toBe(0);
  });
});

describe('chartDays', () => {
  it('returns the range days ending today with Hebrew labels', () => {
    const entries = [
      ...day(0, 2, 90),
      breast(local(2026, 10, 3, 8), [
        ['right', 12],
        ['left', 6],
      ]),
      solid(local(2026, 10, 3, 12), ['גזר']),
    ];
    const days = chartDays(entries, 7, NOW);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.label)).toEqual(['ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳', 'א׳', 'היום']);
    expect(days[6]).toMatchObject({ isToday: true, bottle: 2, bottleMl: 180 });
    expect(days[4]).toMatchObject({ breast: 1, solid: 1, rightMin: 12, leftMin: 6 });
    expect(chartDays([], 14, NOW)[0]?.label).toBe('22.9');
    expect(chartDays([], 30, NOW)).toHaveLength(30);
  });

  it('counts days with data', () => {
    expect(daysWithData([...day(0, 2, 90), ...day(3, 1, 90)])).toBe(2);
    expect(daysWithData([])).toBe(0);
  });
});

describe('isMainlyBottleFed', () => {
  it('requires bottles and no breastfeeding in the last 72 h', () => {
    expect(isMainlyBottleFed(day(1, 6, 120), NOW)).toBe(true);
    expect(
      isMainlyBottleFed([...day(1, 6, 120), breast(NOW - 70 * HOUR, [['left', 10]])], NOW),
    ).toBe(false);
    expect(
      isMainlyBottleFed([...day(1, 6, 120), breast(NOW - 80 * HOUR, [['left', 10]])], NOW),
    ).toBe(true);
    expect(isMainlyBottleFed([], NOW)).toBe(false);
  });
});
