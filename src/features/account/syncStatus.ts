import { formatTimeSince } from '../../domain/units';
import { he } from '../../i18n/he';

/** "לפני 2 ד׳" / "עכשיו" since the last successful sync. */
export function syncedAgo(lastSyncedAt: number | null, now: number): string | null {
  return lastSyncedAt === null ? null : formatTimeSince(now - lastSyncedAt);
}

/** Accessible name of the "synced" header indicator: "מסונכרן · לפני 2 ד׳". */
export function syncedLabel(lastSyncedAt: number | null, now: number): string {
  const ago = syncedAgo(lastSyncedAt, now);
  return ago ? `${he.account.sync.synced} · ${ago}` : he.account.sync.synced;
}
