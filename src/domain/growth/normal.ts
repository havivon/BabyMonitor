/**
 * Standard normal distribution helpers.
 *
 * `normalCdf` uses Hart's double-precision algorithm 5666 as published by G. West,
 * "Better approximations to cumulative normal functions", Wilmott Magazine (2005).
 * Absolute error < 1e-14 across the real line (requirement: < 1e-7).
 *
 * `normalQuantile` uses P. J. Acklam's rational approximation (rel. error 1.15e-9) refined by one
 * Halley step against `normalCdf`, giving close to full double precision.
 */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Φ(x): P(Z ≤ x) for a standard normal Z. */
export function normalCdf(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  const ax = Math.abs(x);
  let c: number;
  if (ax > 37) {
    c = 0;
  } else {
    const e = Math.exp(-(ax * ax) / 2);
    if (ax < 7.07106781186547) {
      let num = 3.52624965998911e-2 * ax + 0.700383064443688;
      num = num * ax + 6.37396220353165;
      num = num * ax + 33.912866078383;
      num = num * ax + 112.079291497871;
      num = num * ax + 221.213596169931;
      num = num * ax + 220.206867912376;
      let den = 8.83883476483184e-2 * ax + 1.75566716318264;
      den = den * ax + 16.064177579207;
      den = den * ax + 86.7807322029461;
      den = den * ax + 296.564248779674;
      den = den * ax + 637.333633378831;
      den = den * ax + 793.826512519948;
      den = den * ax + 440.413735824752;
      c = (e * num) / den;
    } else {
      let b = ax + 0.65;
      b = ax + 4 / b;
      b = ax + 3 / b;
      b = ax + 2 / b;
      b = ax + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
] as const;
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
] as const;
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
] as const;
const D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
] as const;
const P_LOW = 0.02425;

function tail(q: number): number {
  return (
    (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
    ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1)
  );
}

/** Φ⁻¹(p): the z with Φ(z) = p. Returns ±Infinity at 0/1 and NaN outside [0, 1]. */
export function normalQuantile(p: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return Number.NaN;
  if (p === 0) return Number.NEGATIVE_INFINITY;
  if (p === 1) return Number.POSITIVE_INFINITY;
  let x: number;
  if (p < P_LOW) {
    x = tail(Math.sqrt(-2 * Math.log(p)));
  } else if (p <= 1 - P_LOW) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) /
      (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  } else {
    x = -tail(Math.sqrt(-2 * Math.log(1 - p)));
  }
  // One Halley refinement step.
  const e = normalCdf(x) - p;
  const u = e * SQRT_2PI * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
