/**
 * Pure helpers for creating/editing a breastfeed from per-side MINUTES (manual entry and the
 * simplified edit form). Timer-produced entries keep their exact segments unless the user
 * actually changes a side's minutes.
 */
import { breastDurations, otherSide } from '../../domain/feeding';
import { MS_PER_MINUTE } from '../../domain/dates';
import type { BreastEntry, BreastSegment, EpochMs, Side } from '../../domain/types';
import { formatDuration } from '../../domain/units';
import { SIDE_LABEL } from '../../i18n/he';

export type SideMinutes = Record<Side, number>;

/** Sequential segments starting at `startedAt`: `firstSide` first, then the other (zero sides skipped). */
export function segmentsFromMinutes(
  startedAt: EpochMs,
  minutes: SideMinutes,
  firstSide: Side,
): BreastSegment[] {
  const out: BreastSegment[] = [];
  let t = startedAt;
  for (const side of [firstSide, otherSide(firstSide)]) {
    const ms = Math.max(0, Math.round(minutes[side])) * MS_PER_MINUTE;
    if (ms <= 0) continue;
    out.push({ side, startedAt: t, endedAt: t + ms });
    t += ms;
  }
  return out;
}

/** Per-side minutes of an entry, rounded the way the UI shows them. */
export function entryMinutes(entry: Pick<BreastEntry, 'segments'>): SideMinutes {
  const d = breastDurations(entry);
  return { right: Math.round(d.right / MS_PER_MINUTE), left: Math.round(d.left / MS_PER_MINUTE) };
}

export interface BreastEdit {
  startedAt: EpochMs;
  minutes: SideMinutes;
  note: string;
}

/**
 * Applies an edit. If the per-side minutes are unchanged, the original segments (incl. pauses and
 * switches) are kept and only shifted to the new start; otherwise they are rebuilt sequentially in
 * the original side order. Returns `null` if no side has any minutes.
 */
export function applyBreastEdit(entry: BreastEntry, edit: BreastEdit): BreastEntry | null {
  const before = entryMinutes(entry);
  const unchanged = before.right === edit.minutes.right && before.left === edit.minutes.left;
  let segments: BreastSegment[];
  if (unchanged && entry.segments.length > 0) {
    const delta = edit.startedAt - entry.startedAt;
    segments = entry.segments.map((s) => ({
      ...s,
      startedAt: s.startedAt + delta,
      endedAt: s.endedAt + delta,
    }));
  } else {
    const first = [...entry.segments].sort((a, b) => a.startedAt - b.startedAt)[0];
    segments = segmentsFromMinutes(edit.startedAt, edit.minutes, first?.side ?? 'right');
  }
  const last = segments[segments.length - 1];
  const firstSeg = segments[0];
  if (!firstSeg || !last) return null;
  const next: BreastEntry = {
    ...entry,
    startedAt: firstSeg.startedAt,
    endedAt: last.endedAt,
    segments,
  };
  const note = edit.note.trim();
  if (note) next.note = note;
  else delete next.note;
  return next;
}

/** Consecutive same-side segments (split by a pause) are shown as one: "ימין 12 ד׳ · שמאל 9 ד׳". */
export function breastMeta(entry: Pick<BreastEntry, 'segments'>): string {
  const runs: { side: Side; ms: number }[] = [];
  for (const seg of [...entry.segments].sort((a, b) => a.startedAt - b.startedAt)) {
    const ms = Math.max(0, seg.endedAt - seg.startedAt);
    const last = runs[runs.length - 1];
    if (last?.side === seg.side) last.ms += ms;
    else runs.push({ side: seg.side, ms });
  }
  return runs.map((r) => `${SIDE_LABEL[r.side]} ${formatDuration(r.ms)}`).join(' · ');
}
