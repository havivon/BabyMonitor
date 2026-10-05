import { beforeAll, describe, expect, it } from 'vitest';
import { assessSeries, growthSeries } from '../../domain/growth/series';
import { loadWhoTables, type WhoTables } from '../../domain/growth/who';
import { measurement } from '../../test/helpers';
import {
  ageLabel,
  buildChartRows,
  chartRange,
  toChartUnit,
  toX,
  xTicks,
  yDomain,
} from './chartModel';

let tables: WhoTables;
beforeAll(async () => {
  tables = await loadWhoTables();
});

describe('chartRange', () => {
  it('snaps birth→max(age+2m, last+1m) to standard widths, weeks for 0–3 months', () => {
    expect(chartRange(10, 10)).toMatchObject({ months: 3, unit: 'weeks' });
    expect(chartRange(40, 30)).toMatchObject({ months: 6, unit: 'months' });
    expect(chartRange(150, 120)).toMatchObject({ months: 12 });
    expect(chartRange(300, 280)).toMatchObject({ months: 12 });
    expect(chartRange(330, 300)).toMatchObject({ months: 24 });
    expect(chartRange(1800, 1800)).toMatchObject({ months: 60, days: 1826 });
    // A future-dated or late measurement extends the range.
    expect(chartRange(20, 160)).toMatchObject({ months: 12 });
  });

  it('builds ticks per unit', () => {
    expect(xTicks(chartRange(10, null))).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(xTicks(chartRange(40, null))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(xTicks(chartRange(200, null))).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(xTicks(chartRange(1800, null))).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]);
  });

  it('converts units', () => {
    expect(toX(14, 'weeks')).toBe(2);
    expect(toX(30.4375, 'months')).toBe(1);
    expect(toChartUnit('weight', 3500, 'kg')).toBe(3.5);
    expect(toChartUnit('weight', 453.59237, 'lb')).toBeCloseTo(1, 10);
    expect(toChartUnit('head', 345, 'kg')).toBe(34.5);
  });

  it('labels ages', () => {
    expect(ageLabel(1)).toBe('יום אחד');
    expect(ageLabel(10)).toBe('10 ימים');
    expect(ageLabel(35)).toBe('5 שבועות');
    expect(ageLabel(137)).toBe('4.5 חודשים');
  });
});

describe('buildChartRows', () => {
  const baby = { birthDate: '2026-06-01', birthWeightG: 3300, sex: 'female' as const };

  it('merges WHO bands with baby points (curve values at the exact age)', () => {
    const ms = [
      measurement('2026-07-01', { weightG: 4300 }),
      measurement('2026-08-15', { weightG: 5500 }),
    ];
    const points = assessSeries(
      growthSeries(baby, ms, 'weight'),
      tables.weight,
      'weight',
      'female',
    );
    const range = chartRange(80, 75);
    const rows = buildChartRows(tables.weight, 'weight', 'female', range, points, 'kg');
    expect(rows[0]?.ageDays).toBe(0);
    expect(rows[rows.length - 1]?.ageDays).toBe(range.days);
    const babyRows = rows.filter((r) => r.baby !== undefined);
    expect(babyRows.map((r) => r.ageDays)).toEqual([0, 30, 75]);
    expect(babyRows.map((r) => r.baby)).toEqual([3.3, 4.3, 5.5]);
    expect(babyRows.map((r) => r.isLatest)).toEqual([false, false, true]);
    for (const r of rows) {
      expect(r.outerBase).toBe(r.p3);
      expect((r.outerBase ?? 0) + (r.outerBand ?? 0)).toBeCloseTo(r.p97 ?? Number.NaN, 10);
      expect((r.innerBase ?? 0) + (r.innerBand ?? 0)).toBeCloseTo(r.p85 ?? Number.NaN, 10);
    }
    // sorted by age, unique ages
    const ages = rows.map((r) => r.ageDays);
    expect(ages).toEqual([...new Set(ages)].sort((a, b) => a - b));
    expect(babyRows[0]?.p50).toBeCloseTo(3.2322, 4);
  });

  it('works without tables (baby points only) and hides points beyond the range', () => {
    const points = [
      { date: 'a', ageDays: 0, value: 3300, source: 'birth' as const, z: null, percentile: null },
      {
        date: 'b',
        ageDays: 900,
        value: 12000,
        source: 'measurement' as const,
        z: null,
        percentile: null,
      },
    ];
    const rows = buildChartRows(null, 'weight', 'male', chartRange(20, 20), points, 'kg');
    expect(rows).toEqual([
      { x: 0, ageDays: 0, baby: 3.3, babyRaw: 3300, babyPercentile: null, isLatest: true },
    ]);
  });

  it('yDomain rounds to whole kg / 5 cm', () => {
    const points = assessSeries(
      growthSeries(baby, [], 'weight'),
      tables.weight,
      'weight',
      'female',
    );
    const rows = buildChartRows(
      tables.weight,
      'weight',
      'female',
      chartRange(30, null),
      points,
      'kg',
    );
    const [lo, hi] = yDomain(rows, 'weight');
    expect(Number.isInteger(lo) && Number.isInteger(hi)).toBe(true);
    expect(lo).toBeLessThanOrEqual(2.4);
    expect(hi).toBeGreaterThanOrEqual(6);
    const len = buildChartRows(tables.length, 'length', 'female', chartRange(30, null), [], 'kg');
    const [l1, l2] = yDomain(len, 'length');
    expect(l1 % 5).toBe(0);
    expect(l2 % 5).toBe(0);
    expect(yDomain([], 'weight')).toEqual([0, 1]);
  });
});
