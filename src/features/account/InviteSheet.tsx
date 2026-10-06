import { CircleAlert, Clock, Copy, RefreshCw, Send, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { dayMonth, weekdayShort } from '../../i18n/format';
import { he } from '../../i18n/he';
import { cloud, useCloud, type Invite } from '../../platform/cloud';
import { useCloudAction } from './useCloudAction';

const t = he.account.invite;
const PLACEHOLDER = '······';

/** Web Share API when the platform has it (phones); otherwise only copy is offered. */
const canShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** "יום ג׳, 13 באוקטובר" */
const expiryText = (at: number): string => {
  const d = new Date(at);
  return `${weekdayShort(d)}, ${dayMonth(d, at)}`;
};

/**
 * Invite the other parent (DESIGN §15.5): a 6-character code (created when the sheet opens),
 * shown big and spelled out for screen readers, with copy and Web Share. "יצירת קוד חדש" replaces
 * it (the old one stays valid until it expires).
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
  // Each open is a fresh sheet instance (keyed by the host): create the code once on mount.
  useEffect(create, []); // eslint-disable-line react-hooks/exhaustive-deps

  const familyName = family?.name ?? '';
  const code = invite?.code ?? PLACEHOLDER;
  const loading = action.pending || !invite;
  const share = canShare();

  const copy = async (): Promise<void> => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      toast.show({ text: t.copied });
    } catch {
      toast.show({ text: t.copyFailed, variant: 'error' });
    }
  };

  const shareCode = async (): Promise<void> => {
    if (!invite) return;
    try {
      await navigator.share({ text: t.shareText(invite.code, expiryText(invite.expiresAt)) });
    } catch {
      /* closed the share sheet — nothing to report */
    }
  };

  const footer = action.error ? undefined : (
    <>
      <button
        type="button"
        className={`btn btn--lg ${share ? 'btn--secondary' : 'btn--primary'}`}
        disabled={loading}
        onClick={() => void copy()}
      >
        <Copy aria-hidden="true" />
        {t.copy}
      </button>
      {share && (
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={loading}
          onClick={() => void shareCode()}
        >
          <Share2 aria-hidden="true" />
          {t.share}
        </button>
      )}
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t.title} icon={<Send />} footer={footer} dense>
      <p className="text-muted">
        {t.lead}
        <strong>{t.leadStrong}</strong>.
      </p>
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
      ) : (
        <>
          <div
            className={`code-display${loading ? ' code-display--loading' : ''}`}
            aria-busy={loading || undefined}
          >
            <span className="code-display__label">{t.codeLabel(familyName)}</span>
            <span
              className="code-display__code"
              role={loading ? undefined : 'img'}
              aria-label={loading ? undefined : Array.from(code).join(' ')}
            >
              <span>{code.slice(0, 3)}</span>
              <span>{code.slice(3)}</span>
            </span>
          </div>
          {invite && (
            <p className="disclaimer">
              <Clock aria-hidden="true" />
              <span>{t.validity(expiryText(invite.expiresAt))}</span>
            </p>
          )}
          <div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginInlineStart: 'calc(var(--space-4) * -1)' }}
              disabled={loading}
              onClick={create}
            >
              <RefreshCw aria-hidden="true" />
              {t.newCode}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
