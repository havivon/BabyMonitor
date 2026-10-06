import { CircleAlert, Copy, LoaderCircle, RefreshCw, Share2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { formatClock } from '../../domain/dates';
import { dayMonth } from '../../i18n/format';
import { he } from '../../i18n/he';
import { cloud, useCloud, type Invite } from '../../platform/cloud';
import { useCloudAction } from './useCloudAction';

const t = he.account.invite;

/** Web Share API when the platform has it (phones), else only copy is offered. */
const canShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Invite the other parent: creates a 6-character code (7-day expiry) and offers share (Web Share
 * API) and copy (Clipboard API, with a Hebrew fallback message when copying is blocked).
 */
export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { family } = useCloud();
  const [invite, setInvite] = useState<Invite | null>(null);
  const action = useCloudAction();
  const { run } = action;

  const create = (): void => {
    void run(async () => setInvite(await cloud.createInvite()));
  };
  // Create a code as soon as the sheet opens (each open gets a fresh sheet instance).
  useEffect(create, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shareText = invite ? t.shareText(family?.name ?? he.appName, invite.code) : '';

  const share = async (): Promise<void> => {
    try {
      await navigator.share({ text: shareText });
    } catch {
      /* the user closed the share sheet — nothing to report */
    }
  };

  const copy = async (): Promise<void> => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      toast.show({ text: t.copied });
    } catch {
      toast.show({ text: t.copyFailed, variant: 'error' });
    }
  };

  const expires = invite ? new Date(invite.expiresAt) : null;

  return (
    <Sheet open={open} onClose={onClose} title={t.title} icon={<UserPlus />}>
      <p className="text-muted">{t.lead}</p>
      {action.error ? (
        <>
          <div className="banner banner--danger" role="alert">
            <CircleAlert className="banner__icon" aria-hidden="true" />
            <div className="banner__body">
              <span className="banner__text">{action.error}</span>
            </div>
          </div>
          <button type="button" className="btn btn--secondary btn--block" onClick={create}>
            <RefreshCw aria-hidden="true" />
            {t.retry}
          </button>
        </>
      ) : !invite ? (
        <p className="text-muted cluster" role="status">
          <LoaderCircle aria-hidden="true" />
          {t.loading}
        </p>
      ) : (
        <>
          <div className="card card--flat stack stack--2" style={{ alignItems: 'center' }}>
            <span className="text-sm text-muted" id="invite-code-label">
              {t.codeLabel}
            </span>
            <output
              className="stepper__number"
              aria-labelledby="invite-code-label"
              style={{ letterSpacing: '0.15em', userSelect: 'all' }}
            >
              {invite.code}
            </output>
            {expires && (
              <span className="text-sm text-muted">
                {t.expires} {dayMonth(expires)},{' '}
                <span className="ltr num">{formatClock(invite.expiresAt)}</span>
              </span>
            )}
          </div>
          <div className="grid-2">
            {canShare() && (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => void share()}
              >
                <Share2 aria-hidden="true" />
                {t.share}
              </button>
            )}
            <button
              type="button"
              className={`btn btn--lg ${canShare() ? 'btn--secondary' : 'btn--primary'}`}
              style={canShare() ? undefined : { gridColumn: '1 / -1' }}
              onClick={() => void copy()}
            >
              <Copy aria-hidden="true" />
              {t.copy}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
