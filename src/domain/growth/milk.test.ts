import { describe, expect, it } from 'vitest';
import {
  expectedDailyMilk,
  MAX_DAILY_MILK_ML,
  MILK_ML_PER_KG_PER_DAY,
  suggestedPerFeedMl,
  typicalFeedsPerDay,
} from './milk';

describe('expected daily milk (0–6 months)', () => {
  it('is 120/150/180 ml per kg per day', () => {
    expect(MILK_ML_PER_KG_PER_DAY).toEqual({ min: 120, typical: 150, max: 180 });
    expect(expectedDailyMilk(4000, 30)).toEqual({
      minMl: 480,
      typicalMl: 600,
      maxMl: 720,
      capped: false,
    });
  });

  it('caps at 1000 ml/day', () => {
    expect(expectedDailyMilk(6000, 150)).toEqual({
      minMl: 720,
      typicalMl: 900,
      maxMl: MAX_DAILY_MILK_ML,
      capped: true,
    });
    expect(expectedDailyMilk(7500, 170)).toEqual({
      minMl: 900,
      typicalMl: 1000,
      maxMl: 1000,
      capped: true,
    });
  });

  it('does not apply from 6 months or with invalid input', () => {
    expect(expectedDailyMilk(7000, 183)).toBeNull();
    expect(expectedDailyMilk(0, 10)).toBeNull();
    expect(expectedDailyMilk(3000, -1)).toBeNull();
  });

  it('suggests a per-feed amount rounded to 5 ml', () => {
    expect(suggestedPerFeedMl(600, 8)).toBe(75);
    expect(suggestedPerFeedMl(640, 7)).toBe(90); // 91.4 → 90
    expect(suggestedPerFeedMl(600, 0)).toBe(0);
    expect(suggestedPerFeedMl(0, 6)).toBe(0);
  });

  it('typical feeds per day by age', () => {
    expect(typicalFeedsPerDay(10)).toBe(8);
    expect(typicalFeedsPerDay(60)).toBe(7);
    expect(typicalFeedsPerDay(120)).toBe(6);
  });
});
