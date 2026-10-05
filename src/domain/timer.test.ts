import { describe, expect, it } from 'vitest';
import {
  currentSide,
  finishTimer,
  isPaused,
  isTimerStale,
  pauseTimer,
  resumeTimer,
  setTimerStart,
  startTimer,
  STALE_TIMER_MS,
  switchSide,
  timerElapsed,
  timerStartedAt,
} from './timer';
import { HOUR, MIN } from '../test/helpers';

const T0 = 1_790_000_000_000;

describe('timer transitions', () => {
  it('starts on a side and derives elapsed time from timestamps', () => {
    const t = startTimer('baby1', 'left', T0);
    expect(t).toEqual({ babyId: 'baby1', segments: [{ side: 'left', startedAt: T0 }] });
    expect(currentSide(t)).toBe('left');
    expect(isPaused(t)).toBe(false);
    expect(timerStartedAt(t)).toBe(T0);
    // "Reload" = same object read back later: elapsed keeps growing.
    const restored = JSON.parse(JSON.stringify(t)) as typeof t;
    expect(timerElapsed(restored, T0 + 7 * MIN)).toEqual({
      left: 7 * MIN,
      right: 0,
      total: 7 * MIN,
      currentSegment: 7 * MIN,
    });
  });

  it('switches side, closing the running segment', () => {
    let t = startTimer('baby1', 'left', T0);
    t = switchSide(t, T0 + 10 * MIN);
    expect(currentSide(t)).toBe('right');
    expect(t.segments).toEqual([
      { side: 'left', startedAt: T0, endedAt: T0 + 10 * MIN },
      { side: 'right', startedAt: T0 + 10 * MIN },
    ]);
    expect(timerElapsed(t, T0 + 15 * MIN)).toMatchObject({
      left: 10 * MIN,
      right: 5 * MIN,
      total: 15 * MIN,
    });
    // Explicit target equal to the running side is a no-op.
    expect(switchSide(t, T0 + 16 * MIN, 'right')).toBe(t);
  });

  it('pauses and resumes on the same side, excluding the pause from totals', () => {
    let t = startTimer('baby1', 'right', T0);
    t = pauseTimer(t, T0 + 5 * MIN);
    expect(isPaused(t)).toBe(true);
    expect(pauseTimer(t, T0 + 6 * MIN)).toBe(t); // idempotent
    expect(timerElapsed(t, T0 + 30 * MIN)).toMatchObject({
      right: 5 * MIN,
      total: 5 * MIN,
      currentSegment: 0,
    });
    t = resumeTimer(t, T0 + 10 * MIN);
    expect(isPaused(t)).toBe(false);
    expect(resumeTimer(t, T0 + 11 * MIN)).toBe(t); // idempotent
    expect(currentSide(t)).toBe('right');
    expect(timerElapsed(t, T0 + 12 * MIN)).toMatchObject({
      right: 7 * MIN,
      total: 7 * MIN,
      currentSegment: 2 * MIN,
    });
  });

  it('switching while paused resumes on the other side', () => {
    let t = startTimer('baby1', 'left', T0);
    t = pauseTimer(t, T0 + 5 * MIN);
    t = switchSide(t, T0 + 8 * MIN);
    expect(isPaused(t)).toBe(false);
    expect(currentSide(t)).toBe('right');
    expect(timerElapsed(t, T0 + 10 * MIN)).toMatchObject({ left: 5 * MIN, right: 2 * MIN });
    // Explicit same side while paused also resumes.
    const p = pauseTimer(startTimer('baby1', 'left', T0), T0 + MIN);
    expect(currentSide(switchSide(p, T0 + 2 * MIN, 'left'))).toBe('left');
  });

  it('never moves time backwards (clock skew)', () => {
    let t = startTimer('baby1', 'left', T0);
    t = switchSide(t, T0 - MIN);
    expect(t.segments[0]).toEqual({ side: 'left', startedAt: T0, endedAt: T0 });
    expect(t.segments[1]?.startedAt).toBe(T0);
    expect(timerElapsed(startTimer('b', 'left', T0), T0 - MIN).total).toBe(0);
    const paused = pauseTimer(startTimer('b', 'left', T0), T0 - MIN);
    expect(paused.pausedAt).toBe(T0);
  });

  it('handles a malformed empty timer defensively', () => {
    const empty = { babyId: 'b', segments: [] };
    expect(currentSide(empty)).toBeNull();
    expect(timerStartedAt(empty)).toBeNull();
    expect(isTimerStale(empty, T0)).toBe(false);
    expect(currentSide(switchSide(empty, T0))).toBe('left');
    expect(currentSide(resumeTimer({ ...empty, pausedAt: T0 }, T0))).toBe('left');
    expect(finishTimer(empty, T0, 'x')).toBeNull();
  });
});

describe('finishTimer', () => {
  it('produces a breast entry with closed segments', () => {
    let t = startTimer('baby1', 'left', T0);
    t = switchSide(t, T0 + 10 * MIN);
    const entry = finishTimer(t, T0 + 18 * MIN, 'e1');
    expect(entry).toEqual({
      id: 'e1',
      babyId: 'baby1',
      type: 'breast',
      startedAt: T0,
      endedAt: T0 + 18 * MIN,
      segments: [
        { side: 'left', startedAt: T0, endedAt: T0 + 10 * MIN },
        { side: 'right', startedAt: T0 + 10 * MIN, endedAt: T0 + 18 * MIN },
      ],
    });
  });

  it('ends at the pause instant when finished while paused', () => {
    let t = startTimer('baby1', 'left', T0);
    t = pauseTimer(t, T0 + 12 * MIN);
    const entry = finishTimer(t, T0 + 2 * HOUR, 'e2');
    expect(entry?.endedAt).toBe(T0 + 12 * MIN);
    expect(entry?.segments).toHaveLength(1);
  });

  it('drops zero-length segments and returns null if nothing remains', () => {
    let t = startTimer('baby1', 'left', T0);
    t = switchSide(t, T0); // zero-length left
    t = switchSide(t, T0 + 5 * MIN);
    t = switchSide(t, T0 + 5 * MIN); // zero-length right
    const entry = finishTimer(t, T0 + 9 * MIN, 'e3');
    // left(0) dropped; right 0–5 and right 5–9 touch → merged into one segment.
    expect(entry?.segments).toEqual([{ side: 'right', startedAt: T0, endedAt: T0 + 9 * MIN }]);
    expect(entry?.startedAt).toBe(T0);
    expect(finishTimer(startTimer('baby1', 'left', T0), T0, 'e4')).toBeNull();
  });

  it('keeps pause gaps as separate same-side segments', () => {
    let t = startTimer('baby1', 'left', T0);
    t = pauseTimer(t, T0 + 5 * MIN);
    t = resumeTimer(t, T0 + 7 * MIN);
    const entry = finishTimer(t, T0 + 10 * MIN, 'e6');
    expect(entry?.segments).toEqual([
      { side: 'left', startedAt: T0, endedAt: T0 + 5 * MIN },
      { side: 'left', startedAt: T0 + 7 * MIN, endedAt: T0 + 10 * MIN },
    ]);
  });

  it('can finish a forgotten timer at a corrected end time', () => {
    const t = startTimer('baby1', 'left', T0);
    const entry = finishTimer(t, T0 + 20 * MIN, 'e5');
    expect(entry?.endedAt).toBe(T0 + 20 * MIN);
  });
});

describe('isTimerStale', () => {
  it('flags timers started more than 6 hours ago', () => {
    const t = startTimer('baby1', 'left', T0);
    expect(STALE_TIMER_MS).toBe(6 * HOUR);
    expect(isTimerStale(t, T0 + 6 * HOUR)).toBe(false);
    expect(isTimerStale(t, T0 + 6 * HOUR + 1)).toBe(true);
    expect(isTimerStale(t, T0 + 2 * HOUR, HOUR)).toBe(true);
  });
});

describe('setTimerStart', () => {
  it('moves the first segment start earlier (forgot to press start)', () => {
    const t = startTimer('baby1', 'left', T0);
    const moved = setTimerStart(t, T0 - 6 * MIN, T0 + MIN);
    expect(moved.segments[0]).toEqual({ side: 'left', startedAt: T0 - 6 * MIN });
    expect(timerElapsed(moved, T0 + MIN).total).toBe(7 * MIN);
  });

  it('clamps to the end of a closed first segment and to now', () => {
    let t = startTimer('baby1', 'left', T0);
    t = switchSide(t, T0 + 5 * MIN);
    expect(setTimerStart(t, T0 + 9 * MIN, T0 + 10 * MIN).segments[0]?.startedAt).toBe(T0 + 5 * MIN);
    const running = startTimer('baby1', 'right', T0);
    expect(setTimerStart(running, T0 + 3 * HOUR, T0 + 2 * MIN).segments[0]?.startedAt).toBe(
      T0 + 2 * MIN,
    );
  });

  it('returns the same timer when nothing changes or it is empty', () => {
    const t = startTimer('baby1', 'left', T0);
    expect(setTimerStart(t, T0, T0 + MIN)).toBe(t);
    const empty = { babyId: 'baby1', segments: [] };
    expect(setTimerStart(empty, T0, T0)).toBe(empty);
  });
});
