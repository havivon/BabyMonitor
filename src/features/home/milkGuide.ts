/**
 * When and what to show in Home's "daily bottle amount" guideline card (DESIGN §6.20 / §7.2).
 * Pure: all medical-adjacent numbers come from `domain/growth/milk`.
 */
import { ageInDays } from '../../domain/age';
import { dailyAggregates, isMainlyBottleFed, todayTotals } from '../../domain/feeding';
import {
  expectedDailyMilk,
  suggestedPerFeedMl,
  typicalFeedsPerDay,
  type DailyMilkRange,
} from '../../domain/growth/milk';
import type { ActiveTimer, Baby, EpochMs, FeedingEntry, Measurement } from '../../domain/types';

export interface MilkGuide {
  range: DailyMilkRange;
  todayMl: number;
  perFeedMl: number;
  feedsPerDay: number;
  weightG: number;
}

/** Latest recorded weight (measurements are oldest-first), falling back to the birth weight. */
export function latestWeightG(baby: Baby, measurements: readonly Measurement[]): number | null {
  for (let i = measurements.length - 1; i >= 0; i--) {
    const w = measurements[i]?.weightG;
    if (w !== undefined && w > 0) return w;
  }
  return baby.birthWeightG ?? null;
}

/**
 * The guideline applies only to a mainly bottle-fed baby (shared domain rule `isMainlyBottleFed`:
 * no breastfeed in 72 h, ≥ 1 bottle, no running timer) under ~6 months with a known weight. Returns `null`
 * otherwise, so mixed feeding never gets an ml target (DESIGN §14.3).
 */
export function milkGuide(input: {
  baby: Baby;
  entries: readonly FeedingEntry[];
  measurements: readonly Measurement[];
  activeTimer: ActiveTimer | null;
  now: EpochMs;
}): MilkGuide | null {
  const { baby, entries, measurements, activeTimer, now } = input;
  if (!isMainlyBottleFed(entries, now, activeTimer)) return null;
  const weightG = latestWeightG(baby, measurements);
  if (weightG === null) return null;
  const ageDays = ageInDays(baby.birthDate, now);
  const range = expectedDailyMilk(weightG, ageDays);
  if (!range) return null;

  // Feeds per day: the baby's own bottle count over the last 3 complete days, else the age norm.
  const days = dailyAggregates(entries, 4, now)
    .slice(0, 3)
    .filter((d) => d.bottleCount > 0);
  const own = days.length ? days.reduce((s, d) => s + d.bottleCount, 0) / days.length : 0;
  const feedsPerDay = own >= 1 ? Math.round(own) : typicalFeedsPerDay(ageDays);

  return {
    range,
    todayMl: todayTotals(entries, now).bottleMl.total,
    perFeedMl: suggestedPerFeedMl(range.typicalMl, feedsPerDay),
    feedsPerDay,
    weightG,
  };
}
