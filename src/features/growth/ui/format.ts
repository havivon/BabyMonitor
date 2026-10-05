/**
 * Hebrew presentation helpers shared by the Growth, Stats and Settings screens (DESIGN §8.3).
 */
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { parseDateKey } from '../../../domain/dates';
import { formatNumber, gToLb, mlToOz, UNIT_LABELS } from '../../../domain/units';
import type { IsoDate, VolumeUnit, WeightUnit } from '../../../domain/types';

/** "1 באוקטובר 2026" */
export const formatDateLong = (key: IsoDate): string =>
  format(parseDateKey(key), 'd בMMMM yyyy', { locale: he });
/** "1 באוקטובר" */
export const formatDateMedium = (key: IsoDate): string =>
  format(parseDateKey(key), 'd בMMMM', { locale: he });
/** "1.7.2026" */
export const formatDateNumeric = (key: IsoDate): string => format(parseDateKey(key), 'd.M.yyyy');

/** A number and its unit, rendered separately so the number can sit in an LTR isolate. */
export interface Quantity {
  number: string;
  unit: string;
}

export function weightQuantity(g: number, unit: WeightUnit): Quantity {
  return unit === 'kg'
    ? { number: formatNumber(g / 1000, 2), unit: UNIT_LABELS.kg }
    : { number: formatNumber(gToLb(g), 1), unit: UNIT_LABELS.lb };
}

export function lengthQuantity(mm: number): Quantity {
  return { number: formatNumber(mm / 10, 1), unit: UNIT_LABELS.cm };
}

export function volumeQuantity(ml: number, unit: VolumeUnit): Quantity {
  return unit === 'ml'
    ? { number: formatNumber(Math.round(ml)), unit: UNIT_LABELS.ml }
    : { number: formatNumber(mlToOz(ml), 1), unit: UNIT_LABELS.oz };
}

/** Signed number with a real minus sign and up to `fractionDigits` decimals: "+27", "−0.4", "0". */
export function signed(value: number, fractionDigits = 0): string {
  const rounded = Number(value.toFixed(fractionDigits));
  const abs = formatNumber(Math.abs(rounded), 0, fractionDigits);
  if (rounded > 0) return `+${abs}`;
  if (rounded < 0) return `−${abs}`;
  return abs;
}
