import { describe, expect, it } from 'vitest';
import type { Baby } from '../../domain/types';
import { bottle, breast, DAY, HOUR, local, measurement, MIN } from '../../test/helpers';
import { milkGuide } from './milkGuide';

const NOW = local(2026, 10, 5, 18, 0);
const baby: Baby = {
  id: 'baby1',
  name: 'נועה',
  birthDate: '2026-08-01',
  sex: 'female',
  birthWeightG: 3300,
  createdAt: 0,
};
const weights = [measurement('2026-09-30', { weightG: 5000 })];
const bottles = [bottle(NOW - HOUR, 150), bottle(NOW - 4 * HOUR, 120), bottle(NOW - DAY, 140)];

describe('milkGuide', () => {
  it('applies to a mainly bottle-fed baby with a weight: range, today and per-feed amount', () => {
    const g = milkGuide({
      baby,
      entries: bottles,
      measurements: weights,
      activeTimer: null,
      now: NOW,
    });
    expect(g).toMatchObject({
      weightG: 5000,
      range: { minMl: 600, typicalMl: 750, maxMl: 900 },
      todayMl: 270,
    });
    // Own history: 1 bottle on each of the last complete days → rounds to 1 feed/day.
    expect(g?.feedsPerDay).toBe(1);
  });

  it('falls back to the birth weight and to the age norm for feeds per day', () => {
    const g = milkGuide({
      baby,
      entries: [bottle(NOW - HOUR, 90)],
      measurements: [],
      activeTimer: null,
      now: NOW,
    });
    expect(g?.weightG).toBe(3300);
    expect(g?.feedsPerDay).toBe(7); // 1–3 months
  });

  it('is hidden with breastfeeding in the last 72 h, a running timer, no bottles, or after 6 months', () => {
    const base = { baby, measurements: weights, activeTimer: null, now: NOW };
    expect(
      milkGuide({ ...base, entries: [...bottles, breast(NOW - 2 * DAY, [['left', 10]])] }),
    ).toBeNull();
    expect(
      milkGuide({
        ...base,
        entries: bottles,
        activeTimer: { babyId: 'baby1', segments: [{ side: 'left', startedAt: NOW - MIN }] },
      }),
    ).toBeNull();
    expect(milkGuide({ ...base, entries: [] })).toBeNull();
    expect(
      milkGuide({ ...base, entries: bottles, baby: { ...baby, birthDate: '2026-01-01' } }),
    ).toBeNull();
    expect(
      milkGuide({ ...base, entries: [...bottles, breast(NOW - 4 * DAY, [['left', 10]])] }),
    ).not.toBeNull();
  });
});
