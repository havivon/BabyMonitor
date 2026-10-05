import { beforeAll, describe, expect, it } from 'vitest';
import {
  assess,
  CHART_PERCENTILES,
  formatPercentile,
  fromWhoUnits,
  lmsAt,
  percentileCurves,
  percentileFromZ,
  toWhoUnits,
  valueAtPercentile,
  valueAtZ,
  zScore,
} from './percentiles';
import { loadWhoTables, type WhoTables } from './who';

let t: WhoTables;
beforeAll(async () => {
  t = await loadWhoTables();
});

/** Published WHO values are rounded to 0.1 kg / 0.1 cm. */
const WHO_ROUNDING = 0.05 + 1e-9;

describe('WHO percentile correctness', () => {
  it('boys at birth: M = 3.3464 kg is exactly the 50th percentile', () => {
    expect(zScore(t.weight, 'weight', 'male', 0, 3346.4)).toBeCloseTo(0, 10);
    expect(assess(t.weight, 'weight', 'male', 0, 3346.4)?.percentile).toBeCloseTo(50, 8);
  });

  it('girls at birth: median 3.2322 kg', () => {
    expect(valueAtPercentile(t.weight, 'weight', 'female', 0, 50)).toBeCloseTo(3232.2, 6);
  });

  it('boy 2.5 kg at birth ≈ 3rd percentile (z via formula = −1.8988)', () => {
    const a = assess(t.weight, 'weight', 'male', 0, 2500);
    expect(a?.z).toBeCloseTo(-1.8988, 4);
    expect(a?.percentile).toBeCloseTo(2.88, 2);
  });

  // WHO Child Growth Standards, weight-for-age z-score tables (kg).
  it.each([
    ['male', 0, [2.1, 2.5, 2.9, 3.3, 3.9, 4.4, 5.0]],
    ['female', 0, [2.0, 2.4, 2.8, 3.2, 3.7, 4.2, 4.8]],
    ['male', 365, [6.9, 7.7, 8.6, 9.6, 10.8, 12.0, 13.3]],
    ['female', 365, [6.3, 7.0, 7.9, 8.9, 10.1, 11.5, 13.1]],
  ] as const)('weight-for-age %s day %i matches published −3…+3 SD', (sex, day, published) => {
    published.forEach((kg, i) => {
      const g = valueAtZ(t.weight, 'weight', sex, day, i - 3);
      expect(Math.abs((g ?? 0) / 1000 - kg)).toBeLessThanOrEqual(WHO_ROUNDING);
    });
  });

  it('boys birth weight −2 SD = 2.5 kg and +2 SD = 4.4 kg', () => {
    expect((valueAtZ(t.weight, 'weight', 'male', 0, -2) ?? 0) / 1000).toBeCloseTo(2.5, 1);
    expect((valueAtZ(t.weight, 'weight', 'male', 0, 2) ?? 0) / 1000).toBeCloseTo(4.4, 1);
  });

  // WHO weight-for-age percentile tables (kg): P3, P15, P50, P85, P97.
  it.each([
    ['male', 0, [2.5, 2.9, 3.3, 3.9, 4.3]],
    ['female', 0, [2.4, 2.8, 3.2, 3.7, 4.2]],
  ] as const)('weight percentiles %s day %i match published P3…P97', (sex, day, published) => {
    CHART_PERCENTILES.forEach((p, i) => {
      const g = valueAtPercentile(t.weight, 'weight', sex, day, p);
      expect(Math.abs((g ?? 0) / 1000 - (published[i] ?? 0))).toBeLessThanOrEqual(WHO_ROUNDING);
    });
  });

  it('length & head circumference at birth match published ±2 SD (cm)', () => {
    const cm = (v: number | null) => (v ?? 0) / 10;
    expect(Math.abs(cm(valueAtZ(t.length, 'length', 'male', 0, -2)) - 46.1)).toBeLessThanOrEqual(
      WHO_ROUNDING,
    );
    expect(Math.abs(cm(valueAtZ(t.length, 'length', 'male', 0, 0)) - 49.9)).toBeLessThanOrEqual(
      WHO_ROUNDING,
    );
    expect(Math.abs(cm(valueAtZ(t.length, 'length', 'male', 0, 2)) - 53.7)).toBeLessThanOrEqual(
      WHO_ROUNDING,
    );
    expect(Math.abs(cm(valueAtZ(t.head, 'head', 'female', 0, -2)) - 31.5)).toBeLessThanOrEqual(
      WHO_ROUNDING,
    );
    expect(Math.abs(cm(valueAtZ(t.head, 'head', 'female', 0, 2)) - 36.2)).toBeLessThanOrEqual(
      WHO_ROUNDING,
    );
  });

  it('applies the restricted ±3 SD rule for weight only', () => {
    const sd3 = valueAtZ(t.weight, 'weight', 'male', 0, 3) ?? 0;
    const sd2 = valueAtZ(t.weight, 'weight', 'male', 0, 2) ?? 0;
    const x = 6000;
    expect(zScore(t.weight, 'weight', 'male', 0, x)).toBeCloseTo(3 + (x - sd3) / (sd3 - sd2), 10);
    // Length has L = 1 → linear anyway; z = (X/M − 1)/S.
    expect(zScore(t.length, 'length', 'male', 0, 600)).toBeCloseTo(
      (60 / 49.8842 - 1) / 0.03795,
      10,
    );
  });
});

describe('percentile helpers', () => {
  it('converts units', () => {
    expect(toWhoUnits('weight', 3500)).toBe(3.5);
    expect(toWhoUnits('length', 505)).toBe(50.5);
    expect(fromWhoUnits('weight', 3.5)).toBe(3500);
    expect(fromWhoUnits('head', 34.5)).toBe(345);
  });

  it('rejects out-of-range ages and invalid values', () => {
    expect(lmsAt(t.weight, 'male', -1)).toBeNull();
    expect(lmsAt(t.weight, 'male', 1827)).toBeNull();
    expect(lmsAt(t.weight, 'male', 10.5)).toBeNull();
    expect(zScore(t.weight, 'weight', 'male', 0, 0)).toBeNull();
    expect(zScore(t.weight, 'weight', 'male', 0, Number.NaN)).toBeNull();
    expect(assess(t.weight, 'weight', 'male', 2000, 3000)).toBeNull();
    expect(valueAtZ(t.weight, 'weight', 'male', 2000, 0)).toBeNull();
    expect(valueAtPercentile(t.weight, 'weight', 'male', 0, 0)).toBeNull();
    expect(valueAtPercentile(t.weight, 'weight', 'male', 0, 100)).toBeNull();
    expect(valueAtZ(t.length, 'length', 'male', 0, -40)).toBeNull(); // Box-Cox undefined
  });

  it('percentileFromZ', () => {
    expect(percentileFromZ(0)).toBe(50);
    expect(percentileFromZ(-1.880793608151251)).toBeCloseTo(3, 10);
  });

  it('formats percentiles compactly', () => {
    expect(formatPercentile(50.4)).toBe('50');
    expect(formatPercentile(2.34)).toBe('2.3');
    expect(formatPercentile(99.44)).toBe('99.4');
    expect(formatPercentile(0.05)).toBe('<0.1');
    expect(formatPercentile(99.95)).toBe('>99.9');
  });
});

describe('percentileCurves', () => {
  it('builds Recharts-ready rows with p3…p97 including both range ends', () => {
    const rows = percentileCurves(t.weight, 'weight', 'female', 0, 365, { step: 30 });
    expect(rows[0]?.ageDays).toBe(0);
    expect(rows[rows.length - 1]?.ageDays).toBe(365);
    expect(rows).toHaveLength(14); // 0,30,…,360 + 365
    const first = rows[0];
    expect(first?.p50).toBeCloseTo(3232.2, 6);
    expect(Object.keys(first ?? {}).sort()).toEqual(['ageDays', 'p15', 'p3', 'p50', 'p85', 'p97']);
    for (const r of rows) {
      const [p3, p15, p50, p85, p97] = [r.p3, r.p15, r.p50, r.p85, r.p97].map(
        (v) => v ?? Number.NaN,
      );
      expect(p3).toBeLessThan(p15 ?? Number.NaN);
      expect(p15).toBeLessThan(p50 ?? Number.NaN);
      expect(p50).toBeLessThan(p85 ?? Number.NaN);
      expect(p85).toBeLessThan(p97 ?? Number.NaN);
    }
  });

  it('uses an adaptive step, clamps to the WHO range, and supports custom percentiles', () => {
    const rows = percentileCurves(t.length, 'length', 'male', -10, 5000, { percentiles: [50] });
    expect(rows[0]?.ageDays).toBe(0);
    expect(rows[rows.length - 1]?.ageDays).toBe(1826);
    expect(rows.length).toBeGreaterThan(140);
    expect(rows.length).toBeLessThan(160);
    expect(Object.keys(rows[0] ?? {})).toEqual(['ageDays', 'p50']);
    expect(percentileCurves(t.length, 'length', 'male', 100, 50)).toEqual([]);
    expect(percentileCurves(t.head, 'head', 'male', 3, 3)).toHaveLength(1);
  });
});
