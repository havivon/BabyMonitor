/**
 * LMS method (Cole & Green 1992) as used by the WHO Child Growth Standards (2006).
 *
 *   z = ((X/M)^L − 1) / (L·S)      (L ≠ 0)
 *   z = ln(X/M) / S                (L = 0)
 *   X(z) = M·(1 + L·S·z)^(1/L)
 *
 * For weight-based indicators WHO applies a "restricted application" beyond ±3 SD, because the
 * LMS curves are not reliable in the tails (WHO Child Growth Standards: Methods and development,
 * 2006, chapter 7 / anthro `z_score` implementation):
 *
 *   z > 3:  z* = 3 + (X − SD3pos) / SD23pos,   SD23pos = SD3pos − SD2pos
 *   z < −3: z* = −3 + (X − SD3neg) / SD23neg,  SD23neg = SD2neg − SD3neg
 *
 * where SDk = X(k). Length/height and head circumference use L = 1 (normal), so no adjustment.
 */

/** One row of an LMS table: [L (Box-Cox power), M (median), S (coefficient of variation)]. */
export type LmsRow = readonly [l: number, m: number, s: number];

/** LMS rows indexed by age in completed days, per sex. */
export interface LmsTable {
  readonly male: readonly LmsRow[];
  readonly female: readonly LmsRow[];
}

const L_EPSILON = 1e-12;

/** Unrestricted LMS z-score. */
export function lmsZ(x: number, [l, m, s]: LmsRow): number {
  if (Math.abs(l) < L_EPSILON) return Math.log(x / m) / s;
  return (Math.pow(x / m, l) - 1) / (l * s);
}

/** Measurement value at z-score `z` (unrestricted). NaN where the Box-Cox transform is undefined. */
export function lmsValue(z: number, [l, m, s]: LmsRow): number {
  if (Math.abs(l) < L_EPSILON) return m * Math.exp(s * z);
  const base = 1 + l * s * z;
  return base > 0 ? m * Math.pow(base, 1 / l) : Number.NaN;
}

/** z-score with WHO's restricted application beyond ±3 SD (use for weight-for-age). */
export function lmsZRestricted(x: number, row: LmsRow): number {
  const z = lmsZ(x, row);
  if (z > 3) {
    const sd3 = lmsValue(3, row);
    const sd23 = sd3 - lmsValue(2, row);
    return 3 + (x - sd3) / sd23;
  }
  if (z < -3) {
    const sd3 = lmsValue(-3, row);
    const sd23 = lmsValue(-2, row) - sd3;
    return -3 + (x - sd3) / sd23;
  }
  return z;
}

/** Inverse of `lmsZRestricted`: value at `z`, linear beyond ±3 SD. */
export function lmsValueRestricted(z: number, row: LmsRow): number {
  if (z > 3) {
    const sd3 = lmsValue(3, row);
    return sd3 + (z - 3) * (sd3 - lmsValue(2, row));
  }
  if (z < -3) {
    const sd3 = lmsValue(-3, row);
    return sd3 + (z + 3) * (lmsValue(-2, row) - sd3);
  }
  return lmsValue(z, row);
}
