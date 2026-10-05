import { describe, expect, it } from 'vitest';
import { lmsValue, lmsValueRestricted, lmsZ, lmsZRestricted, type LmsRow } from './lms';

/** WHO weight-for-age, boys, day 0. */
const BOYS_BIRTH: LmsRow = [0.3487, 3.3464, 0.14602];

describe('LMS', () => {
  it('z = 0 at the median and inverts exactly', () => {
    expect(lmsZ(3.3464, BOYS_BIRTH)).toBeCloseTo(0, 12);
    for (const z of [-2.5, -1, 0.3, 1.7, 2.9]) {
      expect(lmsZ(lmsValue(z, BOYS_BIRTH), BOYS_BIRTH)).toBeCloseTo(z, 10);
    }
  });

  it('matches the hand-computed formula ((X/M)^L − 1)/(L·S)', () => {
    const [l, m, s] = BOYS_BIRTH;
    const expected = (Math.pow(2.5 / m, l) - 1) / (l * s);
    expect(lmsZ(2.5, BOYS_BIRTH)).toBeCloseTo(expected, 14);
    expect(expected).toBeCloseTo(-1.8988, 4);
  });

  it('uses the log form when L = 0', () => {
    const row: LmsRow = [0, 10, 0.1];
    expect(lmsZ(10 * Math.exp(0.2), row)).toBeCloseTo(2, 12);
    expect(lmsValue(-1, row)).toBeCloseTo(10 * Math.exp(-0.1), 12);
  });

  it('returns NaN where the Box-Cox inverse is undefined', () => {
    expect(lmsValue(-50, [1, 10, 0.1])).toBeNaN();
  });

  describe('WHO restricted application beyond ±3 SD', () => {
    const sd = (z: number) => lmsValue(z, BOYS_BIRTH);

    it('is identical to plain LMS within ±3', () => {
      for (const x of [2.2, 3, 4.9])
        expect(lmsZRestricted(x, BOYS_BIRTH)).toBe(lmsZ(x, BOYS_BIRTH));
    });

    it('applies z = 3 + (X − SD3pos)/SD23pos above +3', () => {
      const x = 5.6;
      const expected = 3 + (x - sd(3)) / (sd(3) - sd(2));
      expect(lmsZRestricted(x, BOYS_BIRTH)).toBeCloseTo(expected, 12);
      expect(lmsZRestricted(x, BOYS_BIRTH)).not.toBeCloseTo(lmsZ(x, BOYS_BIRTH), 3);
    });

    it('applies z = −3 + (X − SD3neg)/SD23neg below −3', () => {
      const x = 1.7;
      const expected = -3 + (x - sd(-3)) / (sd(-2) - sd(-3));
      expect(lmsZRestricted(x, BOYS_BIRTH)).toBeCloseTo(expected, 12);
      expect(lmsZRestricted(x, BOYS_BIRTH)).not.toBeCloseTo(lmsZ(x, BOYS_BIRTH), 3);
    });

    it('lmsValueRestricted is its inverse on both tails', () => {
      for (const z of [-4.5, -3.2, -1, 0, 2, 3.4, 5]) {
        expect(lmsZRestricted(lmsValueRestricted(z, BOYS_BIRTH), BOYS_BIRTH)).toBeCloseTo(z, 10);
      }
    });
  });
});
