import { useEffect, useState } from 'react';
import type { SyncStatus } from '../../platform/cloud';

/** Busy statuses only show after this long, so quick syncs don't flicker (DESIGN §15.6). */
export const SYNCING_DELAY_MS = 600;

const isBusy = (s: SyncStatus): boolean => s === 'syncing' || s === 'connecting';

/**
 * The status to display: a busy status ('syncing' / 'connecting') is shown only once it has
 * lasted 600 ms; until then the previous calm status stays on screen.
 */
export function useDelayedSyncing(status: SyncStatus): SyncStatus {
  const [shown, setShown] = useState<SyncStatus>(isBusy(status) ? 'synced' : status);
  const [prevStatus, setPrevStatus] = useState(status);
  // Non-busy changes apply immediately (state adjusted during render).
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (!isBusy(status)) setShown(status);
  }
  useEffect(() => {
    if (!isBusy(status)) return;
    const id = setTimeout(() => setShown(status), SYNCING_DELAY_MS);
    return () => clearTimeout(id);
  }, [status]);
  return shown;
}
