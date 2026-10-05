/**
 * When and what to show in Home's "daily bottle amount" guideline card (DESIGN §6.20 / §7.2).
 * Pure: all medical-adjacent numbers come from `domain/growth/milk`.
 */
import { ageInDays } from '../../domain/age';
import { MS_PER_HOUR } from '../../domain/dates';
import { dailyAggregates, entryTime, todayTotals } from '../../domain/feeding';
import {
  expectedDailyMilk,
  suggestedPerFeedMl,
  typicalFeedsPerDay,
  type DailyMilkRange,
} from '../../domain/growth/milk';
import type { Baby, EpochMs, FeedingEntry, Measurement } from '../../domain/types';

/** "Mainly bottle-fed" = no breastfeed logged within this window (and at least one bottle). */
export const BOTTLE_ONLY_WINDOW_MS = 72 * MS_PER_HOUR;

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
 * The guideline applies only to a mainly bottle-fed baby (no breastfeed in 72 h, ≥ 1 bottle in
 * 72 h, no running breastfeeding timer) under ~6 months with a known weight. Returns `null`
 * otherwise, so mixed feeding never gets an ml target (DESIGN §14.3).
 */
export function milkGuide(input: {
  baby: Baby;
  entries: readonly FeedingEntry[];
  measurements: readonly Measurement[];
  hasActiveTimer: boolean;
  now: EpochMs;
}): MilkGuide | null {
  const { baby, entries, measurements, hasActiveTimer, now } = input;
  if (hasActiveTimer) return null;
  const weightG = latestWeightG(baby, measurements);
  if (weightG === null) return null;
  const ageDays = ageInDays(baby.birthDate, now);
  const range = expectedDailyMilk(weightG, ageDays);
  if (!range) return null;

  const since = now - BOTTLE_ONLY_WINDOW_MS;
  let bottle = false;
  for (const e of entries) {
    const t = entryTime(e);
    if (t < since || t > now) continue;
    if (e.type === 'breast') return null;
    if (e.type === 'bottle') bottle = true;
  }
  if (!bottle) return null;

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
