import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  daysBetweenKeys,
  formatClock,
  isValidDateKey,
  parseDateKey,
  startOfLocalDay,
  startOfNextLocalDay,
  toDateKey,
} from './dates';
import { HOUR, local } from '../test/helpers';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2024-02-29')).toBe(true);
    expect(isValidDateKey('2025-02-29')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-1-01')).toBe(false);
    expect(isValidDateKey(20260101)).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });

  it('parses YYYY-MM-DD as LOCAL midnight (not UTC)', () => {
    const d = parseDateKey('2026-10-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
    // new Date('2026-10-05') would be 03:00 local in Israel (UTC midnight) — we must not do that.
    expect(d.getTime()).not.toBe(new Date('2026-10-05').getTime());
    expect(() => parseDateKey('2026-02-30')).toThrow(RangeError);
  });

  it('formats local date keys and clock times', () => {
    // 23:30 local on Oct 5 is still Oct 5 locally even though it is 20:30Z.
    expect(toDateKey(local(2026, 10, 5, 23, 30))).toBe('2026-10-05');
    expect(toDateKey(new Date(2026, 0, 9))).toBe('2026-01-09');
    expect(formatClock(local(2026, 10, 5, 7, 5))).toBe('07:05');
  });

  it('handles DST transition days (23h and 25h days)', () => {
    // Israel 2026: DST starts Fri 27 Mar 02:00, ends Sun 25 Oct 02:00.
    expect(
      startOfNextLocalDay(local(2026, 3, 27, 12)) - startOfLocalDay(local(2026, 3, 27, 12)),
    ).toBe(23 * HOUR);
    expect(
      startOfNextLocalDay(local(2026, 10, 25, 12)) - startOfLocalDay(local(2026, 10, 25, 12)),
    ).toBe(25 * HOUR);
    expect(addDaysToKey('2026-03-26', 2)).toBe('2026-03-28');
    expect(addDaysToKey('2026-10-26', -2)).toBe('2026-10-24');
    expect(daysBetweenKeys('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetweenKeys('2026-10-01', '2026-11-01')).toBe(31);
  });
});
