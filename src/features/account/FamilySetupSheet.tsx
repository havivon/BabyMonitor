import { CircleAlert, LoaderCircle, UserPlus, Users } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import { Field } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { he } from '../../i18n/he';
import { cloud, useCloud } from '../../platform/cloud';
import { useActiveBaby } from '../../store';
import { JoinFlow } from './JoinFlow';
import { useCloudAction } from './useCloudAction';

const t = he.account.family;

export interface FamilySetupSheetProps {
  open: boolean;
  onClose: () => void;
  /** Start on the join-with-code step (e.g. second parent coming from onboarding). */
  initialStep?: 'choose' | 'join';
}

/**
 * Signed in without a family: create one (name prefilled from the baby / the user) — which uploads
 * this device's data — or join an existing family with an invite code.
 */
export function FamilySetupSheet({ open, onClose, initialStep = 'choose' }: FamilySetupSheetProps) {
  const uid = useId();
  const toast = useToast();
  const { user } = useCloud();
  const baby = useActiveBaby();
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState(() => {
    const who = baby?.name ?? user?.displayName ?? '';
    return who ? t.createNameDefault(who) : '';
  });
  const [submitted, setSubmitted] = useState(false);
  const action = useCloudAction();
  const nameError = name.trim() ? null : he.account.signIn.errName;

  const create = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    setSubmitted(true);
    if (nameError) return;
    if (await action.run(() => cloud.createFamily(name.trim()))) {
      toast.show({ text: t.created });
      onClose();
    }
  };

  if (step === 'join') {
    return (
      <Sheet open={open} onClose={onClose} title={he.account.join.title} icon={<UserPlus />}>
        <JoinFlow
          onJoined={(familyName) => {
            toast.show({ text: he.account.join.joined(familyName) });
            onClose();
          }}
        />
        {/* No code yet (e.g. the first parent on a new phone)? Creating a family is one tap away. */}
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => setStep('choose')}
        >
          {t.create}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={t.setupTitle} icon={<Users />}>
      <p className="text-muted">{t.setupLead}</p>
      {action.error && (
        <div className="banner banner--danger" role="alert">
          <CircleAlert className="banner__icon" aria-hidden="true" />
          <div className="banner__body">
            <span className="banner__text">{action.error}</span>
          </div>
        </div>
      )}
      <form className="stack stack--4" noValidate onSubmit={(e) => void create(e)}>
        <Field
          label={t.createName}
          htmlFor={`${uid}-name`}
          error={submitted ? nameError : null}
          errorId={`${uid}-name-err`}
        >
          <input
            id={`${uid}-name`}
            className="input"
            type="text"
            maxLength={40}
            value={name}
            disabled={action.pending}
            aria-invalid={Boolean(submitted && nameError) || undefined}
            aria-describedby={submitted && nameError ? `${uid}-name-err` : undefined}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </Field>
        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={action.pending}
          aria-busy={action.pending || undefined}
        >
          {action.pending ? <LoaderCircle aria-hidden="true" /> : <Users aria-hidden="true" />}
          {t.createSubmit}
        </button>
      </form>
      <button
        type="button"
        className="btn btn--secondary btn--block"
        disabled={action.pending}
        onClick={() => setStep('join')}
      >
        <UserPlus aria-hidden="true" />
        {t.join}
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
        {t.later}
      </button>
    </Sheet>
  );
}
