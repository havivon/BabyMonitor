import { describe, expect, it } from 'vitest';
import { bottle, HOUR, local } from '../../test/helpers';
import { milkGuide } from './milkModel';

const NOW = local(2026, 10, 5, 12);

describe('milkGuide', () => {
  it('uses the typical feeds/day without enough history', () => {
    expect(milkGuide(5000, 60, [], NOW)).toEqual({
      range: { minMl: 600, typicalMl: 750, maxMl: 900, capped: false },
      feedsPerDay: 7,
      feedsSource: 'typical',
      perFeedMl: 105,
    });
  });

  it("uses the baby's own average over complete days", () => {
    const entries = [];
    for (let d = 1; d <= 4; d++) {
      for (let i = 0; i < 6; i++) entries.push(bottle(local(2026, 10, 5 - d, 2 + i * 3), 120));
    }
    entries.push(bottle(NOW - HOUR, 120)); // today is ignored
    expect(milkGuide(5000, 60, entries, NOW)).toMatchObject({
      feedsPerDay: 6,
      feedsSource: 'history',
      perFeedMl: 125,
    });
  });

  it('is null without weight or from 6 months', () => {
    expect(milkGuide(undefined, 60, [], NOW)).toBeNull();
    expect(milkGuide(7000, 200, [], NOW)).toBeNull();
  });
});
