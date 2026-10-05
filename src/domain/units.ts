/**
 * Unit conversion & Hebrew-friendly formatting.
 * Internal storage is always ml / grams / millimetres / epoch ms; conversion happens only at the edges.
 *
 * Hebrew abbreviations use the proper Hebrew punctuation: geresh U+05F3 (׳) and gershayim U+05F4 (״).
 * Strings put the number first ("120 מ״ל"), which reads correctly in an RTL paragraph. Signed values
 * (e.g. "+25 גר׳") should be wrapped in `<bdi>` by the UI.
 */
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from './dates';
import type { VolumeUnit, WeightUnit } from './types';

/** 1 US fluid ounce in millilitres (exact definition: 29.5735295625 ml; 29.5735 is the customary value). */
export const ML_PER_OZ = 29.5735;
/** 1 avoirdupois pound in grams (exact by definition). */
export const G_PER_LB = 453.59237;

export const UNIT_LABELS = {
  ml: 'מ״ל',
  oz: 'oz',
  kg: 'ק״ג',
  lb: 'lb',
  g: 'גר׳',
  cm: 'ס״מ',
  minutesShort: 'ד׳',
  hoursShort: 'שע׳',
} as const;

// ---------------------------------------------------------------- conversions

export const mlToOz = (ml: number): number => ml / ML_PER_OZ;
export const ozToMl = (oz: number): number => oz * ML_PER_OZ;
export const gToKg = (g: number): number => g / 1000;
export const kgToG = (kg: number): number => kg * 1000;
export const gToLb = (g: number): number => g / G_PER_LB;
export const lbToG = (lb: number): number => lb * G_PER_LB;
export const mmToCm = (mm: number): number => mm / 10;
export const cmToMm = (cm: number): number => cm * 10;

/** Converts a volume in ml to the display unit (unrounded). */
export function volumeFromMl(ml: number, unit: VolumeUnit): number {
  return unit === 'ml' ? ml : mlToOz(ml);
}
/** Converts a user-entered volume in `unit` to ml, rounded to a whole ml (storage precision). */
export function volumeToMl(value: number, unit: VolumeUnit): number {
  return Math.round(unit === 'ml' ? value : ozToMl(value));
}
/** Converts grams to the display unit (kg or lb, unrounded). */
export function weightFromG(g: number, unit: WeightUnit): number {
  return unit === 'kg' ? gToKg(g) : gToLb(g);
}
/** Converts a user-entered weight in `unit` (kg or lb) to whole grams. */
export function weightToG(value: number, unit: WeightUnit): number {
  return Math.round(unit === 'kg' ? kgToG(value) : lbToG(value));
}

// ---------------------------------------------------------------- number formatting

const numberFormatters = new Map<string, Intl.NumberFormat>();

/** Locale number formatting (he-IL: `.` decimal, `,` grouping) with fixed fraction digits. */
export function formatNumber(
  value: number,
  minFractionDigits = 0,
  maxFractionDigits = minFractionDigits,
): string {
  const key = `${minFractionDigits}:${maxFractionDigits}`;
  let fmt = numberFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat('he-IL', {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    });
    numberFormatters.set(key, fmt);
  }
  // Avoid "-0".
  return fmt.format(Object.is(value, -0) ? 0 : value);
}

/** "120 מ״ל" / "4.1 oz". ml are whole numbers; oz one decimal (DESIGN §8.3). */
export function formatVolume(ml: number, unit: VolumeUnit = 'ml'): string {
  return unit === 'ml'
    ? `${formatNumber(Math.round(ml))} ${UNIT_LABELS.ml}`
    : `${formatNumber(mlToOz(ml), 1)} ${UNIT_LABELS.oz}`;
}

/** "3.45 ק״ג" (two decimals) / "7.6 lb" (one decimal) — DESIGN §8.3. */
export function formatWeight(g: number, unit: WeightUnit = 'kg'): string {
  return unit === 'kg'
    ? `${formatNumber(gToKg(g), 2)} ${UNIT_LABELS.kg}`
    : `${formatNumber(gToLb(g), 1)} ${UNIT_LABELS.lb}`;
}

/**
 * Signed weight change: "+25 גר׳" / "−40 גר׳" in grams for kg users, "+0.06 lb" for lb users.
 * Uses a real minus sign (U+2212) for legibility.
 */
export function formatWeightDelta(deltaG: number, unit: WeightUnit = 'kg'): string {
  const sign = deltaG > 0 ? '+' : deltaG < 0 ? '−' : '';
  const abs = Math.abs(deltaG);
  return unit === 'kg'
    ? `${sign}${formatNumber(Math.round(abs))} ${UNIT_LABELS.g}`
    : `${sign}${formatNumber(gToLb(abs), 2)} ${UNIT_LABELS.lb}`;
}

/** "52.5 ס״מ" from millimetres (one decimal, trailing ".0" dropped). */
export function formatLength(mm: number): string {
  return `${formatNumber(mmToCm(mm), 0, 1)} ${UNIT_LABELS.cm}`;
}

// ---------------------------------------------------------------- durations

/** Live timer display: "07:05", or "1:02:09" once an hour has passed. Negative input → "00:00". */
export function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Summary duration rounded to whole minutes: "25 ד׳", "1 שע׳ 5 ד׳", "2 שע׳" (DESIGN §8.1 glossary).
 * Non-zero durations under 30 s show as "פחות מדקה"; zero shows "0 ד׳".
 */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  const totalMin = Math.round(safe / MS_PER_MINUTE);
  if (totalMin === 0) return safe > 0 ? 'פחות מדקה' : `0 ${UNIT_LABELS.minutesShort}`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} ${UNIT_LABELS.minutesShort}`;
  if (m === 0) return `${h} ${UNIT_LABELS.hoursShort}`;
  return `${h} ${UNIT_LABELS.hoursShort} ${m} ${UNIT_LABELS.minutesShort}`;
}

/** "2:15" (hours:minutes, floored). */
export function formatHoursMinutes(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / MS_PER_MINUTE);
  return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`;
}

/**
 * Relative time since an event, floored:
 * < 1 min → "עכשיו"; < 1 h → "לפני 25 ד׳"; < 24 h → "לפני 2:15 שע׳";
 * otherwise "לפני יום" / "לפני יומיים" / "לפני 3 ימים".
 */
export function formatTimeSince(elapsedMs: number): string {
  const ms = Math.max(0, elapsedMs);
  if (ms < MS_PER_MINUTE) return 'עכשיו';
  if (ms < MS_PER_HOUR) return `לפני ${Math.floor(ms / MS_PER_MINUTE)} ${UNIT_LABELS.minutesShort}`;
  if (ms < MS_PER_DAY) return `לפני ${formatHoursMinutes(ms)} ${UNIT_LABELS.hoursShort}`;
  const days = Math.floor(ms / MS_PER_DAY);
  if (days === 1) return 'לפני יום';
  if (days === 2) return 'לפני יומיים';
  return `לפני ${days} ימים`;
}
