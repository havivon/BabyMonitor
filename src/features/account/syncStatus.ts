import { formatTimeSince } from '../../domain/units';
import { he } from '../../i18n/he';
import type { SyncStatus } from '../../platform/cloud';

const s = he.account.sync;

/** Full status line for Settings ("מסונכרן · לפני 2 ד׳"). */
export function syncStatusText(
  status: SyncStatus,
  lastSyncedAt: number | null,
  now: number,
): string {
  switch (status) {
    case 'synced':
      return lastSyncedAt === null ? s.synced : s.syncedAgo(formatTimeSince(now - lastSyncedAt));
    case 'syncing':
      return s.syncing;
    case 'connecting':
      return s.connecting;
    case 'offline':
      return s.offline;
    case 'error':
      return s.error;
    case 'off':
      return s.off;
  }
}

/** Short label for the header indicator / its accessible name. */
export function syncStatusShort(status: SyncStatus): string {
  switch (status) {
    case 'offline':
      return s.offlineShort;
    case 'error':
      return s.errorShort;
    case 'synced':
      return s.synced;
    case 'syncing':
      return s.syncing;
    case 'connecting':
      return s.connecting;
    case 'off':
      return s.off;
  }
}
