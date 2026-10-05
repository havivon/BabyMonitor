/**
 * Per-indicator measurement series (chronological, app units) and their WHO assessment.
 */
import { ageInDaysOn } from '../age';
import type { Baby, IsoDate, Measurement, Sex } from '../types';
import type { LmsTable } from './lms';
import { assess } from './percentiles';
import type { GrowthIndicator } from './who';

export interface GrowthPoint {
  date: IsoDate;
  ageDays: number;
  /** Grams for weight, millimetres for length / head circumference. */
  value: number;
  /** 'birth' = synthesized from `Baby.birthWeightG`. */
  source: 'birth' | 'measurement';
  measurementId?: string;
}

const FIELD: Record<GrowthIndicator, 'weightG' | 'lengthMm' | 'headMm'> = {
  weight: 'weightG',
  length: 'lengthMm',
  head: 'headMm',
};

/** The value of an indicator on a measurement, if recorded. */
export function measurementValue(m: Measurement, indicator: GrowthIndicator): number | undefined {
  return m[FIELD[indicator]];
}

/**
 * Chronological series for one indicator. For weight, the birth weight is included as a day-0
 * point unless a weight was measured on the birth date. When several measurements share a date,
 * the LAST one in input order wins. Measurements dated before birth are ignored.
 */
export function growthSeries(
  baby: Pick<Baby, 'birthDate' | 'birthWeightG'>,
  measurements: readonly Measurement[],
  indicator: GrowthIndicator,
): GrowthPoint[] {
  const byDate = new Map<IsoDate, GrowthPoint>();
  if (indicator === 'weight' && baby.birthWeightG !== undefined && baby.birthWeightG > 0) {
    byDate.set(baby.birthDate, {
      date: baby.birthDate,
      ageDays: 0,
      value: baby.birthWeightG,
      source: 'birth',
    });
  }
  for (const m of measurements) {
    const value = measurementValue(m, indicator);
    if (value === undefined || !(value > 0)) continue;
    const ageDays = ageInDaysOn(baby.birthDate, m.date);
    if (ageDays < 0) continue;
    byDate.set(m.date, {
      date: m.date,
      ageDays,
      value,
      source: 'measurement',
      measurementId: m.id,
    });
  }
  return [...byDate.values()].sort((a, b) => a.ageDays - b.ageDays);
}

export interface AssessedPoint extends GrowthPoint {
  /** `null` when outside the WHO age range. */
  z: number | null;
  percentile: number | null;
}

/** Adds z-score / percentile to each point (for chart tooltips and insights). */
export function assessSeries(
  points: readonly GrowthPoint[],
  table: LmsTable,
  indicator: GrowthIndicator,
  sex: Sex,
): AssessedPoint[] {
  return points.map((p) => {
    const a = assess(table, indicator, sex, p.ageDays, p.value);
    return { ...p, z: a?.z ?? null, percentile: a?.percentile ?? null };
  });
}
