/**
 * Baby age helpers. `birthDate` is a LOCAL calendar date (`YYYY-MM-DD`); ages are counted in
 * local calendar days, so they are immune to DST (23/25-hour days) and to UTC parsing pitfalls.
 */
import { addMonths, differenceInCalendarDays, differenceInMonths, startOfDay } from 'date-fns';
import { parseDateKey } from './dates';
import type { EpochMs, IsoDate } from './types';

/** Completed local calendar days since birth (0 on the birth date). Negative if `birthDate` is in the future. */
export function ageInDays(birthDate: IsoDate, now: EpochMs | Date): number {
  return differenceInCalendarDays(startOfDay(now), parseDateKey(birthDate));
}

/** Age in days on a given calendar date (e.g. a measurement date). */
export function ageInDaysOn(birthDate: IsoDate, date: IsoDate): number {
  return differenceInCalendarDays(parseDateKey(date), parseDateKey(birthDate));
}

export interface AgeParts {
  totalDays: number;
  /** Completed calendar months (date-fns semantics: Jan 31 → Feb 28 counts as one month). */
  totalMonths: number;
  years: number;
  /** Months beyond the completed years (0–11). */
  months: number;
  /** Days beyond the completed months. */
  days: number;
  /** Completed weeks and leftover days, from `totalDays`. */
  weeks: number;
  daysOfWeek: number;
}

/** Breaks an age down into calendar parts. Returns `null` if `now` is before the birth date. */
export function ageParts(birthDate: IsoDate, now: EpochMs | Date): AgeParts | null {
  const birth = parseDateKey(birthDate);
  const today = startOfDay(now);
  const totalDays = differenceInCalendarDays(today, birth);
  if (totalDays < 0) return null;
  const totalMonths = differenceInMonths(today, birth);
  return {
    totalDays,
    totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: differenceInCalendarDays(today, addMonths(birth, totalMonths)),
    weeks: Math.floor(totalDays / 7),
    daysOfWeek: totalDays % 7,
  };
}

// ---- Hebrew phrasing (standalone dual forms: יומיים/שבועיים/חודשיים/שנתיים)

function daysPhrase(n: number): string {
  if (n === 1) return 'יום אחד';
  if (n === 2) return 'יומיים';
  return `${n} ימים`;
}
function weeksPhrase(n: number): string {
  if (n === 1) return 'שבוע';
  if (n === 2) return 'שבועיים';
  return `${n} שבועות`;
}
function monthsPhrase(n: number): string {
  if (n === 1) return 'חודש';
  if (n === 2) return 'חודשיים';
  return `${n} חודשים`;
}
function yearsPhrase(n: number): string {
  if (n === 1) return 'שנה';
  if (n === 2) return 'שנתיים';
  return `${n} שנים`;
}
/** Conjunction form: "ויום" / "וחודש" for one, otherwise "ו-2 ימים". */
function andUnit(n: number, one: string, many: string): string {
  return n === 1 ? ` ו${one}` : ` ו-${n} ${many}`;
}

/**
 * Human Hebrew age:
 * - day 0 → "היום הראשון"; 1–13 days → "יום אחד" / "יומיים" / "5 ימים"
 * - from 14 days until 2 completed months → weeks (+days): "3 שבועות ו-2 ימים", "שבועיים ויום"
 * - 2–11 months → "חודשיים", "4 חודשים"
 * - ≥ 1 year → "שנה", "שנה ו-2 חודשים", "שנתיים וחודש"
 * Returns an empty string for a future birth date.
 */
export function formatAge(birthDate: IsoDate, now: EpochMs | Date): string {
  const p = ageParts(birthDate, now);
  if (!p) return '';
  if (p.totalDays === 0) return 'היום הראשון';
  if (p.totalDays < 14) return daysPhrase(p.totalDays);
  if (p.totalMonths < 2) {
    return weeksPhrase(p.weeks) + (p.daysOfWeek ? andUnit(p.daysOfWeek, 'יום', 'ימים') : '');
  }
  if (p.years === 0) return monthsPhrase(p.totalMonths);
  return yearsPhrase(p.years) + (p.months ? andUnit(p.months, 'חודש', 'חודשים') : '');
}
