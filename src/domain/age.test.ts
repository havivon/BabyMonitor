import { describe, expect, it } from 'vitest';
import { ageInDays, ageInDaysOn, ageParts, formatAge } from './age';
import { local } from '../test/helpers';

describe('ageInDays', () => {
  it('counts local calendar days, independent of time of day', () => {
    expect(ageInDays('2026-10-05', local(2026, 10, 5, 0, 0))).toBe(0);
    expect(ageInDays('2026-10-05', local(2026, 10, 5, 23, 59))).toBe(0);
    expect(ageInDays('2026-10-05', local(2026, 10, 6, 0, 1))).toBe(1);
    expect(ageInDays('2026-10-05', new Date(2026, 9, 12))).toBe(7);
    expect(ageInDays('2026-10-05', local(2026, 10, 1))).toBe(-4);
  });

  it('is not off by one late at night (UTC parsing pitfall)', () => {
    // 01:00 local on Oct 6 is still Oct 5 in UTC; age must already be 1.
    expect(ageInDays('2026-10-05', local(2026, 10, 6, 1, 0))).toBe(1);
  });

  it('is correct across DST transitions', () => {
    // Spring forward (27 Mar 2026) and fall back (25 Oct 2026) days.
    expect(ageInDays('2026-03-26', local(2026, 3, 28, 0, 30))).toBe(2);
    expect(ageInDays('2026-10-24', local(2026, 10, 26, 0, 30))).toBe(2);
    expect(ageInDays('2026-03-01', local(2026, 11, 1, 12))).toBe(245);
    expect(ageInDaysOn('2026-03-20', '2026-04-03')).toBe(14);
  });
});

describe('ageParts', () => {
  it('breaks age into calendar parts', () => {
    expect(ageParts('2025-08-03', local(2026, 10, 5))).toEqual({
      totalDays: 428,
      totalMonths: 14,
      years: 1,
      months: 2,
      days: 2,
      weeks: 61,
      daysOfWeek: 1,
    });
    expect(ageParts('2026-10-06', local(2026, 10, 5))).toBeNull();
  });

  it('treats month-end birthdays sensibly', () => {
    expect(ageParts('2026-01-31', local(2026, 2, 28))?.totalMonths).toBe(1);
  });
});

describe('formatAge', () => {
  const now = local(2026, 10, 5, 9);
  it.each([
    ['2026-10-05', 'היום הראשון'],
    ['2026-10-04', 'יום אחד'],
    ['2026-10-03', 'יומיים'],
    ['2026-09-30', '5 ימים'],
    ['2026-09-22', '13 ימים'],
    ['2026-09-21', 'שבועיים'],
    ['2026-09-20', 'שבועיים ויום'],
    ['2026-09-12', '3 שבועות ו-2 ימים'],
    ['2026-08-07', '8 שבועות ו-3 ימים'],
    ['2026-08-05', 'חודשיים'],
    ['2026-06-01', '4 חודשים'],
    ['2025-11-05', '11 חודשים'],
    ['2025-10-05', 'שנה'],
    ['2025-09-05', 'שנה וחודש'],
    ['2025-08-01', 'שנה ו-2 חודשים'],
    ['2024-09-01', 'שנתיים וחודש'],
    ['2023-04-05', '3 שנים ו-6 חודשים'],
  ])('born %s → %s', (birthDate, expected) => {
    expect(formatAge(birthDate, now)).toBe(expected);
  });

  it('returns empty string for a future birth date', () => {
    expect(formatAge('2026-10-06', now)).toBe('');
  });
});
