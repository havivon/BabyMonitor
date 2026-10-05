import { describe, expect, it } from 'vitest';
import { normalCdf, normalQuantile } from './normal';

/** High-precision reference values of Φ(x) (mpmath, rounded to double precision). */
const CDF_REFERENCE: [number, number][] = [
  [0, 0.5],
  [0.5, 0.6914624612740131],
  [1, 0.8413447460685429],
  [-1, 0.15865525393145707],
  [1.96, 0.9750021048517795],
  [-1.96, 0.024997895148220435],
  [2.5, 0.9937903346742238],
  [3, 0.9986501019683699],
  [-3, 0.0013498980316301],
  [-1.880793608151251, 0.03],
  [6.5, 0.99999999995984],
  [-8, 6.220960574271784e-16],
];

describe('normalCdf', () => {
  it.each(CDF_REFERENCE)('Φ(%d) has absolute error < 1e-12', (x, expected) => {
    expect(Math.abs(normalCdf(x) - expected)).toBeLessThan(1e-12);
  });

  it('is accurate in the far tail (relative error)', () => {
    expect(normalCdf(-5) / 2.866515718791939e-7).toBeCloseTo(1, 9);
    expect(normalCdf(-10) / 7.6198530241605e-24).toBeCloseTo(1, 7);
  });

  it('handles extremes and NaN', () => {
    expect(normalCdf(-40)).toBe(0);
    expect(normalCdf(40)).toBe(1);
    expect(normalCdf(Number.NaN)).toBeNaN();
  });

  it('is symmetric: Φ(x) + Φ(−x) = 1', () => {
    for (let x = -6; x <= 6; x += 0.37) {
      expect(normalCdf(x) + normalCdf(-x)).toBeCloseTo(1, 14);
    }
  });
});

describe('normalQuantile', () => {
  it.each([
    [0.5, 0],
    [0.975, 1.959963984540054],
    [0.03, -1.880793608151251],
    [0.97, 1.880793608151251],
    [0.15, -1.0364333894937898],
    [0.85, 1.0364333894937898],
    [0.001, -3.090232306167813],
  ])('Φ⁻¹(%d) = %d', (p, z) => {
    expect(normalQuantile(p)).toBeCloseTo(z, 12);
  });

  it('round-trips with normalCdf across (0,1) including the tails', () => {
    for (const p of [1e-10, 1e-5, 0.01, 0.02425, 0.1, 0.3, 0.7, 0.9, 0.97575, 0.999, 1 - 1e-9]) {
      expect(normalCdf(normalQuantile(p)) / p).toBeCloseTo(1, 9);
    }
  });

  it('handles boundaries and invalid input', () => {
    expect(normalQuantile(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(normalQuantile(1)).toBe(Number.POSITIVE_INFINITY);
    expect(normalQuantile(-0.1)).toBeNaN();
    expect(normalQuantile(1.1)).toBeNaN();
    expect(normalQuantile(Number.NaN)).toBeNaN();
  });
});
