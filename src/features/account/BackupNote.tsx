import { CloudOff, CloudUpload, LogIn, RefreshCw, Smartphone } from 'lucide-react';
import { useId, useState } from 'react';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { isCloudConfigured, useCloud } from '../../platform/cloud';
import { useActiveEntries, useActiveTimer } from '../../store';
import { noteVisible, readDismissedAt, writeDismissedAt } from './backupNote';
import { useAccountFlows } from './flowsContext';

const t = he.account.note;

/**
 * "הנתונים שמורים רק בטלפון הזה" (DESIGN §15.2; product owner: say plainly it is NOT backed up).
 * - `home`: compact card under the quick-add tiles; only after the first entry, never during a
 *   running feed; "לא עכשיו" hides it for 14 days (device-local).
 * - `settings`: full benefits card, first in Settings, not dismissible.
 * Renders nothing when the cloud isn't configured, before the auth state is known, or signed in.
 */
export function BackupNote({ variant }: { variant: 'home' | 'settings' }) {
  const titleId = useId();
  const { ready, user } = useCloud();
  const flows = useAccountFlows();
  const entries = useActiveEntries();
  const timer = useActiveTimer();
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt);
  const now = useNow(60 * 60 * 1000);

  if (!isCloudConfigured || !ready || user) return null;

  const signIn = (
    <>
      <LogIn className="flip-rtl" aria-hidden="true" />
      {t.cta}
    </>
  );

  if (variant === 'home') {
    if (entries.length === 0 || timer || !noteVisible(dismissedAt, now)) return null;
    return (
      <section className="card benefits benefits--compact" aria-labelledby={titleId}>
        <div className="benefits__head">
          <span className="benefits__icon" aria-hidden="true">
            <CloudUpload />
          </span>
          <div className="benefits__body">
            <h2 className="benefits__title" id={titleId}>
              {t.title}
            </h2>
            <p className="benefits__text">{t.homeText}</p>
          </div>
        </div>
        <div className="benefits__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => flows.openSignIn()}
          >
            {signIn}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const at = Date.now();
              writeDismissedAt(at);
              setDismissedAt(at);
            }}
          >
            {t.notNow}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card benefits" aria-labelledby={titleId}>
      <div className="benefits__head">
        <span className="benefits__icon" aria-hidden="true">
          <CloudOff />
        </span>
        <div className="benefits__body">
          <h2 className="benefits__title" id={titleId}>
            {t.title}
          </h2>
          <p className="benefits__text">{t.settingsText}</p>
        </div>
      </div>
      <ul className="benefits__list" role="list">
        <li className="benefits__item">
          <CloudUpload aria-hidden="true" />
          <span>{t.benefitBackup}</span>
        </li>
        <li className="benefits__item">
          <RefreshCw aria-hidden="true" />
          <span>{t.benefitShare}</span>
        </li>
        <li className="benefits__item">
          <Smartphone aria-hidden="true" />
          <span>{t.benefitRestore}</span>
        </li>
      </ul>
      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => flows.openSignIn()}
      >
        {signIn}
      </button>
      <p className="benefits__note">{t.settingsNote}</p>
    </section>
  );
}
