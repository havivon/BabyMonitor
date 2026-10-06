import { CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { isCloudConfigured, useCloud } from '../../platform/cloud';
import { syncedLabel } from './syncStatus';
import { useDelayedSyncing } from './useDelayedSyncing';

const s = he.account.sync;

/**
 * Header sync indicator `a.sync-ind` (DESIGN §15.6), only when signed in AND in a family. Synced is a
 * quiet icon; syncing spins (after 600 ms); offline / error are labelled pills. Links to Settings →
 * "חשבון ומשפחה". Not a live region (the Settings sync row announces changes).
 */
export function SyncIndicator() {
  const { user, family, status, lastSyncedAt } = useCloud();
  const shown = useDelayedSyncing(status);
  const now = useNow(30_000);
  if (!isCloudConfigured || !user || !family) return null;

  let className = 'sync-ind';
  let label: string;
  let content;
  switch (shown) {
    case 'offline':
      className += ' sync-ind--offline';
      label = s.indOffline;
      content = (
        <>
          <CloudOff aria-hidden="true" />
          {s.offline}
        </>
      );
      break;
    case 'error':
      className += ' sync-ind--error';
      label = s.indError;
      content = (
        <>
          <CloudAlert aria-hidden="true" />
          {s.indErrorShort}
        </>
      );
      break;
    case 'syncing':
    case 'connecting':
      className += ' sync-ind--syncing';
      label = s.syncing;
      content = <RefreshCw aria-hidden="true" />;
      break;
    default:
      label = syncedLabel(lastSyncedAt, now);
      content = <CloudCheck aria-hidden="true" />;
  }

  return (
    <Link to="/settings" state={{ scrollTo: 'account' }} className={className} aria-label={label}>
      {content}
    </Link>
  );
}
