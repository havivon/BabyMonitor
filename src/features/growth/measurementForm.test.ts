import { describe, expect, it } from 'vitest';
import {
  MEASUREMENT_ERRORS,
  measurementToFormValues,
  parseDecimal,
  validateMeasurement,
  weightInputToGrams,
  type MeasurementFormValues,
} from './measurementForm';

const ctx = { birthDate: '2026-06-01', today: '2026-10-05', weightUnit: 'kg' as const };
const form = (v: Partial<MeasurementFormValues>): MeasurementFormValues => ({
  date: '2026-10-01',
  weight: '',
  length: '',
  head: '',
  note: '',
  ...v,
});

describe('parsing', () => {
  it('parses decimals with dot or comma', () => {
    expect(parseDecimal('3.45')).toBe(3.45);
    expect(parseDecimal(' 3,45 ')).toBe(3.45);
    expect(parseDecimal('52')).toBe(52);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('-3')).toBeNaN();
  });

  it('reads kg, grams (>100) and lb', () => {
    expect(weightInputToGrams(3.456, 'kg')).toBe(3456);
    expect(weightInputToGrams(3450, 'kg')).toBe(3450);
    expect(weightInputToGrams(7.5, 'lb')).toBe(3402);
  });
});

describe('validateMeasurement', () => {
  it('accepts a full measurement and converts to g / mm', () => {
    expect(
      validateMeasurement(
        form({ weight: '5.82', length: '59.5', head: '39.8', note: ' טיפת חלב ' }),
        ctx,
      ),
    ).toEqual({
      ok: true,
      value: { date: '2026-10-01', weightG: 5820, lengthMm: 595, headMm: 398, note: 'טיפת חלב' },
    });
  });

  it('accepts a single value', () => {
    expect(validateMeasurement(form({ head: '40' }), ctx)).toEqual({
      ok: true,
      value: { date: '2026-10-01', headMm: 400 },
    });
  });

  it('requires at least one value', () => {
    expect(validateMeasurement(form({}), ctx)).toEqual({
      ok: false,
      errors: { weight: MEASUREMENT_ERRORS.none },
    });
  });

  it('checks plausible ranges', () => {
    const r = validateMeasurement(form({ weight: '45', length: '12', head: '80' }), ctx);
    expect(r).toEqual({
      ok: false,
      errors: {
        weight: MEASUREMENT_ERRORS.weightKg,
        length: MEASUREMENT_ERRORS.length,
        head: MEASUREMENT_ERRORS.head,
      },
    });
    expect(validateMeasurement(form({ weight: 'x' }), ctx)).toMatchObject({
      errors: { weight: MEASUREMENT_ERRORS.weightKg },
    });
    expect(validateMeasurement(form({ weight: '80' }), { ...ctx, weightUnit: 'lb' })).toMatchObject(
      {
        errors: { weight: MEASUREMENT_ERRORS.weightLb },
      },
    );
  });

  it('checks the date against birth date and today', () => {
    expect(validateMeasurement(form({ date: '2026-05-31', weight: '3' }), ctx)).toMatchObject({
      errors: { date: MEASUREMENT_ERRORS.beforeBirth },
    });
    expect(validateMeasurement(form({ date: '2026-10-06', weight: '3' }), ctx)).toMatchObject({
      errors: { date: MEASUREMENT_ERRORS.future },
    });
    expect(validateMeasurement(form({ date: '', weight: '3' }), ctx)).toMatchObject({
      errors: { date: MEASUREMENT_ERRORS.date },
    });
    expect(validateMeasurement(form({ date: '2026-06-01', weight: '3' }), ctx).ok).toBe(true);
    expect(validateMeasurement(form({ date: '2026-10-05', weight: '3' }), ctx).ok).toBe(true);
  });
});

describe('measurementToFormValues', () => {
  it('prefills edit values in the user unit', () => {
    const m = { id: 'm', babyId: 'b', date: '2026-07-01', weightG: 4300, lengthMm: 545, note: 'x' };
    expect(measurementToFormValues(m, 'kg', '2026-10-05')).toEqual({
      date: '2026-07-01',
      weight: '4.3',
      length: '54.5',
      head: '',
      note: 'x',
    });
    expect(measurementToFormValues(m, 'lb', '2026-10-05').weight).toBe('9.48');
    expect(measurementToFormValues(null, 'kg', '2026-10-05')).toEqual({
      date: '2026-10-05',
      weight: '',
      length: '',
      head: '',
      note: '',
    });
  });
});
