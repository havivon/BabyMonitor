/**
 * Pure feeding analytics. All "day" logic uses LOCAL calendar days (see dates.ts).
 *
 * Conventions (documented once, used everywhere):
 * - An entry's time is its START (`startedAt` for breast, `at` for bottle/solid). Day grouping,
 *   sorting, "last feed" and intervals all use the start time. A breastfeed that crosses midnight
 *   belongs entirely to the day it started.
 * - "Feeds" for counts and intervals are MILK feeds (breast + bottle). Solids are counted separately,
 *   since a solid meal is usually not a replacement for a milk feed in young infants.
 */
import { addDays, startOfDay } from 'date-fns';
import { toDateKey } from './dates';
import type {
  ActiveTimer,
  BottleContent,
  BreastEntry,
  BreastSegment,
  EpochMs,
  FeedingEntry,
  FeedingType,
  IsoDate,
  Side,
} from './types';

export const MILK_FEED_TYPES: readonly FeedingType[] = ['breast', 'bottle'];

export const otherSide = (side: Side): Side => (side === 'left' ? 'right' : 'left');

/** Start instant of an entry (sort / grouping key). */
export function entryTime(entry: FeedingEntry): EpochMs {
  return entry.type === 'breast' ? entry.startedAt : entry.at;
}

/** End instant of an entry (equals start for point-in-time entries). */
export function entryEndTime(entry: FeedingEntry): EpochMs {
  return entry.type === 'breast' ? entry.endedAt : entry.at;
}

export const isMilkFeed = (entry: FeedingEntry): boolean => entry.type !== 'solid';

/** Newest first; ties broken by id for a stable, deterministic order. */
export function compareEntriesDesc(a: FeedingEntry, b: FeedingEntry): number {
  return entryTime(b) - entryTime(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

export function sortEntriesDesc<T extends FeedingEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(compareEntriesDesc);
}

// ---------------------------------------------------------------- breast durations

export interface SideDurations {
  left: number;
  right: number;
  total: number;
}

/** Per-side and total suckling time (ms) of a breastfeed, summed from its segments (gaps excluded). */
export function breastDurations(entry: Pick<BreastEntry, 'segments'>): SideDurations {
  const out: SideDurations = { left: 0, right: 0, total: 0 };
  for (const seg of entry.segments) {
    const d = Math.max(0, seg.endedAt - seg.startedAt);
    out[seg.side] += d;
    out.total += d;
  }
  return out;
}

/** The chronologically last non-empty segment, or `null`. */
export function lastSegmentOf(entry: Pick<BreastEntry, 'segments'>): BreastSegment | null {
  let last: BreastSegment | null = null;
  for (const seg of entry.segments) {
    if (seg.endedAt <= seg.startedAt) continue;
    if (!last || seg.startedAt >= last.startedAt) last = seg;
  }
  return last;
}

/**
 * Total time of the final run of consecutive same-side segments — a pause splits one side into
 * several segments, and "left 3 min ‖ pause ‖ left 1 min" is a 4-minute final run, not 1 minute.
 */
export function lastSideRunMs(entry: Pick<BreastEntry, 'segments'>): number {
  const segs = entry.segments
    .filter((s) => s.endedAt > s.startedAt)
    .sort((a, b) => a.startedAt - b.startedAt);
  const side = segs[segs.length - 1]?.side;
  let total = 0;
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i];
    if (!seg || seg.side !== side) break;
    total += seg.endedAt - seg.startedAt;
  }
  return total;
}

/** The side of the chronologically last non-empty segment, or `null`. */
export function lastSideOf(entry: Pick<BreastEntry, 'segments'>): Side | null {
  return lastSegmentOf(entry)?.side ?? null;
}

// ---------------------------------------------------------------- last feed / next side

/** Most recent entry (by start time), optionally restricted to some types. */
export function lastFeed(
  entries: readonly FeedingEntry[],
  types: readonly FeedingType[] = MILK_FEED_TYPES,
): FeedingEntry | null {
  let best: FeedingEntry | null = null;
  for (const e of entries) {
    if (!types.includes(e.type)) continue;
    if (!best || compareEntriesDesc(e, best) < 0) best = e;
  }
  return best;
}

/**
 * A final segment shorter than this was probably not finished (baby fell asleep / was unlatched),
 * so the same side is suggested again (DESIGN.md §6.17).
 */
export const UNFINISHED_SEGMENT_MS = 2 * 60_000;

export interface SideSuggestion {
  side: Side;
  /** Side the previous breastfeed finished on. */
  lastSide: Side;
  /** The breastfeed the suggestion is based on. */
  basedOnEntryId: string;
}

/**
 * Next-side rule: take the most recent breastfeed (by start time) that has at least one non-empty
 * segment, find its LAST segment (the side the baby finished on), and suggest the OTHER side. This
 * covers both "ended on X → start on the other" and "only one side used → offer the other".
 * Exception: when the final run on that side (pause-split segments summed) lasted under 2 minutes
 * it was probably not finished, so the SAME side is suggested again. Returns `null` when there is no usable breastfeed history.
 */
export function suggestNextSide(entries: readonly FeedingEntry[]): SideSuggestion | null {
  const breastfeeds = entries
    .filter((e): e is BreastEntry => e.type === 'breast')
    .sort(compareEntriesDesc);
  for (const entry of breastfeeds) {
    const last = lastSegmentOf(entry);
    if (!last) continue;
    // Measure the whole final same-side run, so a pause on the last side doesn't count as "short".
    const unfinished = lastSideRunMs(entry) < UNFINISHED_SEGMENT_MS;
    return {
      side: unfinished ? last.side : otherSide(last.side),
      lastSide: last.side,
      basedOnEntryId: entry.id,
    };
  }
  return null;
}

// ---------------------------------------------------------------- daily totals

export interface DayTotals {
  /** Milk feeds (breast + bottle). */
  feedCount: number;
  breastCount: number;
  bottleCount: number;
  solidCount: number;
  bottleMl: Record<BottleContent, number> & { total: number };
  breastMs: SideDurations;
}

export function emptyDayTotals(): DayTotals {
  return {
    feedCount: 0,
    breastCount: 0,
    bottleCount: 0,
    solidCount: 0,
    bottleMl: { breastmilk: 0, formula: 0, total: 0 },
    breastMs: { left: 0, right: 0, total: 0 },
  };
}

function accumulate(t: DayTotals, e: FeedingEntry): void {
  switch (e.type) {
    case 'breast': {
      const d = breastDurations(e);
      t.feedCount++;
      t.breastCount++;
      t.breastMs.left += d.left;
      t.breastMs.right += d.right;
      t.breastMs.total += d.total;
      break;
    }
    case 'bottle':
      t.feedCount++;
      t.bottleCount++;
      t.bottleMl[e.content] += e.amountMl;
      t.bottleMl.total += e.amountMl;
      break;
    case 'solid':
      t.solidCount++;
      break;
  }
}

/** Sums entries into totals (no day filtering). */
export function totalsOf(entries: readonly FeedingEntry[]): DayTotals {
  const t = emptyDayTotals();
  for (const e of entries) accumulate(t, e);
  return t;
}

/** Totals for the local calendar day containing `day`. */
export function dayTotals(entries: readonly FeedingEntry[], day: EpochMs | Date): DayTotals {
  const key = toDateKey(day);
  return totalsOf(entries.filter((e) => toDateKey(entryTime(e)) === key));
}

/** Totals for "today" (local day of `now`). */
export const todayTotals = (entries: readonly FeedingEntry[], now: EpochMs): DayTotals =>
  dayTotals(entries, now);

// ---------------------------------------------------------------- intervals

/**
 * Mean gap (ms) between consecutive feed START times, over feeds that started within
 * `[now − windowMs, now]`. Returns `null` with fewer than two feeds in the window.
 */
export function averageInterval(
  entries: readonly FeedingEntry[],
  now: EpochMs,
  windowMs: number,
  types: readonly FeedingType[] = MILK_FEED_TYPES,
): number | null {
  const from = now - windowMs;
  const times = entries
    .filter((e) => types.includes(e.type))
    .map(entryTime)
    .filter((t) => t >= from && t <= now)
    .sort((a, b) => a - b);
  return meanGap(times);
}

function meanGap(sortedTimes: readonly number[]): number | null {
  const first = sortedTimes[0];
  const last = sortedTimes[sortedTimes.length - 1];
  if (sortedTimes.length < 2 || first === undefined || last === undefined) return null;
  return (last - first) / (sortedTimes.length - 1);
}

// ---------------------------------------------------------------- per-day series & grouping

export interface DailyAggregate extends DayTotals {
  date: IsoDate;
  /** Local midnight that starts the day. */
  dayStart: EpochMs;
  /** Mean gap between milk feeds started that day, or `null` with < 2 feeds. */
  avgIntervalMs: number | null;
}

/**
 * One aggregate per local calendar day for the `days` days ending with the day of `now`
 * (oldest first, so it can feed a chart directly). Days without entries are zero-filled.
 */
export function dailyAggregates(
  entries: readonly FeedingEntry[],
  days: number,
  now: EpochMs,
): DailyAggregate[] {
  if (days <= 0) return [];
  const byDay = new Map<IsoDate, FeedingEntry[]>();
  for (const e of entries) {
    const key = toDateKey(entryTime(e));
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }
  const today = startOfDay(now);
  const out: DailyAggregate[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = addDays(today, -i);
    const date = toDateKey(dayStart);
    const dayEntries = byDay.get(date) ?? [];
    const milkTimes = dayEntries
      .filter(isMilkFeed)
      .map(entryTime)
      .sort((a, b) => a - b);
    out.push({
      ...totalsOf(dayEntries),
      date,
      dayStart: dayStart.getTime(),
      avgIntervalMs: meanGap(milkTimes),
    });
  }
  return out;
}

export interface DayGroup<T extends FeedingEntry = FeedingEntry> {
  date: IsoDate;
  entries: T[];
}

/** Groups entries by local day of their start time — newest day first, newest entry first. */
export function groupByDay<T extends FeedingEntry>(entries: readonly T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const e of sortEntriesDesc(entries)) {
    const date = toDateKey(entryTime(e));
    const current = groups[groups.length - 1];
    if (current?.date === date) current.entries.push(e);
    else groups.push({ date, entries: [e] });
  }
  return groups;
}

// ---------------------------------------------------------------- feeding mode

/** Window for the "mainly bottle-fed" rule: no breastfeed within the last 72 h. */
export const MAINLY_BOTTLE_FED_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * "Mainly bottle-fed" (DESIGN §6.20 / §14.3, Team Lead decision 3): at least one bottle and NO
 * breastfeed started within the last 72 h, and no breastfeeding timer running. Only then is an
 * ml/kg/day guideline shown — mixed feeding never gets an ml target.
 * Entries after `now` (clock skew, future-dated) are ignored.
 */
export function isMainlyBottleFed(
  entries: readonly FeedingEntry[],
  now: EpochMs,
  activeTimer?: ActiveTimer | null,
): boolean {
  if (activeTimer) return false;
  const since = now - MAINLY_BOTTLE_FED_WINDOW_MS;
  let bottle = false;
  for (const e of entries) {
    const t = entryTime(e);
    if (t < since || t > now) continue;
    if (e.type === 'breast') return false;
    if (e.type === 'bottle') bottle = true;
  }
  return bottle;
}
