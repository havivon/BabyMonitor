/**
 * Device-local memory of the dismissed sign-in note (`hints.signInNoteDismissedAt`, never synced —
 * docs/ACCOUNTS.md §3, DESIGN §15.2).
 */
export const NOTE_DISMISSED_KEY = 'babymonitor:hints.signInNoteDismissedAt';
/** "לא עכשיו" hides the Home note for 14 days (product owner / DESIGN §15.2). */
export const NOTE_RESHOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Also remembered for the session, so blocked storage can't make the note come straight back. */
let dismissedThisSession: number | null = null;

export function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(NOTE_DISMISSED_KEY);
    const n = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(n) ? n : dismissedThisSession;
  } catch {
    return dismissedThisSession;
  }
}

export function writeDismissedAt(at: number): void {
  dismissedThisSession = at;
  try {
    localStorage.setItem(NOTE_DISMISSED_KEY, String(at));
  } catch {
    /* storage blocked — the session memory above still applies */
  }
}

/** Test hook: forget the session memory. */
export function resetNoteSession(): void {
  dismissedThisSession = null;
}

/** Whether a note dismissed at `dismissedAt` should show again at `now`. */
export const noteVisible = (dismissedAt: number | null, now: number): boolean =>
  dismissedAt === null || now - dismissedAt >= NOTE_RESHOW_MS;
