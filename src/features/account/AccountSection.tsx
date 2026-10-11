import {
  CloudAlert,
  CloudCheck,
  CloudOff,
  DoorOpen,
  HousePlus,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GoogleMark } from '../../components/GoogleMark';
import { useToast } from '../../components/toast';
import { toDateKey } from '../../domain/dates';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import {
  cloud,
  isCloudConfigured,
  useCloud,
  type FamilyMember,
  type SyncStatus,
} from '../../platform/cloud';
import { formatDateNumeric } from '../growth/ui/format';
import { BackupNote } from './BackupNote';
import { clearOwnFamilyExit, markOwnFamilyExit } from './familyExit';
import { useAccountFlows } from './flowsContext';
import { initialOf } from './names';
import { NameSheet } from './NameSheet';
import { syncedAgo } from './syncStatus';
import { useCloudAction } from './useCloudAction';

const a = he.account;
const s = a.sync;
type Confirm = null | 'signOut' | 'leave';
type NameEdit = 'family' | 'me';
const f = a.family;

const SYNC_ROW: Record<
  Exclude<SyncStatus, 'off'>,
  { tone: string; icon: ReactNode; title: string }
> = {
  synced: { tone: 'row--success', icon: <CloudCheck />, title: s.synced },
  syncing: { tone: 'row--syncing', icon: <RefreshCw />, title: s.syncing },
  connecting: { tone: 'row--syncing', icon: <RefreshCw />, title: s.connecting },
  offline: { tone: 'row--warning', icon: <CloudOff />, title: s.offline },
  error: { tone: 'row--error', icon: <CloudAlert />, title: s.error },
};

/**
 * Settings → "חשבון ומשפחה" (DESIGN §15.4), the first section of Settings.
 * Signed out: the persistent benefits card. Signed in: account + sync status (polite live region,
 * "ניסיון חוזר" on error), family (members, invite) or create/join, sign out and leave family
 * (each confirmed). Renders nothing when the cloud isn't configured or auth isn't known yet.
 */
export function AccountSection() {
  // A module constant: when the cloud isn't configured nothing below runs (no router/cloud hooks).
  return isCloudConfigured ? <ConfiguredAccountSection /> : null;
}

function ConfiguredAccountSection() {
  const { ready, user, family, status, lastSyncedAt } = useCloud();
  const flows = useAccountFlows();
  const toast = useToast();
  const now = useNow(30_000);
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const retry = useCloudAction();
  const session = useCloudAction();
  const removal = useCloudAction();
  /** Name sheet: which name, a fresh key per open; kept after close for the exit animation. */
  const [nameEdit, setNameEdit] = useState<{ kind: NameEdit; n: number } | null>(null);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  /** Member being removed (kept after close so the dialog's exit shows the name). */
  const [toRemove, setToRemove] = useState<FamilyMember | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  // Arrived from the header sync indicator: bring this section into view (after the route's
  // scroll-to-top, which runs in a parent effect).
  const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
  useEffect(() => {
    if (scrollTo !== 'account') return;
    const id = requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(id);
  }, [scrollTo, user]);

  // Errors of actions outside forms go to a toast (DESIGN §15.3 table).
  useToastOnError(session.error, session.clearError);
  useToastOnError(retry.error, retry.clearError);
  useToastOnError(removal.error, removal.clearError);

  if (!ready) return null;
  if (!user) return <BackupNote variant="settings" />;

  const runConfirmed = async (): Promise<void> => {
    const which = confirm;
    setConfirm(null);
    if (!which) return;
    markOwnFamilyExit(); // not "removed by someone else" (useRemovedFromFamilyNotice)
    const ok = await session.run(() =>
      which === 'signOut' ? cloud.signOut() : cloud.leaveFamily(),
    );
    if (ok) toast.show({ text: which === 'signOut' ? a.signedOut : a.family.left });
    else clearOwnFamilyExit();
  };

  const openNameEdit = (kind: NameEdit): void => {
    setNameEdit((prev) => ({ kind, n: (prev?.n ?? 0) + 1 }));
    setNameEditOpen(true);
  };

  const confirmRemove = async (): Promise<void> => {
    const member = toRemove;
    setRemoveOpen(false);
    if (!member) return;
    if (await removal.run(() => cloud.removeMember(member.uid)))
      toast.show({ text: f.removed(member.name) });
  };

  const displayName = user.displayName ?? user.email ?? '';
  const sync = status === 'off' ? null : SYNC_ROW[status];
  const syncSub =
    status === 'synced'
      ? syncedAgo(lastSyncedAt, now)
      : status === 'offline'
        ? s.offlineSub
        : status === 'error'
          ? s.errorSub
          : null;
  const me = family?.members.find((m) => m.uid === user.uid);
  const isCreator = family !== null && family.createdBy === user.uid;
  const others = family?.members.filter((m) => m.uid !== user.uid) ?? [];
  const members = me ? [me, ...others] : others;

  return (
    <section
      ref={sectionRef}
      className="section"
      style={{ gap: 'var(--space-2)' }}
      aria-labelledby="account-title"
    >
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
              {user.email && (
                <span className="row__sub ltr" style={{ textAlign: 'right' }}>
                  {user.email}
                </span>
              )}
            </span>
            <span
              className="row__end"
              role="img"
              aria-label={user.provider === 'google' ? a.providerGoogle : a.providerPassword}
            >
              {user.provider === 'google' ? <GoogleMark size={18} /> : <Mail aria-hidden="true" />}
            </span>
          </div>
        </li>
        {sync && (
          <li>
            <div className={`row ${sync.tone}`} role="status">
              <span className="row__icon" aria-hidden="true">
                {sync.icon}
              </span>
              <span className="row__body">
                <span className="row__title">{sync.title}</span>
                {syncSub && <span className="row__sub">{syncSub}</span>}
              </span>
              {status === 'error' && (
                <span className="row__end">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={retry.pending}
                    aria-busy={retry.pending || undefined}
                    onClick={() => void retry.run(() => cloud.retrySync())}
                  >
                    {s.retry}
                  </button>
                </span>
              )}
            </div>
          </li>
        )}
      </ul>

      {family ? (
        <ul className="list" role="list" aria-label={a.family.listLabel}>
          <li>
            <div className="row row--header">
              <span className="row__body">
                <span className="row__title">{family.name}</span>
                <span className="row__sub">{a.family.members(family.members.length)}</span>
              </span>
              <span className="row__end">
                <span className="avatar-stack" aria-hidden="true">
                  {members.map((m, i) => (
                    <span key={m.uid} className={`avatar avatar--sm${i % 2 ? ' avatar--alt' : ''}`}>
                      {initialOf(m.name)}
                    </span>
                  ))}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label={f.editFamilyName}
                  onClick={() => openNameEdit('family')}
                >
                  <Pencil aria-hidden="true" />
                </button>
              </span>
            </div>
          </li>
          {members.map((m, i) => (
            <li key={m.uid}>
              <div className="row">
                <span className={`avatar${i % 2 ? ' avatar--alt' : ''}`} aria-hidden="true">
                  {initialOf(m.name)}
                </span>
                <span className="row__body">
                  <span className="row__title">{m.name}</span>
                  {m.uid !== user.uid && (
                    <span className="row__sub">
                      {a.family.joinedOn}
                      <span className="ltr num">{formatDateNumeric(toDateKey(m.joinedAt))}</span>
                    </span>
                  )}
                </span>
                {m.uid === user.uid ? (
                  <span className="row__end">
                    <span className="badge">{a.family.me}</span>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      aria-label={f.editMyName}
                      onClick={() => openNameEdit('me')}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                  </span>
                ) : (
                  isCreator && (
                    <span className="row__end">
                      <button
                        type="button"
                        className="btn btn--ghost-danger btn--sm"
                        aria-label={f.removeAria(m.name)}
                        disabled={removal.pending}
                        aria-busy={(removal.pending && toRemove?.uid === m.uid) || undefined}
                        onClick={() => {
                          setToRemove(m);
                          setRemoveOpen(true);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        {f.remove}
                      </button>
                    </span>
                  )
                )}
              </div>
            </li>
          ))}
          <li>
            <button type="button" className="row row--primary" onClick={() => flows.openInvite()}>
              <span className="row__icon" aria-hidden="true">
                <Send />
              </span>
              <span className="row__body">
                <span className="row__title">{a.family.invite}</span>
              </span>
            </button>
          </li>
        </ul>
      ) : (
        <ul className="list" role="list" aria-label={a.family.listLabel}>
          <li>
            <div className="row row--header">
              <span className="row__body">
                <span className="row__title">{a.family.noneTitle}</span>
                <span className="row__sub">{a.family.noneText}</span>
              </span>
            </div>
          </li>
          <li>
            <button
              type="button"
              className="row row--primary"
              onClick={() => flows.openFamilySetup('choose')}
            >
              <span className="row__icon" aria-hidden="true">
                <HousePlus />
              </span>
              <span className="row__body">
                <span className="row__title">{a.family.create}</span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="row row--primary"
              onClick={() => flows.openFamilySetup('join')}
            >
              <span className="row__icon" aria-hidden="true">
                <KeyRound />
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
          <button
            type="button"
            className="row"
            disabled={session.pending}
            onClick={() => setConfirm('signOut')}
          >
            <span className="row__icon" aria-hidden="true">
              <LogOut className="flip-rtl" />
            </span>
            <span className="row__body">
              <span className="row__title">{a.signOut}</span>
            </span>
          </button>
        </li>
        {family && (
          <li>
            <button
              type="button"
              className="row row--danger"
              disabled={session.pending}
              onClick={() => setConfirm('leave')}
            >
              <span className="row__icon" aria-hidden="true">
                <DoorOpen />
              </span>
              <span className="row__body">
                <span className="row__title">{a.family.leave}</span>
              </span>
            </button>
          </li>
        )}
      </ul>

      <ConfirmDialog
        open={confirm === 'signOut'}
        title={a.signOutTitle}
        text={a.signOutText}
        confirmLabel={a.signOutConfirm}
        tone="primary"
        icon={<LogOut className="flip-rtl" aria-hidden="true" />}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'leave'}
        title={a.family.leaveTitle(family?.name ?? '')}
        text={a.family.leaveText}
        confirmLabel={a.family.leaveConfirm}
        danger
        icon={<DoorOpen aria-hidden="true" />}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={removeOpen}
        title={f.removeTitle(toRemove?.name ?? '')}
        text={f.removeText(toRemove?.name ?? '')}
        confirmLabel={f.removeConfirm}
        danger
        icon={<Trash2 aria-hidden="true" />}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveOpen(false)}
      />
      {nameEdit && family && (
        <NameSheet
          key={nameEdit.n}
          open={nameEditOpen}
          onClose={() => setNameEditOpen(false)}
          {...(nameEdit.kind === 'family'
            ? {
                title: f.familyNameTitle,
                label: f.familyNameLabel,
                hint: f.familyNameHint,
                initial: family.name,
                onSave: (name: string) => cloud.renameFamily(name),
                onSaved: () => {
                  setNameEditOpen(false);
                  toast.show({ text: f.familyRenamed });
                },
              }
            : {
                title: f.myNameTitle,
                label: f.myNameLabel,
                hint: f.myNameHint,
                initial: me?.name ?? displayName,
                onSave: (name: string) => cloud.updateMyName(name),
                onSaved: () => {
                  setNameEditOpen(false);
                  toast.show({ text: f.myNameUpdated });
                },
              })}
        />
      )}
    </section>
  );
}

/** Shows a cloud error message as an error toast once, then clears it. */
function useToastOnError(message: string | null, clear: () => void): void {
  const toast = useToast();
  useEffect(() => {
    if (!message) return;
    toast.show({ text: message, variant: 'error' });
    clear();
  }, [message, clear, toast]);
}
