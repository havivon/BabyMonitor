/**
 * Hebrew presentation formatting for the UI (DESIGN.md §8.3). Pure functions over domain values;
 * domain math (durations, units, ages) stays in `src/domain` — this file only phrases it.
 */
import { format } from 'date-fns';
import { he as heLocale } from 'date-fns/locale';
import {
  addDaysToKey,
  formatClock,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  parseDateKey,
  toDateKey,
} from '../domain/dates';
import { formatNumber, mlToOz, volumeFromMl } from '../domain/units';
import type { EpochMs, IsoDate, VolumeUnit } from '../domain/types';
import { he } from './he';

const WEEKDAY_SHORT = ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'] as const;

/** "יום ב׳" (Saturday reads "שבת"). */
export function weekdayShort(date: Date): string {
  return WEEKDAY_SHORT[date.getDay()] ?? '';
}

/** "5 באוקטובר" — adds the year when it is not the current one. */
export function dayMonth(date: Date, now: EpochMs = Date.now()): string {
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return format(date, sameYear ? 'd בMMMM' : 'd בMMMM yyyy', { locale: heLocale });
}

/** "1 ביולי 2026" — always with the year (birth dates, measurement dates). */
export function dayMonthYear(date: Date): string {
  return format(date, 'd בMMMM yyyy', { locale: heLocale });
}

/** Relative day name for a date key: "היום" / "אתמול" / null. */
export function relativeDayName(key: IsoDate, now: EpochMs): string | null {
  const today = toDateKey(now);
  if (key === today) return he.common.today;
  if (key === addDaysToKey(today, -1)) return he.common.yesterday;
  return null;
}

/** Timeline day header: "היום · יום ב׳, 5 באוקטובר" / "יום ד׳, 1 באוקטובר". */
export function dayTitle(key: IsoDate, now: EpochMs): string {
  const date = parseDateKey(key);
  const base = `${weekdayShort(date)}, ${dayMonth(date, now)}`;
  const rel = relativeDayName(key, now);
  return rel ? `${rel} · ${base}` : base;
}

/**
 * Friendly prefix for a date-time picker value: "היום" / "אתמול" / "3 באוקטובר".
 * The clock part (`HH:mm`) is returned separately so the UI can isolate it in an LTR span.
 */
export function pickerParts(at: EpochMs, now: EpochMs): { day: string; clock: string } {
  const key = toDateKey(at);
  return { day: relativeDayName(key, now) ?? dayMonth(new Date(at), now), clock: formatClock(at) };
}

/** Value for `<input type="datetime-local">` in local time: "2026-10-05T14:05". */
export function toDateTimeLocalValue(at: EpochMs): string {
  return `${toDateKey(at)}T${formatClock(at)}`;
}

/** Parses a `datetime-local` value as LOCAL time; `null` when invalid/empty. */
export function fromDateTimeLocalValue(value: string): EpochMs | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** A number + unit pair for rich rendering ("2" "שע׳"). */
export interface ValuePart {
  value: string;
  unit: string;
}

/**
 * "Since last feed" hero value (DESIGN §6.4): under 1 min → "עכשיו"; under 1 h → `<n> ד׳`;
 * under 24 h → `<h> שע׳ <m> ד׳`; otherwise `<d> ימים` / "יום אחד".
 */
export function sinceParts(elapsedMs: number): ValuePart[] | 'now' {
  const ms = Math.max(0, elapsedMs);
  if (ms < MS_PER_MINUTE) return 'now';
  if (ms < MS_PER_HOUR) {
    return [{ value: String(Math.floor(ms / MS_PER_MINUTE)), unit: he.units.min }];
  }
  if (ms < MS_PER_DAY) {
    const totalMin = Math.floor(ms / MS_PER_MINUTE);
    return [
      { value: String(Math.floor(totalMin / 60)), unit: he.units.hour },
      { value: String(totalMin % 60), unit: he.units.min },
    ];
  }
  const days = Math.floor(ms / MS_PER_DAY);
  return days === 1 ? [{ value: '', unit: 'יום אחד' }] : [{ value: String(days), unit: 'ימים' }];
}

/** Whole minutes (rounded) of a duration — what the UI shows next to "ד׳". */
export const roundMinutes = (ms: number): number => Math.round(Math.max(0, ms) / MS_PER_MINUTE);

/** Display number for a volume in the user's unit, without the unit: "120" / "4.1". */
export function volumeNumber(ml: number, unit: VolumeUnit): string {
  return unit === 'ml' ? formatNumber(Math.round(ml)) : formatNumber(mlToOz(ml), 1);
}

/** Unit label for a volume unit. */
export const volumeUnitLabel = (unit: VolumeUnit): string =>
  unit === 'ml' ? he.units.ml : he.units.oz;

/** Rounds a display-unit volume to the input precision (whole ml, 0.5 oz). */
export function displayVolume(ml: number, unit: VolumeUnit): number {
  const v = volumeFromMl(ml, unit);
  return unit === 'ml' ? Math.round(v) : Math.round(v * 2) / 2;
}
