import { beforeAll, describe, expect, it } from 'vitest';
import { assessSeries, growthSeries, measurementValue } from './series';
import {
  latestWeightGain,
  percentChangeFromBirth,
  typicalWeeklyGain,
  weightGainBetween,
  TYPICAL_WEEKLY_GAIN,
} from './gain';
import { loadWhoTable } from './who';
import type { LmsTable } from './lms';
import { measurement } from '../../test/helpers';

const baby = { birthDate: '2026-06-01', birthWeightG: 3500 };

describe('growthSeries', () => {
  it('prepends the birth weight and sorts chronologically', () => {
    const s = growthSeries(
      baby,
      [
        measurement('2026-06-15', { weightG: 3600 }),
        measurement('2026-06-04', { weightG: 3300, lengthMm: 500 }),
      ],
      'weight',
    );
    expect(s.map((p) => [p.date, p.ageDays, p.value, p.source])).toEqual([
      ['2026-06-01', 0, 3500, 'birth'],
      ['2026-06-04', 3, 3300, 'measurement'],
      ['2026-06-15', 14, 3600, 'measurement'],
    ]);
  });

  it('prefers a measured birth-date weight, keeps last per date, drops pre-birth & empty values', () => {
    const s = growthSeries(
      baby,
      [
        measurement('2026-06-01', { weightG: 3480 }),
        measurement('2026-06-10', { weightG: 3400 }),
        measurement('2026-06-10', { weightG: 3420 }),
        measurement('2026-05-30', { weightG: 3000 }),
        measurement('2026-06-11', { headMm: 350 }),
        measurement('2026-06-12', { weightG: 0 }),
      ],
      'weight',
    );
    expect(s.map((p) => [p.ageDays, p.value, p.source])).toEqual([
      [0, 3480, 'measurement'],
      [9, 3420, 'measurement'],
    ]);
  });

  it('builds length/head series without a birth point', () => {
    const ms = [measurement('2026-06-11', { headMm: 350, lengthMm: 520 })];
    expect(growthSeries(baby, ms, 'head').map((p) => p.value)).toEqual([350]);
    expect(growthSeries(baby, ms, 'length').map((p) => p.value)).toEqual([520]);
    expect(growthSeries({ birthDate: '2026-06-01' }, [], 'weight')).toEqual([]);
    expect(measurementValue(ms[0]!, 'length')).toBe(520);
  });

  describe('assessSeries', () => {
    let weight: LmsTable;
    beforeAll(async () => {
      weight = await loadWhoTable('weight');
    });
    it('adds z & percentile, null when out of range', () => {
      const pts = assessSeries(
        [
          { date: '2026-06-01', ageDays: 0, value: 3346.4, source: 'birth' },
          { date: '2031-06-01', ageDays: 1900, value: 20000, source: 'measurement' },
        ],
        weight,
        'weight',
        'male',
      );
      expect(pts[0]?.percentile).toBeCloseTo(50, 6);
      expect(pts[1]).toMatchObject({ z: null, percentile: null });
    });
  });
});

describe('weight gain', () => {
  const p = (ageDays: number, value: number) => ({
    date: `d${ageDays}`,
    ageDays,
    value,
    source: 'measurement' as const,
  });

  it('computes g/day and g/week between points', () => {
    expect(weightGainBetween(p(10, 3400), p(24, 3750))).toMatchObject({
      days: 14,
      deltaG: 350,
      gPerDay: 25,
      gPerWeek: 175,
    });
    expect(weightGainBetween(p(10, 3400), p(10, 3500))).toBeNull();
  });

  it('latestWeightGain respects the minimum span', () => {
    const series = [p(0, 3500), p(20, 3700), p(25, 3760)];
    expect(latestWeightGain(series)?.days).toBe(5);
    expect(latestWeightGain(series, 7)).toMatchObject({ days: 25, deltaG: 260 });
    expect(latestWeightGain(series, 30)).toBeNull();
    expect(latestWeightGain([])).toBeNull();
  });

  it('% change vs birth weight', () => {
    expect(percentChangeFromBirth(3000, 2850)).toBeCloseTo(-5, 10);
    expect(percentChangeFromBirth(3000, 3300)).toBeCloseTo(10, 10);
  });

  it('typical weekly gain by age (PRD ranges)', () => {
    expect(typicalWeeklyGain(30)).toMatchObject({ minGPerWeek: 150, maxGPerWeek: 200 });
    expect(typicalWeeklyGain(91)).toMatchObject({ minGPerWeek: 100, maxGPerWeek: 150 });
    expect(typicalWeeklyGain(200)).toMatchObject({ minGPerWeek: 70, maxGPerWeek: 90 });
    expect(typicalWeeklyGain(365)).toBeNull();
    expect(TYPICAL_WEEKLY_GAIN).toHaveLength(3);
  });
});
