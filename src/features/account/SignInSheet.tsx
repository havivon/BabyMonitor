import { CircleAlert, Cloud, LoaderCircle, LogIn, MailCheck, ShieldCheck } from 'lucide-react';
import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { Sheet } from '../../components/Sheet';
import { he } from '../../i18n/he';
import { cloud } from '../../platform/cloud';
import { useCloudAction } from './useCloudAction';

type Mode = 'signin' | 'signup' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;
const t = he.account.signIn;

export interface SignInSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful Google / email sign-in or account creation. */
  onSignedIn: () => void;
}

/**
 * Sign-in sheet (docs/ACCOUNTS.md §6): "המשך עם Google" + email/password with three modes
 * (sign in / create account / forgot password). Validation on submit; server errors are mapped to
 * Hebrew per `CloudErrorCode` ('cancelled' shows nothing). Everything is disabled while a request
 * runs, so a double tap can't fire twice.
 */
export function SignInSheet({ open, onClose, onSignedIn }: SignInSheetProps) {
  const uid = useId();
  const ids = {
    form: `${uid}-form`,
    name: `${uid}-name`,
    nameErr: `${uid}-name-err`,
    email: `${uid}-email`,
    emailErr: `${uid}-email-err`,
    password: `${uid}-password`,
    passwordErr: `${uid}-password-err`,
    passwordHint: `${uid}-password-hint`,
  };
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const google = useCloudAction();
  const form = useCloudAction();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const busy = google.pending || form.pending;

  const errors = {
    name: mode === 'signup' && !name.trim() ? t.errName : null,
    email: !EMAIL_RE.test(email.trim()) ? t.errEmail : null,
    password:
      mode === 'reset'
        ? null
        : !password
          ? t.errPassword
          : mode === 'signup' && password.length < MIN_PASSWORD
            ? he.account.errors['weak-password']
            : null,
  };
  const shown = (key: keyof typeof errors): string | null => (submitted ? errors[key] : null);

  const switchMode = (next: Mode): void => {
    setMode(next);
    setSubmitted(false);
    form.clearError();
    google.clearError();
    setResetSentTo(null);
  };

  const submit = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    google.clearError();
    if (errors.name) return nameRef.current?.focus();
    if (errors.email) return emailRef.current?.focus();
    if (errors.password) return passwordRef.current?.focus();
    const address = email.trim();
    const ok = await form.run(() =>
      mode === 'signin'
        ? cloud.signInWithEmail(address, password)
        : mode === 'signup'
          ? cloud.signUpWithEmail(name.trim(), address, password)
          : cloud.sendPasswordReset(address),
    );
    if (!ok) return;
    if (mode === 'reset') setResetSentTo(address);
    else onSignedIn();
  };

  const signInWithGoogle = async (): Promise<void> => {
    form.clearError();
    if (await google.run(() => cloud.signInWithGoogle())) onSignedIn();
  };

  const title = mode === 'signup' ? t.titleSignUp : mode === 'reset' ? t.titleReset : t.title;
  const submitLabel =
    mode === 'signup' ? t.submitSignUp : mode === 'reset' ? t.submitReset : t.submit;
  const error = form.error ?? google.error;
  const spinner = <LoaderCircle aria-hidden="true" />;

  if (resetSentTo !== null) {
    return (
      <Sheet open={open} onClose={onClose} title={title} icon={<Cloud />}>
        <div className="banner banner--success" role="status">
          <MailCheck className="banner__icon" aria-hidden="true" />
          <div className="banner__body">
            <span className="banner__text">{t.resetSent(resetSentTo)}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => switchMode('signin')}
        >
          {t.backToSignIn}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      icon={<Cloud />}
      footer={
        <button
          type="submit"
          form={ids.form}
          className="btn btn--primary btn--lg"
          disabled={busy}
          aria-busy={form.pending || undefined}
        >
          {form.pending ? spinner : <LogIn aria-hidden="true" />}
          {submitLabel}
        </button>
      }
    >
      {mode !== 'reset' && (
        <>
          <button
            type="button"
            className="btn btn--outline btn--lg btn--block"
            disabled={busy}
            aria-busy={google.pending || undefined}
            onClick={() => void signInWithGoogle()}
          >
            {google.pending && spinner}
            {t.google}
          </button>
          <p className="text-sm text-muted text-center" aria-hidden="true">
            {t.or}
          </p>
        </>
      )}

      {error && (
        <div className="banner banner--danger" role="alert">
          <CircleAlert className="banner__icon" aria-hidden="true" />
          <div className="banner__body">
            <span className="banner__text">{error}</span>
          </div>
        </div>
      )}

      <form id={ids.form} className="stack stack--4" noValidate onSubmit={(e) => void submit(e)}>
        {mode === 'signup' && (
          <Field label={t.name} htmlFor={ids.name} error={shown('name')} errorId={ids.nameErr}>
            <input
              ref={nameRef}
              id={ids.name}
              className="input"
              type="text"
              autoComplete="name"
              maxLength={40}
              placeholder={t.namePh}
              value={name}
              disabled={busy}
              aria-invalid={Boolean(shown('name')) || undefined}
              aria-describedby={describedBy(shown('name') && ids.nameErr)}
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </Field>
        )}
        <Field label={t.email} htmlFor={ids.email} error={shown('email')} errorId={ids.emailErr}>
          <input
            ref={emailRef}
            id={ids.email}
            className="input"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            disabled={busy}
            aria-invalid={Boolean(shown('email')) || undefined}
            aria-describedby={describedBy(shown('email') && ids.emailErr)}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
        </Field>
        {mode !== 'reset' && (
          <Field
            label={t.password}
            htmlFor={ids.password}
            hint={mode === 'signup' ? t.passwordHint : undefined}
            hintId={ids.passwordHint}
            error={shown('password')}
            errorId={ids.passwordErr}
          >
            <input
              ref={passwordRef}
              id={ids.password}
              className="input"
              type="password"
              dir="ltr"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              disabled={busy}
              aria-invalid={Boolean(shown('password')) || undefined}
              aria-describedby={describedBy(
                shown('password') ? ids.passwordErr : mode === 'signup' && ids.passwordHint,
              )}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
          </Field>
        )}
      </form>

      <div className="cluster cluster--1" style={{ justifyContent: 'center' }}>
        {mode === 'signin' && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() => switchMode('reset')}
          >
            {t.forgot}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={busy}
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? t.toSignUp : t.toSignIn}
        </button>
      </div>

      <p className="disclaimer">
        <ShieldCheck aria-hidden="true" />
        <span>{t.privacy}</span>
      </p>
    </Sheet>
  );
}
