/**
 * Local-calendar date helpers. Every "day" in the app is a LOCAL calendar day of the device's
 * timezone. `YYYY-MM-DD` strings are parsed component-wise into local midnight — never via
 * `new Date('YYYY-MM-DD')`, which JavaScript interprets as UTC midnight.
 */
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import type { EpochMs, IsoDate } from './types';

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export { MS_PER_MINUTE };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** True for a syntactically valid AND real calendar date (rejects 2025-02-30). */
export function isValidDateKey(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = DATE_KEY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Parses `YYYY-MM-DD` to a Date at LOCAL midnight. Throws on invalid input. */
export function parseDateKey(key: IsoDate): Date {
  if (!isValidDateKey(key)) throw new RangeError(`Invalid date key: ${String(key)}`);
  const [y, mo, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, mo - 1, d);
}

/** Local calendar date key (`YYYY-MM-DD`) of an instant / Date. */
export function toDateKey(at: EpochMs | Date): IsoDate {
  const d = typeof at === 'number' ? new Date(at) : at;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Epoch ms of local midnight starting the day containing `at`. */
export function startOfLocalDay(at: EpochMs | Date): EpochMs {
  return startOfDay(at).getTime();
}

/** Epoch ms of local midnight starting the day after the one containing `at` (DST-aware). */
export function startOfNextLocalDay(at: EpochMs | Date): EpochMs {
  return addDays(startOfDay(at), 1).getTime();
}

/** Adds whole calendar days to a date key (DST-safe). */
export function addDaysToKey(key: IsoDate, days: number): IsoDate {
  return toDateKey(addDays(parseDateKey(key), days));
}

/** Calendar-day difference `later − earlier` between two date keys. */
export function daysBetweenKeys(earlier: IsoDate, later: IsoDate): number {
  return differenceInCalendarDays(parseDateKey(later), parseDateKey(earlier));
}

/** Local `HH:mm` of an instant. */
export function formatClock(at: EpochMs): string {
  const d = new Date(at);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
