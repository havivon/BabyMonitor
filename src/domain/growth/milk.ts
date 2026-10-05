/**
 * Bottle-feeding volume guideline for infants 0–6 months (rule of thumb, NOT medical advice):
 * ≈ 150 ml per kg body weight per day, typical range 120–180 ml/kg/day, rarely more than ~1000 ml/day.
 * Sources: e.g. NHS "Bottle feeding advice" (150–200 ml/kg/day early weeks), AAP HealthyChildren.org
 * "Amount and Schedule of Baby Formula Feedings" (≈ 2.5 oz/lb/day, max ~32 oz/day). Values per PRD §1.
 * Beyond ~6 months solids are introduced and per-kg milk estimates stop being meaningful.
 */

export const MILK_ML_PER_KG_PER_DAY = { min: 120, typical: 150, max: 180 } as const;
/** Upper cap on daily milk intake (≈ 32 oz). */
export const MAX_DAILY_MILK_ML = 1000;
/** Guideline applies below this age (≈ 6 months). */
export const MILK_GUIDELINE_MAX_AGE_DAYS = 183;

export interface DailyMilkRange {
  minMl: number;
  typicalMl: number;
  maxMl: number;
  /** True if any bound was limited by `MAX_DAILY_MILK_ML`. */
  capped: boolean;
}

/** Expected daily milk range (whole ml) for a weight, or `null` when the guideline does not apply. */
export function expectedDailyMilk(weightG: number, ageDays: number): DailyMilkRange | null {
  if (!(weightG > 0) || ageDays < 0 || ageDays >= MILK_GUIDELINE_MAX_AGE_DAYS) return null;
  const kg = weightG / 1000;
  const raw = {
    minMl: kg * MILK_ML_PER_KG_PER_DAY.min,
    typicalMl: kg * MILK_ML_PER_KG_PER_DAY.typical,
    maxMl: kg * MILK_ML_PER_KG_PER_DAY.max,
  };
  const cap = (v: number): number => Math.round(Math.min(v, MAX_DAILY_MILK_ML));
  return {
    minMl: cap(raw.minMl),
    typicalMl: cap(raw.typicalMl),
    maxMl: cap(raw.maxMl),
    capped: raw.maxMl > MAX_DAILY_MILK_ML,
  };
}

/**
 * Typical number of milk feeds per day by age (fallback when the baby's own history is short):
 * newborns 8–12 (→ 8), 1–3 months ≈ 7, 3–6 months ≈ 6. Source: AAP HealthyChildren.org feeding schedules.
 */
export function typicalFeedsPerDay(ageDays: number): number {
  if (ageDays < 30) return 8;
  if (ageDays < 91) return 7;
  return 6;
}

/** Suggested amount per feed = daily / feeds-per-day, rounded to the nearest 5 ml. */
export function suggestedPerFeedMl(dailyMl: number, feedsPerDay: number): number {
  if (!(feedsPerDay > 0) || !(dailyMl > 0)) return 0;
  return Math.round(dailyMl / feedsPerDay / 5) * 5;
}
