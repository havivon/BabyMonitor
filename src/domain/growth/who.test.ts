import { describe, expect, it } from 'vitest';
import { GROWTH_INDICATORS, loadWhoTable, loadWhoTables, WHO_MAX_AGE_DAYS } from './who';

describe('WHO tables', () => {
  it('lazy-loads each table once (memoised)', async () => {
    const a = await loadWhoTable('weight');
    const b = await loadWhoTable('weight');
    expect(a).toBe(b);
  });

  it('have contiguous rows for every day 0..1826 for both sexes', async () => {
    const tables = await loadWhoTables();
    for (const indicator of GROWTH_INDICATORS) {
      for (const sex of ['male', 'female'] as const) {
        const rows = tables[indicator][sex];
        expect(rows).toHaveLength(WHO_MAX_AGE_DAYS + 1);
        for (const [l, m, s] of rows) {
          expect(Number.isFinite(l) && m > 0 && s > 0).toBe(true);
        }
      }
    }
  });

  it('match the source file values (spot check)', async () => {
    const { weight, length, head } = await loadWhoTables();
    expect(weight.male[0]).toEqual([0.3487, 3.3464, 0.14602]);
    expect(weight.female[0]).toEqual([0.3809, 3.2322, 0.14171]);
    expect(weight.male[365]).toEqual([0.0645, 9.646, 0.10925]);
    expect(weight.female[1826]).toEqual([-0.3518, 18.2179, 0.14821]);
    expect(length.male[0]).toEqual([1, 49.8842, 0.03795]);
    expect(head.male[0]).toEqual([1, 34.4618, 0.03686]);
  });
});
