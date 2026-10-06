import { CircleAlert, CircleCheck, HousePlus, KeyRound, LoaderCircle } from 'lucide-react';
import { useId, useState, type ReactNode, type SyntheticEvent } from 'react';
import { describedBy } from '../../components/dom';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { he } from '../../i18n/he';
import { cloud, useCloud } from '../../platform/cloud';
import { defaultFamilyName } from './names';
import { useCloudAction } from './useCloudAction';
import { useJoinFlow } from './useJoinFlow';

const t = he.account.setup;
const NAME_MAX = 40;

export interface FamilySetupSheetProps {
  open: boolean;
  onClose: () => void;
  /** Opened automatically right after sign-in ("התחברת · עוד צעד אחד") vs. from Settings. */
  afterSignIn?: boolean;
  /** Preselected choice (onboarding's "כבר יש לנו חשבון" prefers joining). */
  initialChoice?: 'create' | 'join';
  /** Open straight on the join-with-code flow (Settings → "הצטרפות עם קוד"). */
  startOnJoin?: boolean;
}

/**
 * Signed in without a family (DESIGN §15.7): create one — uploading this device's data — or join an
 * existing family with a code (§15.8, same sheet). "אחר כך" is the sheet's close button.
 */
export function FamilySetupSheet({
  open,
  onClose,
  afterSignIn = false,
  initialChoice = 'create',
  startOnJoin = false,
}: FamilySetupSheetProps) {
  const uid = useId();
  const toast = useToast();
  const { user } = useCloud();
  const [choice, setChoice] = useState(initialChoice);
  const [joining, setJoining] = useState(startOnJoin);
  // `null` until edited: the prefill follows the user, who may arrive after this sheet mounted.
  const [edited, setName] = useState<string | null>(null);
  const name = edited ?? defaultFamilyName(user?.displayName ?? user?.email?.split('@')[0]);
  const [touched, setTouched] = useState(false);
  const create = useCloudAction();
  const nameError = name.trim() ? null : t.errName;
  const showNameError = touched && nameError;

  const join = useJoinFlow({
    onJoined: (familyName) => {
      toast.show({ text: he.account.join.joined(familyName) });
      onClose();
    },
    onExit: startOnJoin ? undefined : () => setJoining(false),
  });

  if (joining) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={join.title}
        icon={join.icon}
        onBack={join.onBack}
        footer={join.footer}
        dense
      >
        {join.body}
      </Sheet>
    );
  }

  const submit = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    if (choice === 'join') {
      setJoining(true);
      return;
    }
    setTouched(true);
    if (nameError) {
      document.getElementById(`${uid}-name`)?.focus();
      return;
    }
    if (await create.run(() => cloud.createFamily(name.trim()))) {
      toast.show({ text: t.created });
      onClose();
    }
  };

  const option = (value: 'create' | 'join', icon: ReactNode, title: string, text: string) => (
    <label className="choice">
      <input
        type="radio"
        className="visually-hidden"
        name={`${uid}-choice`}
        value={value}
        checked={choice === value}
        disabled={create.pending}
        onChange={() => setChoice(value)}
      />
      <span className="choice__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="choice__body">
        <span className="choice__title">{title}</span>
        <span className="choice__text">{text}</span>
      </span>
      <span className="choice__radio" aria-hidden="true" />
    </label>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={afterSignIn ? t.title : he.account.family.create}
      icon={afterSignIn ? <CircleCheck /> : <HousePlus />}
      dense
      footer={
        <button
          type="submit"
          form={`${uid}-form`}
          className="btn btn--primary btn--lg"
          disabled={create.pending}
          aria-busy={create.pending || undefined}
        >
          {create.pending ? (
            <LoaderCircle aria-hidden="true" />
          ) : (
            choice === 'create' && <HousePlus aria-hidden="true" />
          )}
          {choice === 'join' ? t.next : create.pending ? t.creating : t.create}
        </button>
      }
    >
      <p className="text-muted">{t.lead}</p>
      {create.error && (
        <div className="banner banner--danger" role="alert">
          <CircleAlert className="banner__icon" aria-hidden="true" />
          <div className="banner__body">
            <span className="banner__text">{create.error}</span>
          </div>
        </div>
      )}
      <form id={`${uid}-form`} noValidate onSubmit={(e) => void submit(e)}>
        <div className="choice-group" role="radiogroup" aria-label={t.groupLabel}>
          {option('create', <HousePlus />, t.createTitle, t.createText)}
          {choice === 'create' && (
            <div
              className={`field${showNameError ? ' field--invalid' : ''}`}
              style={{ paddingInline: 'var(--space-1)' }}
            >
              <label className="field__label" htmlFor={`${uid}-name`}>
                {t.familyName}
              </label>
              <input
                id={`${uid}-name`}
                className="input"
                type="text"
                maxLength={NAME_MAX}
                value={name}
                disabled={create.pending}
                aria-invalid={Boolean(showNameError) || undefined}
                aria-describedby={describedBy(
                  showNameError ? `${uid}-name-err` : `${uid}-name-hint`,
                )}
                onChange={(e) => setName(e.currentTarget.value)}
                onBlur={() => setTouched(true)}
              />
              {showNameError ? (
                <span className="field__error" id={`${uid}-name-err`}>
                  <CircleAlert aria-hidden="true" />
                  <span>{nameError}</span>
                </span>
              ) : (
                <span className="field__hint" id={`${uid}-name-hint`}>
                  {t.familyNameHint}
                </span>
              )}
            </div>
          )}
          {option('join', <KeyRound />, t.joinTitle, t.joinText)}
        </div>
      </form>
    </Sheet>
  );
}
