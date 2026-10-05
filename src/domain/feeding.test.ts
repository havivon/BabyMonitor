import { describe, expect, it } from 'vitest';
import {
  averageInterval,
  breastDurations,
  dailyAggregates,
  dayTotals,
  entryEndTime,
  entryTime,
  groupByDay,
  lastFeed,
  lastSideOf,
  otherSide,
  sortEntriesDesc,
  suggestNextSide,
  lastSegmentOf,
  todayTotals,
  totalsOf,
} from './feeding';
import type { BreastEntry } from './types';
import { bottle, breast, HOUR, local, MIN, solid } from '../test/helpers';

describe('entry time helpers', () => {
  it('uses start time for sorting and end time where relevant', () => {
    const b = breast(local(2026, 10, 5, 8), [['left', 10]]);
    const o = bottle(local(2026, 10, 5, 9), 90);
    expect(entryTime(b)).toBe(local(2026, 10, 5, 8));
    expect(entryEndTime(b)).toBe(local(2026, 10, 5, 8, 10));
    expect(entryEndTime(o)).toBe(o.at);
    expect(otherSide('left')).toBe('right');
    expect(otherSide('right')).toBe('left');
  });

  it('sorts newest first with a deterministic tie-break', () => {
    const t = local(2026, 10, 5, 8);
    const a = bottle(t, 60, { id: 'a' });
    const b = bottle(t, 60, { id: 'b' });
    const c = bottle(t + MIN, 60, { id: 'c' });
    expect(sortEntriesDesc([a, c, b]).map((e) => e.id)).toEqual(['c', 'b', 'a']);
    expect(sortEntriesDesc([b, a, c]).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('breastDurations', () => {
  it('sums per side from segments, excluding pauses', () => {
    const start = local(2026, 10, 5, 8);
    const entry: BreastEntry = {
      ...breast(start, []),
      segments: [
        { side: 'left', startedAt: start, endedAt: start + 10 * MIN },
        // 5 min pause
        { side: 'left', startedAt: start + 15 * MIN, endedAt: start + 20 * MIN },
        { side: 'right', startedAt: start + 20 * MIN, endedAt: start + 32 * MIN },
        { side: 'right', startedAt: start + 40 * MIN, endedAt: start + 39 * MIN }, // corrupt → 0
      ],
    };
    expect(breastDurations(entry)).toEqual({ left: 15 * MIN, right: 12 * MIN, total: 27 * MIN });
  });
});

describe('next side suggestion', () => {
  const t0 = local(2026, 10, 5, 6);

  it('suggests the side opposite to the one the last feed ended on', () => {
    const entries = [
      breast(t0, [
        ['left', 10],
        ['right', 8],
      ]),
      breast(
        t0 + 3 * HOUR,
        [
          ['right', 10],
          ['left', 5],
        ],
        { id: 'latest' },
      ),
    ];
    expect(suggestNextSide(entries)).toEqual({
      side: 'right',
      lastSide: 'left',
      basedOnEntryId: 'latest',
    });
  });

  it('suggests the other side when only one side was used', () => {
    expect(suggestNextSide([breast(t0, [['left', 12]])])?.side).toBe('right');
    expect(suggestNextSide([breast(t0, [['right', 12]])])?.side).toBe('left');
  });

  it('suggests the same side again when the last segment was under 2 minutes', () => {
    const shortLast = breast(t0, [
      ['left', 12],
      ['right', 1],
    ]);
    expect(suggestNextSide([shortLast])).toMatchObject({ side: 'right', lastSide: 'right' });
    expect(suggestNextSide([breast(t0, [['left', 2]])])?.side).toBe('right');
    expect(lastSegmentOf(shortLast)?.side).toBe('right');
    expect(lastSegmentOf({ segments: [] })).toBeNull();
  });

  it('uses segment chronology, not array order', () => {
    const e = breast(t0, [
      ['left', 10],
      ['right', 10],
    ]);
    const reversed = { ...e, segments: [...e.segments].reverse() };
    expect(lastSideOf(reversed)).toBe('right');
  });

  it('ignores bottles/solids and empty breastfeeds, and returns null without history', () => {
    const empty: BreastEntry = { ...breast(t0 + 5 * HOUR, []), segments: [] };
    const zeroLen = breast(t0 + 4 * HOUR, [['right', 0]]);
    const entries = [
      breast(t0, [['right', 10]]),
      bottle(t0 + HOUR, 90),
      empty,
      zeroLen,
      solid(t0 + 2 * HOUR, ['אבוקדו']),
    ];
    expect(suggestNextSide(entries)?.side).toBe('left');
    expect(suggestNextSide([bottle(t0, 60)])).toBeNull();
    expect(suggestNextSide([])).toBeNull();
  });
});

describe('lastFeed', () => {
  it('returns the most recent milk feed by default', () => {
    const t0 = local(2026, 10, 5, 6);
    const b = breast(t0, [['left', 10]]);
    const o = bottle(t0 + HOUR, 90);
    const s = solid(t0 + 2 * HOUR, ['בננה']);
    expect(lastFeed([b, s, o])).toBe(o);
    expect(lastFeed([b, s, o], ['solid', 'bottle', 'breast'])).toBe(s);
    expect(lastFeed([s])).toBeNull();
  });
});

describe('daily totals', () => {
  const entries = [
    breast(local(2026, 10, 4, 23, 50), [
      ['left', 10],
      ['right', 15],
    ]), // crosses midnight → Oct 4
    breast(local(2026, 10, 5, 3), [['right', 12]]),
    bottle(local(2026, 10, 5, 6), 90, { content: 'breastmilk' }),
    bottle(local(2026, 10, 5, 9), 120, { content: 'formula' }),
    solid(local(2026, 10, 5, 12), ['אבוקדו']),
    bottle(local(2026, 10, 6, 0, 5), 60),
  ];

  it('counts milk feeds, splits bottle ml by content, sums breast time — by local start day', () => {
    expect(todayTotals(entries, local(2026, 10, 5, 22))).toEqual({
      feedCount: 3,
      breastCount: 1,
      bottleCount: 2,
      solidCount: 1,
      bottleMl: { breastmilk: 90, formula: 120, total: 210 },
      breastMs: { left: 0, right: 12 * MIN, total: 12 * MIN },
    });
    expect(dayTotals(entries, local(2026, 10, 4, 12)).breastMs).toEqual({
      left: 10 * MIN,
      right: 15 * MIN,
      total: 25 * MIN,
    });
    expect(totalsOf([]).feedCount).toBe(0);
  });

  it('attributes entries at 00:30 to the new day even at UTC offset +3', () => {
    // 00:30 local = 21:30Z of the previous day.
    const e = bottle(local(2026, 7, 1, 0, 30), 100);
    expect(dayTotals([e], local(2026, 7, 1, 12)).bottleMl.total).toBe(100);
    expect(dayTotals([e], local(2026, 6, 30, 12)).bottleMl.total).toBe(0);
  });
});

describe('averageInterval', () => {
  it('averages gaps between milk-feed starts inside the window', () => {
    const now = local(2026, 10, 5, 12);
    const entries = [
      bottle(now - 30 * HOUR, 60), // outside 24h window
      bottle(now - 9 * HOUR, 60),
      breast(now - 6 * HOUR, [['left', 10]]),
      solid(now - 4 * HOUR, ['אורז']), // ignored by default
      bottle(now - 3 * HOUR, 60),
      bottle(now + HOUR, 60), // future → ignored
    ];
    expect(averageInterval(entries, now, 24 * HOUR)).toBe(3 * HOUR);
    expect(averageInterval(entries, now, 24 * HOUR, ['bottle', 'breast', 'solid'])).toBe(2 * HOUR);
    expect(averageInterval(entries, now, 4 * HOUR)).toBeNull();
  });
});

describe('dailyAggregates', () => {
  it('returns N zero-filled local days, oldest first', () => {
    const now = local(2026, 10, 5, 10);
    const entries = [
      bottle(local(2026, 10, 3, 8), 100),
      bottle(local(2026, 10, 3, 11), 50),
      bottle(local(2026, 10, 3, 15), 80),
      breast(local(2026, 10, 5, 7), [['left', 10]]),
    ];
    const days = dailyAggregates(entries, 3, now);
    expect(days.map((d) => d.date)).toEqual(['2026-10-03', '2026-10-04', '2026-10-05']);
    expect(days[0]).toMatchObject({ feedCount: 3, avgIntervalMs: 3.5 * HOUR });
    expect(days[0]?.bottleMl.total).toBe(230);
    expect(days[1]).toMatchObject({ feedCount: 0, avgIntervalMs: null });
    expect(days[2]?.breastMs.total).toBe(10 * MIN);
    expect(days[2]?.dayStart).toBe(local(2026, 10, 5));
    expect(dailyAggregates(entries, 0, now)).toEqual([]);
  });

  it('produces one bucket per calendar day across DST changes', () => {
    const spring = dailyAggregates([], 4, local(2026, 3, 29, 12)).map((d) => d.date);
    expect(spring).toEqual(['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29']);
    const autumn = dailyAggregates(
      [bottle(local(2026, 10, 25, 1, 30), 70), bottle(local(2026, 10, 25, 23, 30), 30)],
      3,
      local(2026, 10, 26, 0, 10),
    );
    expect(autumn.map((d) => d.date)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(autumn[1]?.bottleMl.total).toBe(100);
    // 01:30 → 23:30 is 22h on the wall clock, but the repeated 01:00–02:00 hour makes it 23h real time.
    expect(autumn[1]?.avgIntervalMs).toBe(23 * HOUR);
  });
});

describe('groupByDay', () => {
  it('groups by local start day, newest day & entry first', () => {
    const a = bottle(local(2026, 10, 4, 9), 60, { id: 'a' });
    const b = breast(local(2026, 10, 4, 23, 55), [['left', 20]], { id: 'b' });
    const c = bottle(local(2026, 10, 5, 0, 10), 60, { id: 'c' });
    const d = solid(local(2026, 10, 5, 12), ['גזר'], { id: 'd' });
    const groups = groupByDay([a, c, d, b]);
    expect(groups.map((g) => [g.date, g.entries.map((e) => e.id)])).toEqual([
      ['2026-10-05', ['d', 'c']],
      ['2026-10-04', ['b', 'a']],
    ]);
    expect(groupByDay([])).toEqual([]);
  });

  it('groups correctly on the 23-hour spring-forward day', () => {
    const groups = groupByDay([
      bottle(local(2026, 3, 27, 0, 30), 60),
      bottle(local(2026, 3, 27, 3, 30), 60), // just after the 02:00→03:00 jump
      bottle(local(2026, 3, 27, 23, 59), 60),
      bottle(local(2026, 3, 28, 0, 0), 60),
    ]);
    expect(groups.map((g) => [g.date, g.entries.length])).toEqual([
      ['2026-03-28', 1],
      ['2026-03-27', 3],
    ]);
  });
});
