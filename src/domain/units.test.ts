import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatHoursMinutes,
  formatLength,
  formatNumber,
  formatTimer,
  formatTimeSince,
  formatVolume,
  formatWeight,
  formatWeightDelta,
  G_PER_LB,
  gToKg,
  gToLb,
  kgToG,
  lbToG,
  ML_PER_OZ,
  mlToOz,
  ozToMl,
  volumeFromMl,
  volumeToMl,
  weightFromG,
  weightToG,
  cmToMm,
  mmToCm,
} from './units';
import { DAY, HOUR, MIN } from '../test/helpers';

describe('conversions', () => {
  it('converts volumes (1 oz = 29.5735 ml)', () => {
    expect(ML_PER_OZ).toBe(29.5735);
    expect(mlToOz(29.5735)).toBeCloseTo(1, 10);
    expect(ozToMl(4)).toBeCloseTo(118.294, 3);
    expect(volumeFromMl(120, 'ml')).toBe(120);
    expect(volumeFromMl(120, 'oz')).toBeCloseTo(4.0577, 4);
    expect(volumeToMl(4, 'oz')).toBe(118);
    expect(volumeToMl(120.4, 'ml')).toBe(120);
  });

  it('converts weights and lengths', () => {
    expect(G_PER_LB).toBe(453.59237);
    expect(gToKg(3450)).toBe(3.45);
    expect(kgToG(3.45)).toBeCloseTo(3450, 9);
    expect(gToLb(453.59237)).toBeCloseTo(1, 12);
    expect(lbToG(7.5)).toBeCloseTo(3401.94, 2);
    expect(weightFromG(3450, 'kg')).toBe(3.45);
    expect(weightFromG(3450, 'lb')).toBeCloseTo(7.606, 3);
    expect(weightToG(3.456, 'kg')).toBe(3456);
    expect(weightToG(7.5, 'lb')).toBe(3402);
    expect(mmToCm(525)).toBe(52.5);
    expect(cmToMm(52.5)).toBe(525);
  });
});

describe('formatting', () => {
  it('formats volumes in Hebrew', () => {
    expect(formatVolume(120)).toBe('120 מ״ל');
    expect(formatVolume(119.6, 'ml')).toBe('120 מ״ל');
    expect(formatVolume(1000)).toBe('1,000 מ״ל');
    expect(formatVolume(120, 'oz')).toBe('4.1 אונ׳');
  });

  it('formats weights', () => {
    expect(formatWeight(3450)).toBe('3.45 ק״ג');
    expect(formatWeight(3400)).toBe('3.40 ק״ג');
    expect(formatWeight(3450, 'lb')).toBe('7.61 ליב׳');
    expect(formatWeightDelta(25)).toBe('+25 גר׳');
    expect(formatWeightDelta(-40.4)).toBe('−40 גר׳');
    expect(formatWeightDelta(0)).toBe('0 גר׳');
    expect(formatWeightDelta(-453.59237, 'lb')).toBe('−1.00 ליב׳');
    expect(formatLength(525)).toBe('52.5 ס״מ');
    expect(formatLength(500)).toBe('50 ס״מ');
  });

  it('never prints negative zero', () => {
    expect(formatNumber(-0)).toBe('0');
  });

  it('formats live timer as mm:ss / h:mm:ss', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(-5000)).toBe('00:00');
    expect(formatTimer(7 * MIN + 5_999)).toBe('07:05');
    expect(formatTimer(HOUR + 2 * MIN + 9_000)).toBe('1:02:09');
  });

  it('formats summary durations', () => {
    expect(formatDuration(0)).toBe('0 דק׳');
    expect(formatDuration(20_000)).toBe('פחות מדקה');
    expect(formatDuration(25 * MIN)).toBe('25 דק׳');
    expect(formatDuration(25 * MIN + 31_000)).toBe('26 דק׳');
    expect(formatDuration(65 * MIN)).toBe('1 ש׳ 5 דק׳');
    expect(formatDuration(2 * HOUR)).toBe('2 ש׳');
  });

  it('formats time since', () => {
    expect(formatHoursMinutes(2 * HOUR + 15 * MIN + 59_000)).toBe('2:15');
    expect(formatTimeSince(-1)).toBe('עכשיו');
    expect(formatTimeSince(59_000)).toBe('עכשיו');
    expect(formatTimeSince(25 * MIN)).toBe('לפני 25 דק׳');
    expect(formatTimeSince(2 * HOUR + 15 * MIN)).toBe('לפני 2:15 ש׳');
    expect(formatTimeSince(DAY + HOUR)).toBe('לפני יום');
    expect(formatTimeSince(2 * DAY)).toBe('לפני יומיים');
    expect(formatTimeSince(5 * DAY)).toBe('לפני 5 ימים');
  });
});
