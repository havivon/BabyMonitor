import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { he } from '../../i18n/he';
import { isCloudConfigured, useCloud, type SyncStatus } from '../../platform/cloud';
import { syncStatusShort } from './syncStatus';

const ICON: Record<SyncStatus, LucideIcon> = {
  synced: CloudCheck,
  syncing: RefreshCw,
  connecting: Cloud,
  offline: CloudOff,
  error: CloudAlert,
  off: CloudOff,
};

/** Problems are visible (warning / danger tone); a healthy sync stays subtle (DESIGN/ACCOUNTS §6). */
const COLOR: Partial<Record<SyncStatus, string>> = {
  offline: 'var(--color-warning)',
  error: 'var(--color-danger)',
};

/**
 * Small header sync-status indicator, only when signed in. Links to Settings → "חשבון ומשפחה";
 * its accessible name states the status. Not a live region — the Settings line has the details.
 */
export function SyncIndicator() {
  const { user, status } = useCloud();
  if (!isCloudConfigured || !user) return null;
  const Icon = ICON[status];
  return (
    <Link
      to="/settings"
      className="icon-btn"
      aria-label={`${he.account.sync.label}: ${syncStatusShort(status)}`}
      title={syncStatusShort(status)}
      data-status={status}
      style={COLOR[status] ? { color: COLOR[status] } : undefined}
    >
      <Icon aria-hidden="true" />
    </Link>
  );
}
