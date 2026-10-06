/**
 * Pure view-model for the Stats screen (DESIGN §7.8).
 *
 * Averages are per day over COMPLETE local days (today is excluded) and only over days on or after
 * the first-ever entry, so a baby who started being tracked mid-period is not under-counted.
 */
import {
  averageInterval,
  dailyAggregates,
  entryTime,
  type DailyAggregate,
} from '../../domain/feeding';
import { toDateKey } from '../../domain/dates';
import type { EpochMs, FeedingEntry } from '../../domain/types';
import { format } from 'date-fns';
import { he as heLocale } from 'date-fns/locale';
import { parseDateKey } from '../../domain/dates';

export const RANGE_OPTIONS = [7, 14, 30] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export interface PeriodSummary {
  /** Days in the period that are on/after the first entry (the averaging denominator). */
  activeDays: number;
  feedsPerDay: number | null;
  bottleMlPerDay: number | null;
  breastMinPerDay: number | null;
  avgIntervalMs: number | null;
}

export interface StatsSummary {
  current: PeriodSummary;
  previous: PeriodSummary;
}

const MS_PER_MINUTE = 60_000;

function firstEntryKey(entries: readonly FeedingEntry[]): string | null {
  let min = Number.POSITIVE_INFINITY;
  for (const e of entries) min = Math.min(min, entryTime(e));
  return Number.isFinite(min) ? toDateKey(min) : null;
}

function summarize(
  days: readonly DailyAggregate[],
  firstKey: string | null,
  entries: readonly FeedingEntry[],
  periodEnd: EpochMs,
): PeriodSummary {
  const active = firstKey === null ? [] : days.filter((d) => d.date >= firstKey);
  const n = active.length;
  const first = days[0];
  if (n === 0 || !first) {
    return {
      activeDays: 0,
      feedsPerDay: null,
      bottleMlPerDay: null,
      breastMinPerDay: null,
      avgIntervalMs: null,
    };
  }
  const sum = (f: (d: DailyAggregate) => number) => active.reduce((s, d) => s + f(d), 0);
  return {
    activeDays: n,
    feedsPerDay: sum((d) => d.feedCount) / n,
    bottleMlPerDay: sum((d) => d.bottleMl.total) / n,
    breastMinPerDay: sum((d) => d.breastMs.total) / MS_PER_MINUTE / n,
    avgIntervalMs: averageInterval(entries, periodEnd - 1, periodEnd - 1 - first.dayStart),
  };
}

/** Current period = the `range` complete days before today; previous = the `range` days before that. */
export function statsSummary(
  entries: readonly FeedingEntry[],
  range: RangeDays,
  now: EpochMs,
): StatsSummary {
  const all = dailyAggregates(entries, 2 * range + 1, now);
  const today = all[all.length - 1];
  const complete = all.slice(0, -1);
  const previousDays = complete.slice(0, range);
  const currentDays = complete.slice(range);
  const firstKey = firstEntryKey(entries);
  const currentStart = currentDays[0]?.dayStart ?? now;
  return {
    current: summarize(currentDays, firstKey, entries, today?.dayStart ?? now),
    previous: summarize(previousDays, firstKey, entries, currentStart),
  };
}

/** Difference current − previous, or null when either side has no data. */
export function delta(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous;
}

export interface ChartDay {
  date: string;
  label: string;
  isToday: boolean;
  breast: number;
  bottle: number;
  solid: number;
  bottleMl: number;
  rightMin: number;
  leftMin: number;
}

/** One row per day for the charts (the `range` days ending today, oldest first). */
export function chartDays(
  entries: readonly FeedingEntry[],
  range: RangeDays,
  now: EpochMs,
): ChartDay[] {
  const days = dailyAggregates(entries, range, now);
  return days.map((d, i) => {
    const isToday = i === days.length - 1;
    const date = parseDateKey(d.date);
    return {
      date: d.date,
      label: isToday
        ? 'היום'
        : range === 7
          ? format(date, 'EEEEE', { locale: heLocale })
          : format(date, 'd.M'),
      isToday,
      breast: d.breastCount,
      bottle: d.bottleCount,
      solid: d.solidCount,
      bottleMl: d.bottleMl.total,
      rightMin: Math.round(d.breastMs.right / MS_PER_MINUTE),
      leftMin: Math.round(d.breastMs.left / MS_PER_MINUTE),
    };
  });
}

/** Distinct local days that have at least one entry (the empty state needs ≥ 2). */
export function daysWithData(entries: readonly FeedingEntry[]): number {
  return new Set(entries.map((e) => toDateKey(entryTime(e)))).size;
}
