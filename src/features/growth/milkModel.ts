/**
 * Bottle-volume guideline for the Growth screen (0–6 months, weight known).
 */
import { dailyAggregates } from '../../domain/feeding';
import {
  expectedDailyMilk,
  suggestedPerFeedMl,
  typicalFeedsPerDay,
  type DailyMilkRange,
} from '../../domain/growth/milk';
import type { EpochMs, FeedingEntry } from '../../domain/types';

/** Days of history used to estimate the baby's own feeds per day. */
const HISTORY_DAYS = 7;
const MIN_DAYS_WITH_FEEDS = 3;

const roundTo10 = (ml: number): number => Math.round(ml / 10) * 10;

export interface MilkGuide {
  range: DailyMilkRange;
  feedsPerDay: number;
  /** 'history' = the baby's own average over the last complete days; 'typical' = age-based default. */
  feedsSource: 'history' | 'typical';
  perFeedMl: number;
}

export function milkGuide(
  weightG: number | undefined,
  ageDays: number,
  entries: readonly FeedingEntry[],
  now: EpochMs,
): MilkGuide | null {
  if (weightG === undefined) return null;
  const range = expectedDailyMilk(weightG, ageDays);
  if (!range) return null;
  // Complete days only: drop today's (partial) aggregate.
  const days = dailyAggregates(entries, HISTORY_DAYS + 1, now)
    .slice(0, -1)
    .filter((d) => d.feedCount > 0);
  const fromHistory = days.length >= MIN_DAYS_WITH_FEEDS;
  const feedsPerDay = fromHistory
    ? Math.max(1, Math.round(days.reduce((sum, d) => sum + d.feedCount, 0) / days.length))
    : typicalFeedsPerDay(ageDays);
  return {
    // Shown rounded to 10 ml — the guideline is approximate (design review P3-3).
    range: {
      ...range,
      minMl: roundTo10(range.minMl),
      typicalMl: roundTo10(range.typicalMl),
      maxMl: roundTo10(range.maxMl),
    },
    feedsPerDay,
    feedsSource: fromHistory ? 'history' : 'typical',
    perFeedMl: suggestedPerFeedMl(range.typicalMl, feedsPerDay), // 5 ml steps
  };
}
