/** Device-local memory of the dismissed "not backed up" note (never synced — docs/ACCOUNTS.md §3). */
export const NOTE_DISMISSED_KEY = 'babymonitor:cloud-note-dismissed-at';
/** A dismissed note comes back after ~2 weeks if the user is still signed out (product owner). */
export const NOTE_RESHOW_MS = 14 * 24 * 60 * 60 * 1000;

export function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(NOTE_DISMISSED_KEY);
    const n = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null; // storage blocked: the note simply shows
  }
}

export function writeDismissedAt(at: number): void {
  try {
    localStorage.setItem(NOTE_DISMISSED_KEY, String(at));
  } catch {
    /* storage blocked — dismissal lasts for this session only */
  }
}

/** Whether a note dismissed at `dismissedAt` should show again at `now`. */
export const noteVisible = (dismissedAt: number | null, now: number): boolean =>
  dismissedAt === null || now - dismissedAt >= NOTE_RESHOW_MS;
