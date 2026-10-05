/**
 * Breastfeeding timer as pure, immutable transitions over `ActiveTimer`.
 *
 * The timer stores only timestamps — elapsed time is always DERIVED from `now`, so it keeps
 * counting correctly across app close, reload or device sleep.
 *
 * Invariants:
 * - Running: the last segment is open (`endedAt` undefined) and `pausedAt` is undefined.
 * - Paused: every segment is closed and `pausedAt` is set.
 * - Transitions never move time backwards: a `now` earlier than the open segment's start is clamped.
 */
import { MS_PER_HOUR } from './dates';
import { otherSide } from './feeding';
import type { ActiveTimer, BreastEntry, BreastSegment, EpochMs, Side, TimerSegment } from './types';

/** A timer whose first segment started longer ago than this is considered forgotten. */
export const STALE_TIMER_MS = 6 * MS_PER_HOUR;

export function startTimer(babyId: string, side: Side, now: EpochMs): ActiveTimer {
  return { babyId, segments: [{ side, startedAt: now }] };
}

export function isPaused(timer: ActiveTimer): boolean {
  return timer.pausedAt !== undefined;
}

/** The side currently (or, if paused, most recently) being fed on. */
export function currentSide(timer: ActiveTimer): Side | null {
  return timer.segments[timer.segments.length - 1]?.side ?? null;
}

/** Instant the timer was first started, or `null` for an empty timer. */
export function timerStartedAt(timer: ActiveTimer): EpochMs | null {
  return timer.segments[0]?.startedAt ?? null;
}

function closeOpenSegment(segments: readonly TimerSegment[], now: EpochMs): TimerSegment[] {
  return segments.map((seg) =>
    seg.endedAt === undefined ? { ...seg, endedAt: Math.max(seg.startedAt, now) } : seg,
  );
}

/** Latest instant recorded in the timer (used to clamp `now` so segments never overlap). */
function lastRecordedAt(timer: ActiveTimer): EpochMs {
  let t = timer.pausedAt ?? Number.NEGATIVE_INFINITY;
  for (const seg of timer.segments) t = Math.max(t, seg.startedAt, seg.endedAt ?? seg.startedAt);
  return t;
}

/**
 * Switches to the other side (or to `side` if given). Closes the running segment and opens a new one.
 * Switching while paused resumes the timer on the new side. Switching to the side already running is a no-op.
 */
export function switchSide(timer: ActiveTimer, now: EpochMs, side?: Side): ActiveTimer {
  const current = currentSide(timer);
  const target = side ?? (current ? otherSide(current) : 'left');
  if (!isPaused(timer) && target === current) return timer;
  const at = Math.max(now, lastRecordedAt(timer));
  return {
    babyId: timer.babyId,
    segments: [...closeOpenSegment(timer.segments, at), { side: target, startedAt: at }],
  };
}

/** Pauses a running timer (closes the open segment). No-op when already paused. */
export function pauseTimer(timer: ActiveTimer, now: EpochMs): ActiveTimer {
  if (isPaused(timer)) return timer;
  const at = Math.max(now, lastRecordedAt(timer));
  return { ...timer, segments: closeOpenSegment(timer.segments, at), pausedAt: at };
}

/** Resumes a paused timer on the same side it was paused on. No-op when running. */
export function resumeTimer(timer: ActiveTimer, now: EpochMs): ActiveTimer {
  if (!isPaused(timer)) return timer;
  const side = currentSide(timer) ?? 'left';
  const at = Math.max(now, lastRecordedAt(timer));
  return { babyId: timer.babyId, segments: [...timer.segments, { side, startedAt: at }] };
}

/**
 * Corrects when the feed started (the parent pressed start late). Moves the FIRST segment's start;
 * the new start is clamped so it is never after `now` nor after that segment's end (a segment can
 * never become negative). Returns the same object when nothing changes.
 */
export function setTimerStart(timer: ActiveTimer, startedAt: EpochMs, now: EpochMs): ActiveTimer {
  const [first, ...rest] = timer.segments;
  if (!first) return timer;
  const latest = Math.min(first.endedAt ?? now, now);
  const at = Math.min(startedAt, Math.max(latest, first.startedAt));
  if (at === first.startedAt) return timer;
  return { ...timer, segments: [{ ...first, startedAt: at }, ...rest] };
}

export interface TimerElapsed {
  left: number;
  right: number;
  total: number;
  /** Elapsed time of the current segment (0 when paused). */
  currentSegment: number;
}

/** Elapsed suckling time (ms) per side & total at `now`. Pauses are excluded. */
export function timerElapsed(timer: ActiveTimer, now: EpochMs): TimerElapsed {
  const out: TimerElapsed = { left: 0, right: 0, total: 0, currentSegment: 0 };
  for (const seg of timer.segments) {
    const d = Math.max(0, (seg.endedAt ?? now) - seg.startedAt);
    out[seg.side] += d;
    out.total += d;
    if (seg.endedAt === undefined) out.currentSegment = d;
  }
  return out;
}

/** True when the timer was started more than `maxAgeMs` (default 6 h) before `now` — likely forgotten. */
export function isTimerStale(timer: ActiveTimer, now: EpochMs, maxAgeMs = STALE_TIMER_MS): boolean {
  const started = timerStartedAt(timer);
  return started !== null && now - started > maxAgeMs;
}

/** Joins a segment onto the previous one when it continues the same side without a gap. */
function mergeContiguous(acc: BreastSegment[], seg: BreastSegment): BreastSegment[] {
  const prev = acc[acc.length - 1];
  if (prev && prev.side === seg.side && prev.endedAt === seg.startedAt) {
    acc[acc.length - 1] = { ...prev, endedAt: seg.endedAt };
  } else {
    acc.push(seg);
  }
  return acc;
}

/**
 * Finishes the timer into a breastfeed entry. If paused, the feed ends at the pause instant
 * (`now` is ignored). Zero-length segments are dropped and same-side segments that touch
 * (e.g. left → right(0 s) → left) are merged; pause gaps are preserved. Returns `null` if nothing remains
 * (e.g. started and finished in the same millisecond) — callers should then just discard the timer.
 */
export function finishTimer(timer: ActiveTimer, now: EpochMs, id: string): BreastEntry | null {
  const end = isPaused(timer) ? lastRecordedAt(timer) : Math.max(now, lastRecordedAt(timer));
  const segments: BreastSegment[] = closeOpenSegment(timer.segments, end)
    .map((s) => ({ side: s.side, startedAt: s.startedAt, endedAt: s.endedAt ?? end }))
    .filter((s) => s.endedAt > s.startedAt)
    .sort((a, b) => a.startedAt - b.startedAt)
    .reduce<BreastSegment[]>(mergeContiguous, []);
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last) return null;
  return {
    id,
    babyId: timer.babyId,
    type: 'breast',
    startedAt: first.startedAt,
    endedAt: last.endedAt,
    segments,
  };
}
