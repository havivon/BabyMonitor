import { describe, expect, it } from 'vitest';
import type { GrowthInsight } from '../../domain/growth/insights';
import { insightCopy } from './insightCopy';
import { percentileDescription } from './percentileCopy';

describe('percentileDescription', () => {
  it.each([
    [1, 'מתחת לאחוזון 3 לפי WHO'],
    [5, 'בטווח התקין, בקצה הנמוך'],
    [20, 'בטווח הנפוץ לפי WHO'],
    [48, 'קרוב לחציון לפי WHO'],
    [70, 'בטווח הנפוץ לפי WHO'],
    [90, 'בטווח התקין, בקצה הגבוה'],
    [98, 'מעל אחוזון 97 לפי WHO'],
  ])('P%d → %s', (p, text) => {
    expect(percentileDescription(p)).toBe(text);
  });
});

describe('insightCopy', () => {
  const cases: [GrowthInsight, string, RegExp, RegExp][] = [
    [
      { kind: 'birthWeightLoss', severity: 'alert', pct: 11.43, ageDays: 4, date: '2026-06-05' },
      'danger',
      /11.4%/,
      /רופא\/ת הילדים/,
    ],
    [
      { kind: 'birthWeightLoss', severity: 'warn', pct: 8, ageDays: 3, date: '2026-06-04' },
      'warning',
      /8%/,
      /טיפת חלב/,
    ],
    [
      { kind: 'birthWeightLoss', severity: 'info', pct: 5, ageDays: 3, date: '2026-06-04' },
      'info',
      /5%/,
      /תקינה/,
    ],
    [
      {
        kind: 'birthWeightRegained',
        severity: 'info',
        ageDays: 12,
        date: '2026-06-13',
        onTime: true,
      },
      'success',
      /חזר/,
      /12 ימים/,
    ],
    [
      {
        kind: 'birthWeightRegained',
        severity: 'info',
        ageDays: 18,
        date: '2026-06-19',
        onTime: false,
      },
      'info',
      /חזר/,
      /טיפת חלב/,
    ],
    [
      {
        kind: 'birthWeightNotRegained',
        severity: 'warn',
        ageDays: 20,
        date: '2026-06-21',
        pct: -3,
      },
      'warning',
      /עוד לא חזר/,
      /3%.*רופא\/ת הילדים/,
    ],
    [
      {
        kind: 'lowPercentile',
        severity: 'warn',
        indicator: 'weight',
        percentile: 1.2,
        z: -2.3,
        date: 'x',
      },
      'warning',
      /המשקל מתחת לאחוזון 3/,
      /1.2/,
    ],
    [
      {
        kind: 'highPercentile',
        severity: 'warn',
        indicator: 'head',
        percentile: 99.5,
        z: 2.6,
        date: 'x',
      },
      'warning',
      /היקף הראש מעל אחוזון 97/,
      /רופא\/ת הילדים/,
    ],
    [
      {
        kind: 'percentileCrossingDown',
        severity: 'warn',
        indicator: 'weight',
        linesCrossed: 2,
        fromPercentile: 60,
        toPercentile: 10,
        fromDate: '2026-07-01',
        toDate: '2026-09-01',
      },
      'warning',
      /המשקל ירד בשני קווי אחוזון/,
      /מאחוזון 60 ב-1 ביולי לאחוזון 10/,
    ],
    [
      {
        kind: 'percentileCrossingDown',
        severity: 'warn',
        indicator: 'length',
        linesCrossed: 3,
        fromPercentile: 90,
        toPercentile: 10,
        fromDate: '2026-07-01',
        toDate: '2026-09-01',
      },
      'warning',
      /האורך ירד ב-3 קווי אחוזון/,
      /./,
    ],
    [
      {
        kind: 'lowWeightGain',
        severity: 'warn',
        gPerWeek: 49.6,
        minGPerWeek: 150,
        maxGPerWeek: 200,
        days: 14,
        fromDate: 'a',
        toDate: 'b',
      },
      'warning',
      /עלייה איטית/,
      /כ-50 גר׳ לשבוע.*150–200/,
    ],
  ];

  it.each(cases)('%o', (insight, tone, title, text) => {
    const copy = insightCopy(insight);
    expect(copy.tone).toBe(tone);
    expect(copy.title).toMatch(title);
    expect(copy.text).toMatch(text);
    // DESIGN §8: Hebrew punctuation only, no ASCII quotes.
    expect(copy.title + copy.text).not.toMatch(/["']/);
  });
});
