import { CloudOff, LogIn, X } from 'lucide-react';
import { useState } from 'react';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { isCloudConfigured, useCloud } from '../../platform/cloud';
import { useActiveEntries } from '../../store';
import { noteVisible, readDismissedAt, writeDismissedAt } from './backupNote';
import { useAccountFlows } from './flowsContext';

const t = he.account.note;

/**
 * "Your data is not backed up" note (product owner, docs/ACCOUNTS.md §6).
 * - `home`: calm and dismissible; shown after the first logged feed; comes back ~2 weeks after a
 *   dismissal while still signed out.
 * - `settings`: persistent card at the top of Settings while signed out.
 * Hidden when the cloud isn't configured, before the auth state is known, and when signed in.
 */
export function BackupNote({ variant }: { variant: 'home' | 'settings' }) {
  const { ready, user } = useCloud();
  const flows = useAccountFlows();
  const entries = useActiveEntries();
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt);
  const now = useNow(60 * 60 * 1000);

  if (!isCloudConfigured || !ready || user) return null;
  if (variant === 'home') {
    if (entries.length === 0 || !noteVisible(dismissedAt, now)) return null;
  }

  const cta = (
    <button
      type="button"
      className={variant === 'home' ? 'btn btn--secondary btn--sm' : 'btn btn--primary btn--block'}
      onClick={() => flows.openSignIn()}
    >
      <LogIn aria-hidden="true" />
      {t.cta}
    </button>
  );

  return (
    <section className="banner banner--warning" aria-labelledby={`backup-note-${variant}`}>
      <CloudOff className="banner__icon" aria-hidden="true" />
      <div className="banner__body stack stack--2">
        <h2 className="banner__title" id={`backup-note-${variant}`}>
          {t.title}
        </h2>
        <p className="banner__text">{t.text}</p>
        <div>{cta}</div>
      </div>
      {variant === 'home' && (
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label={t.dismiss}
          onClick={() => {
            const at = Date.now();
            writeDismissedAt(at);
            setDismissedAt(at);
          }}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
