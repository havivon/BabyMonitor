import { Cloud, LogOut, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/toast';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { cloud, isCloudConfigured, useCloud } from '../../platform/cloud';
import { BackupNote } from './BackupNote';
import { cloudErrorMessage } from './cloudErrors';
import { useAccountFlows } from './flowsContext';
import { syncStatusText } from './syncStatus';

const a = he.account;
const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '?';

type Confirm = null | 'signOut' | 'leave';

/**
 * Settings → "חשבון ומשפחה" (docs/ACCOUNTS.md §6). Signed out: the persistent "not backed up" card.
 * Signed in: account, sync status line, family members + invite / leave (or create / join), sign out.
 * Renders nothing when the cloud isn't configured or the auth state isn't known yet.
 */
export function AccountSection() {
  const { ready, user, family, status, lastSyncedAt } = useCloud();
  const flows = useAccountFlows();
  const toast = useToast();
  const now = useNow(30_000);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  if (!isCloudConfigured || !ready) return null;

  if (!user) {
    return (
      <section className="section" style={{ gap: 'var(--space-2)' }} aria-label={a.section}>
        <BackupNote variant="settings" />
      </section>
    );
  }

  const runConfirmed = async (): Promise<void> => {
    const which = confirm;
    if (!which || busy) return;
    setBusy(true);
    try {
      if (which === 'signOut') {
        await cloud.signOut();
        toast.show({ text: a.signedOut });
      } else {
        await cloud.leaveFamily();
        toast.show({ text: a.family.left });
      }
    } catch (e) {
      const message = cloudErrorMessage(e);
      if (message) toast.show({ text: message, variant: 'error' });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const displayName = user.displayName ?? user.email ?? '';
  const provider = user.provider === 'google' ? a.providerGoogle : a.providerPassword;

  return (
    <section className="section" style={{ gap: 'var(--space-2)' }} aria-labelledby="account-title">
      <h2 className="section__eyebrow" id="account-title">
        {a.section}
      </h2>
      <ul className="list" role="list">
        <li>
          <div className="row">
            <span className="avatar" aria-hidden="true">
              {initialOf(displayName)}
            </span>
            <span className="row__body">
              <span className="row__title">{displayName}</span>
              <span className="row__sub">
                {user.email && user.email !== displayName && (
                  <>
                    <bdi>{user.email}</bdi> ·{' '}
                  </>
                )}
                {provider}
              </span>
            </span>
          </div>
        </li>
        <li>
          <div className="row">
            <span className="row__icon" aria-hidden="true">
              <Cloud />
            </span>
            <span className="row__body">
              <span className="row__title">{a.sync.label}</span>
              <span className="row__sub" role="status">
                {syncStatusText(status, lastSyncedAt, now)}
              </span>
            </span>
          </div>
        </li>
      </ul>

      {family ? (
        <>
          <h3 className="section__eyebrow">
            {a.family.members} · {family.name}
          </h3>
          <ul className="list" role="list">
            {family.members.map((m, i) => (
              <li key={m.uid}>
                <div className="row">
                  <span className={`avatar${i % 2 ? ' avatar--alt' : ''}`} aria-hidden="true">
                    {initialOf(m.name)}
                  </span>
                  <span className="row__body">
                    <span className="row__title">
                      {m.name}{' '}
                      {m.uid === user.uid && <span className="text-muted">{a.family.you}</span>}
                    </span>
                  </span>
                </div>
              </li>
            ))}
            <li>
              <button type="button" className="row row--primary" onClick={() => flows.openInvite()}>
                <span className="row__icon" aria-hidden="true">
                  <UserPlus />
                </span>
                <span className="row__body">
                  <span className="row__title">{a.family.invite}</span>
                </span>
              </button>
            </li>
            <li>
              <button type="button" className="row row--danger" onClick={() => setConfirm('leave')}>
                <span className="row__icon" aria-hidden="true">
                  <Users />
                </span>
                <span className="row__body">
                  <span className="row__title">{a.family.leave}</span>
                </span>
              </button>
            </li>
          </ul>
        </>
      ) : (
        <ul className="list" role="list">
          <li>
            <button
              type="button"
              className="row row--primary"
              onClick={() => flows.openFamilySetup('choose')}
            >
              <span className="row__icon" aria-hidden="true">
                <Users />
              </span>
              <span className="row__body">
                <span className="row__title">{a.family.create}</span>
                <span className="row__sub">{a.family.none}</span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className="row" onClick={() => flows.openFamilySetup('join')}>
              <span className="row__icon" aria-hidden="true">
                <UserPlus />
              </span>
              <span className="row__body">
                <span className="row__title">{a.family.join}</span>
              </span>
            </button>
          </li>
        </ul>
      )}

      <ul className="list" role="list">
        <li>
          <button type="button" className="row row--danger" onClick={() => setConfirm('signOut')}>
            <span className="row__icon" aria-hidden="true">
              <LogOut />
            </span>
            <span className="row__body">
              <span className="row__title">{a.signOut}</span>
            </span>
          </button>
        </li>
      </ul>

      <ConfirmDialog
        open={confirm === 'signOut'}
        title={a.signOutTitle}
        text={a.signOutText}
        confirmLabel={a.signOutConfirm}
        danger
        icon={<LogOut aria-hidden="true" />}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'leave'}
        title={a.family.leaveTitle}
        text={a.family.leaveText}
        confirmLabel={a.family.leaveConfirm}
        danger
        icon={<Users aria-hidden="true" />}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
