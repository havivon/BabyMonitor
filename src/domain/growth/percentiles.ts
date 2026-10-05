/**
 * Percentile / z-score assessment against the WHO standards, in APP units
 * (weight in grams, length & head circumference in millimetres). Ages are completed days.
 */
import {
  lmsValue,
  lmsValueRestricted,
  lmsZ,
  lmsZRestricted,
  type LmsRow,
  type LmsTable,
} from './lms';
import { normalCdf, normalQuantile } from './normal';
import { WHO_MAX_AGE_DAYS, type GrowthIndicator } from './who';
import type { Sex } from '../types';

/** Percentile lines drawn on growth charts (WHO chart convention). */
export const CHART_PERCENTILES = [3, 15, 50, 85, 97] as const;
export type ChartPercentile = (typeof CHART_PERCENTILES)[number];

/** Only weight uses WHO's restricted ±3 SD adjustment (length/head have L = 1). */
const usesRestriction = (indicator: GrowthIndicator): boolean => indicator === 'weight';

/** App units (g / mm) → WHO table units (kg / cm). */
export function toWhoUnits(indicator: GrowthIndicator, value: number): number {
  return indicator === 'weight' ? value / 1000 : value / 10;
}
/** WHO table units (kg / cm) → app units (g / mm). */
export function fromWhoUnits(indicator: GrowthIndicator, value: number): number {
  return indicator === 'weight' ? value * 1000 : value * 10;
}

/** LMS row for a sex and age, or `null` outside 0..1826 days (or non-integer age). */
export function lmsAt(table: LmsTable, sex: Sex, ageDays: number): LmsRow | null {
  if (!Number.isInteger(ageDays) || ageDays < 0 || ageDays > WHO_MAX_AGE_DAYS) return null;
  return table[sex][ageDays] ?? null;
}

/** z-score of a measurement (app units), or `null` when out of the table's age range / invalid value. */
export function zScore(
  table: LmsTable,
  indicator: GrowthIndicator,
  sex: Sex,
  ageDays: number,
  value: number,
): number | null {
  const row = lmsAt(table, sex, ageDays);
  if (!row || !(value > 0) || !Number.isFinite(value)) return null;
  const x = toWhoUnits(indicator, value);
  return usesRestriction(indicator) ? lmsZRestricted(x, row) : lmsZ(x, row);
}

/** Percentile (0–100) for a z-score. */
export function percentileFromZ(z: number): number {
  return normalCdf(z) * 100;
}

export interface Assessment {
  z: number;
  /** 0–100 (not rounded). */
  percentile: number;
}

export function assess(
  table: LmsTable,
  indicator: GrowthIndicator,
  sex: Sex,
  ageDays: number,
  value: number,
): Assessment | null {
  const z = zScore(table, indicator, sex, ageDays, value);
  return z === null ? null : { z, percentile: percentileFromZ(z) };
}

/** Value (app units) at z-score `z`. */
export function valueAtZ(
  table: LmsTable,
  indicator: GrowthIndicator,
  sex: Sex,
  ageDays: number,
  z: number,
): number | null {
  const row = lmsAt(table, sex, ageDays);
  if (!row) return null;
  const v = usesRestriction(indicator) ? lmsValueRestricted(z, row) : lmsValue(z, row);
  return Number.isFinite(v) ? fromWhoUnits(indicator, v) : null;
}

/** Value (app units) at a percentile in (0, 100) — e.g. for drawing the P3…P97 curves. */
export function valueAtPercentile(
  table: LmsTable,
  indicator: GrowthIndicator,
  sex: Sex,
  ageDays: number,
  percentile: number,
): number | null {
  if (!(percentile > 0 && percentile < 100)) return null;
  return valueAtZ(table, indicator, sex, ageDays, normalQuantile(percentile / 100));
}

/** A chart row: `{ ageDays, p3, p15, p50, p85, p97 }` (values in app units). */
export type PercentileCurvePoint = { ageDays: number } & { [K in `p${number}`]: number };

export interface CurveOptions {
  percentiles?: readonly number[];
  /** Day step between points. Default: adaptive (~150 points over the range, min 1). */
  step?: number;
}

/**
 * Builds percentile curves for the age range [fromDay, toDay] (clamped to the WHO range). The last
 * day is always included so the curves reach the chart edge. Flat objects → Recharts-ready.
 */
export function percentileCurves(
  table: LmsTable,
  indicator: GrowthIndicator,
  sex: Sex,
  fromDay: number,
  toDay: number,
  options: CurveOptions = {},
): PercentileCurvePoint[] {
  const percentiles = options.percentiles ?? CHART_PERCENTILES;
  const start = Math.max(0, Math.floor(fromDay));
  const end = Math.min(WHO_MAX_AGE_DAYS, Math.ceil(toDay));
  if (end < start) return [];
  const step = Math.max(1, Math.round(options.step ?? (end - start) / 150));
  const zs = percentiles.map((p) => [p, normalQuantile(p / 100)] as const);
  const points: PercentileCurvePoint[] = [];
  const pushDay = (day: number): void => {
    const point: PercentileCurvePoint = { ageDays: day };
    for (const [p, z] of zs) {
      const v = valueAtZ(table, indicator, sex, day, z);
      if (v !== null) point[`p${p}`] = v;
    }
    points.push(point);
  };
  for (let day = start; day <= end; day += step) pushDay(day);
  if (points[points.length - 1]?.ageDays !== end) pushDay(end);
  return points;
}

/** Compact percentile label (no unit): "50", "2.3", "<0.1", ">99.9". */
export function formatPercentile(percentile: number): string {
  if (percentile < 0.1) return '<0.1';
  if (percentile > 99.9) return '>99.9';
  // One decimal in the clinically relevant tails (< P3, > P97), whole numbers elsewhere.
  if (percentile < 3 || percentile > 97) return (Math.round(percentile * 10) / 10).toString();
  return Math.round(percentile).toString();
}
