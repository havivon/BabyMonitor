import { Droplet, LogIn, ShieldCheck, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { parseBackup } from '../../domain/backup';
import { useToast } from '../../components/toast';
import { he } from '../../i18n/he';
import { isCloudConfigured } from '../../platform/cloud';
import { useAccountFlows } from '../account/flowsContext';
import { appStore, useAppStore, type NewBaby } from '../../store';
import { BabyForm } from './BabyForm';

/**
 * First run (DESIGN §7.1) — and the "add a child" flow from the baby switcher once a baby exists.
 * Saving makes the new baby active; the optional birth weight lives only on `Baby.birthWeightG`.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const isFirstRun = useAppStore((s) => s.babies.length === 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const flows = useAccountFlows();
  /** Came here via "כבר יש לנו חשבון": once the family's babies sync down, go straight Home. */
  const [viaAccount, setViaAccount] = useState(false);

  const submit = (data: NewBaby): void => {
    // `baby.birthWeightG` is the single source of the birth weight (growthSeries plots it as
    // the birth point) — no duplicate Measurement is created.
    appStore.getState().addBaby(data);
    if (!isFirstRun) toast.show({ text: he.entry.saved });
    void navigate('/', { replace: true });
  };

  // "יש לי קובץ גיבוי": first run only, so there is nothing on the device to overwrite.
  const importFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      toast.show({ text: he.onb.importErr, variant: 'error' });
      return;
    }
    appStore.getState().importBackup(result.data);
    toast.show({ text: he.onb.imported });
    void navigate('/', { replace: true });
  };

  if (viaAccount && !isFirstRun) return <Navigate to="/" replace />;

  return (
    <main className="onboarding">
      <div className="onboarding__intro">
        <div className="brand-mark" aria-hidden="true">
          <Droplet />
        </div>
        <h1 className="onboarding__title">{isFirstRun ? he.onb.title : he.onb.addTitle}</h1>
        <p className="onboarding__lead">{isFirstRun ? he.onb.lead : he.onb.addLead}</p>
      </div>
      {isFirstRun && isCloudConfigured && (
        // New phone / second parent: sign in, then join the family (docs/ACCOUNTS.md §6).
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => {
            setViaAccount(true);
            flows.openSignIn('join');
          }}
        >
          <LogIn className="flip-rtl" aria-hidden="true" />
          {he.account.onboarding}
        </button>
      )}
      <BabyForm
        submitLabel={isFirstRun ? he.onb.start : he.common.save}
        onSubmit={submit}
        onCancel={isFirstRun ? undefined : () => void navigate(-1)}
        footerNote={
          <>
            <p className="disclaimer" style={{ justifyContent: 'center' }}>
              <ShieldCheck aria-hidden="true" />
              <span>{he.onb.privacy}</span>
            </p>
            {isFirstRun && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ alignSelf: 'center' }}
                onClick={() => fileInput.current?.click()}
              >
                <Upload aria-hidden="true" />
                {he.onb.import}
              </button>
            )}
          </>
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void importFile(e)}
      />
    </main>
  );
}
