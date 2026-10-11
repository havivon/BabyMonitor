/**
 * Telling "I was removed from the family" apart from leaving it myself, without new contract
 * fields: the account UI marks its own exits (leave / sign out) just before calling the cloud,
 * and remembers the last family this device's account belonged to, so a removal that happened
 * while the app was closed is noticed on the next start too.
 */

const LAST_FAMILY_KEY = 'babymonitor:hints.lastFamily';

interface LastFamily {
  uid: string;
  familyId: string;
}

let ownExit = false;

/** Call right before `leaveFamily()` / `signOut()`; undo with `clearOwnFamilyExit` if it fails. */
export function markOwnFamilyExit(): void {
  ownExit = true;
}

export function clearOwnFamilyExit(): void {
  ownExit = false;
}

/** True (once) when the family was left by this device's own action. */
export function consumeOwnFamilyExit(): boolean {
  const was = ownExit;
  ownExit = false;
  return was;
}

export function readLastFamily(): LastFamily | null {
  try {
    const raw = localStorage.getItem(LAST_FAMILY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastFamily> | null;
    return typeof v?.uid === 'string' && typeof v.familyId === 'string'
      ? { uid: v.uid, familyId: v.familyId }
      : null;
  } catch {
    return null;
  }
}

export function writeLastFamily(value: LastFamily | null): void {
  try {
    if (value) localStorage.setItem(LAST_FAMILY_KEY, JSON.stringify(value));
    else localStorage.removeItem(LAST_FAMILY_KEY);
  } catch {
    /* storage unavailable: the in-session transition is still detected */
  }
}
