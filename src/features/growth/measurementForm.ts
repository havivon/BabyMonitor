/**
 * Add/edit measurement form: parsing (user units → g / mm) and validation (DESIGN §7.7 strings).
 */
import { isValidDateKey } from '../../domain/dates';
import { gToLb, lbToG } from '../../domain/units';
import type { IsoDate, Measurement, WeightUnit } from '../../domain/types';

export interface MeasurementFormValues {
  date: string;
  weight: string;
  length: string;
  head: string;
  note: string;
}

export type MeasurementField = 'date' | 'weight' | 'length' | 'head';
export type MeasurementErrors = Partial<Record<MeasurementField, string>>;

export type MeasurementInput = Omit<Measurement, 'id' | 'babyId'>;

export const MEASUREMENT_ERRORS = {
  none: 'יש להזין לפחות ערך אחד',
  weightKg: 'המשקל צריך להיות בין 0.5 ל-30 ק״ג',
  weightLb: 'המשקל צריך להיות בין 1.1 ל-66 lb',
  length: 'האורך צריך להיות בין 30 ל-120 ס״מ',
  head: 'היקף הראש צריך להיות בין 25 ל-60 ס״מ',
  number: 'יש להזין מספר',
  date: 'יש לבחור תאריך',
  beforeBirth: 'תאריך המדידה לא יכול להיות לפני תאריך הלידה',
  future: 'אי אפשר לבחור תאריך עתידי',
} as const;

/** Parses "3.45" / "3,45" / " 52 ". Empty → null; garbage → NaN. */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  return /^\d+(\.\d+)?$|^\.\d+$/.test(s) ? Number(s) : Number.NaN;
}

/**
 * Weight entry in the user's unit → grams. In kg mode a value above 100 is read as grams
 * ("3450" → 3450 g), since no baby weighs 100 kg.
 */
export function weightInputToGrams(value: number, unit: WeightUnit): number {
  if (unit === 'lb') return Math.round(lbToG(value));
  return Math.round(value > 100 ? value : value * 1000);
}

export interface ValidationContext {
  birthDate: IsoDate;
  today: IsoDate;
  weightUnit: WeightUnit;
}

export type ValidationResult =
  { ok: true; value: MeasurementInput } | { ok: false; errors: MeasurementErrors };

export function validateMeasurement(
  values: MeasurementFormValues,
  ctx: ValidationContext,
): ValidationResult {
  const errors: MeasurementErrors = {};
  const out: MeasurementInput = { date: values.date };

  if (!isValidDateKey(values.date)) errors.date = MEASUREMENT_ERRORS.date;
  else if (values.date < ctx.birthDate) errors.date = MEASUREMENT_ERRORS.beforeBirth;
  else if (values.date > ctx.today) errors.date = MEASUREMENT_ERRORS.future;

  const weight = parseDecimal(values.weight);
  if (weight !== null) {
    const grams = Number.isNaN(weight) ? Number.NaN : weightInputToGrams(weight, ctx.weightUnit);
    if (!(grams >= 500 && grams <= 30_000)) {
      errors.weight =
        ctx.weightUnit === 'kg' ? MEASUREMENT_ERRORS.weightKg : MEASUREMENT_ERRORS.weightLb;
    } else out.weightG = grams;
  }

  const length = parseDecimal(values.length);
  if (length !== null) {
    if (!(length >= 30 && length <= 120)) errors.length = MEASUREMENT_ERRORS.length;
    else out.lengthMm = Math.round(length * 10);
  }

  const head = parseDecimal(values.head);
  if (head !== null) {
    if (!(head >= 25 && head <= 60)) errors.head = MEASUREMENT_ERRORS.head;
    else out.headMm = Math.round(head * 10);
  }

  if (weight === null && length === null && head === null) errors.weight = MEASUREMENT_ERRORS.none;

  const note = values.note.trim();
  if (note) out.note = note;

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: out };
}

/** Form values for editing an existing measurement (or a blank form dated `today`). */
export function measurementToFormValues(
  m: Measurement | null,
  weightUnit: WeightUnit,
  today: IsoDate,
): MeasurementFormValues {
  if (!m) return { date: today, weight: '', length: '', head: '', note: '' };
  const weight =
    m.weightG === undefined
      ? ''
      : weightUnit === 'kg'
        ? (m.weightG / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
        : gToLb(m.weightG).toFixed(2);
  return {
    date: m.date,
    weight,
    length: m.lengthMm === undefined ? '' : String(m.lengthMm / 10),
    head: m.headMm === undefined ? '' : String(m.headMm / 10),
    note: m.note ?? '',
  };
}
