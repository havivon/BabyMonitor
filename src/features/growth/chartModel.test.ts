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
  spreadLabels,
  yAxis,
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
      expect(r.p3).toBeLessThan(r.p15 ?? Number.NaN);
      expect(r.p85).toBeLessThan(r.p97 ?? Number.NaN);
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

  it.each([
    ['weight', 'female', 5, 2, 2, 8, 1],
    ['weight', 'female', 120, 2, 2, 10, 2],
    ['weight', 'male', 540, 6, 2, 16, 2],
    ['length', 'male', 5, 3, 45, 70, 5],
    ['length', 'female', 120, 3, 45, 75, 5],
    ['length', 'male', 540, 3, 45, 95, 5],
    ['head', 'female', 120, 3, 30, 50, 5],
    ['head', 'male', 540, 3, 30, 55, 5],
  ] as const)(
    '%s %s at day %i: axis hugs the bands (not from 0)',
    (metric, sex, age, _x, lo, hi, step) => {
      const range = chartRange(age, null);
      const rows = buildChartRows(tables[metric], metric, sex, range, [], 'kg');
      const { domain, ticks } = yAxis(rows, metric, 'kg');
      expect(domain[0]).toBeGreaterThanOrEqual(lo - step);
      expect(domain[0]).toBeLessThanOrEqual(lo);
      expect(domain[1]).toBeGreaterThanOrEqual(hi - step);
      expect(domain[1]).toBeLessThanOrEqual(hi + step);
      expect(domain[0]).toBeGreaterThan(0);
      expect(ticks[0]).toBe(domain[0]);
      expect(ticks[ticks.length - 1]).toBe(domain[1]);
      ticks.slice(1).forEach((t, i) => {
        expect(t - (ticks[i] ?? 0)).toBeCloseTo(step, 9);
      });
    },
  );

  it('uses 2/5 lb steps and a sane empty axis', () => {
    const rows = buildChartRows(tables.weight, 'weight', 'male', chartRange(540, null), [], 'lb');
    const { ticks } = yAxis(rows, 'weight', 'lb');
    expect((ticks[1] ?? 0) - (ticks[0] ?? 0)).toBe(5);
    expect(yAxis([], 'weight', 'kg')).toEqual({ domain: [0, 1], ticks: [0, 1] });
  });
});

describe('spreadLabels', () => {
  it('keeps the middle label and pushes neighbours ≥ gap apart, inside bounds', () => {
    const out = spreadLabels(
      [
        { key: '97', y: 100 },
        { key: '85', y: 104 },
        { key: '50', y: 110 },
        { key: '15', y: 114 },
        { key: '3', y: 118 },
      ],
      11,
      0,
      300,
    );
    expect(out.map((l) => [l.key, l.y])).toEqual([
      ['97', 88],
      ['85', 99],
      ['50', 110],
      ['15', 121],
      ['3', 132],
    ]);
  });

  it('leaves well-spaced labels alone and shifts a crowded set back into the plot', () => {
    const spaced = [
      { key: 'a', y: 10 },
      { key: 'b', y: 40 },
    ];
    expect(spreadLabels(spaced, 11, 0, 100)).toEqual(spaced);
    const crowded = spreadLabels(
      [
        { key: 'a', y: 2 },
        { key: 'b', y: 3 },
        { key: 'c', y: 4 },
      ],
      11,
      0,
      100,
    );
    expect(crowded.map((l) => l.y)).toEqual([0, 11, 22]);
    expect(spreadLabels([], 11, 0, 100)).toEqual([]);
  });
});
