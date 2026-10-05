/**
 * Weight gain calculations over a weight `GrowthPoint` series (grams; see series.ts).
 */
import type { GrowthPoint } from './series';

export interface WeightGain {
  from: GrowthPoint;
  to: GrowthPoint;
  days: number;
  deltaG: number;
  gPerDay: number;
  gPerWeek: number;
}

/** Gain between two weight points; `null` if they are on the same day or out of order. */
export function weightGainBetween(from: GrowthPoint, to: GrowthPoint): WeightGain | null {
  const days = to.ageDays - from.ageDays;
  if (days <= 0) return null;
  const deltaG = to.value - from.value;
  return { from, to, days, deltaG, gPerDay: deltaG / days, gPerWeek: (deltaG / days) * 7 };
}

/**
 * Gain from the most recent earlier point that is at least `minDays` before the latest point.
 * A minimum span (e.g. 7) avoids over-interpreting day-to-day scale noise.
 */
export function latestWeightGain(series: readonly GrowthPoint[], minDays = 1): WeightGain | null {
  const latest = series[series.length - 1];
  if (!latest) return null;
  for (let i = series.length - 2; i >= 0; i--) {
    const p = series[i];
    if (p && latest.ageDays - p.ageDays >= minDays) return weightGainBetween(p, latest);
  }
  return null;
}

/** Signed % change vs birth weight: 3000 → 2850 g gives −5. */
export function percentChangeFromBirth(birthWeightG: number, weightG: number): number {
  return ((weightG - birthWeightG) / birthWeightG) * 100;
}

export interface GainRange {
  fromDays: number;
  /** Exclusive upper bound. */
  toDays: number;
  minGPerWeek: number;
  maxGPerWeek: number;
}

/**
 * Typical weekly weight gain by age (rule-of-thumb ranges from PRD §1; cf. AAP HealthyChildren.org,
 * NHS / La Leche League guidance): 0–3 m ≈ 150–200 g/wk, 3–6 m ≈ 100–150 g/wk, 6–12 m ≈ 70–90 g/wk.
 * Months approximated as 91 / 183 / 365 days.
 */
export const TYPICAL_WEEKLY_GAIN: readonly GainRange[] = [
  { fromDays: 0, toDays: 91, minGPerWeek: 150, maxGPerWeek: 200 },
  { fromDays: 91, toDays: 183, minGPerWeek: 100, maxGPerWeek: 150 },
  { fromDays: 183, toDays: 365, minGPerWeek: 70, maxGPerWeek: 90 },
];

/** Typical gain range for an age, or `null` from 12 months on. */
export function typicalWeeklyGain(ageDays: number): GainRange | null {
  return TYPICAL_WEEKLY_GAIN.find((r) => ageDays >= r.fromDays && ageDays < r.toDays) ?? null;
}
