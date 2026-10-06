import {
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { describedBy } from '../../components/dom';
import { GoogleMark } from '../../components/GoogleMark';
import { Sheet } from '../../components/Sheet';
import { he } from '../../i18n/he';
import { cloud, type CloudErrorCode } from '../../platform/cloud';
import { useCloudAction } from './useCloudAction';

type Mode = 'signin' | 'signup' | 'reset';
type FieldName = 'name' | 'email' | 'password';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;
const NAME_MAX = 40;
const t = he.account.signIn;
const errs = he.account.errors;

/** Server errors that belong under a field (DESIGN §15.3 table); the rest go to the form banner. */
const FIELD_OF: Partial<Record<CloudErrorCode, FieldName>> = {
  'invalid-email': 'email',
  'email-in-use': 'email',
  'weak-password': 'password',
};

export interface SignInSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful Google / email sign-in or account creation. */
  onSignedIn: () => void;
}

/**
 * Sign-in sheet (DESIGN §15.3): sign in / create account / reset password, swapping in place with a
 * back chevron. Client validation on blur and submit; server errors are routed to the field they
 * concern or to a form banner ('cancelled' shows nothing). Everything is disabled while a request
 * runs; buttons show a busy label.
 */
export function SignInSheet({ open, onClose, onSignedIn }: SignInSheetProps) {
  const uid = useId();
  const id = (part: string): string => `${uid}-${part}`;
  const [mode, setMode] = useState<Mode>('signin');
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const google = useCloudAction();
  const form = useCloudAction();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const busy = google.pending || form.pending;

  // ---- validation (client) + server errors routed to fields
  const email = values.email.trim();
  const clientErrors: Record<FieldName, string | null> = {
    name: mode === 'signup' && !values.name.trim() ? t.errName : null,
    email: !email ? t.errEmail : !EMAIL_RE.test(email) ? errs['invalid-email'] : null,
    password:
      mode === 'reset'
        ? null
        : !values.password
          ? t.errPassword
          : mode === 'signup' && values.password.length < MIN_PASSWORD
            ? errs['weak-password']
            : null,
  };
  const serverCode = form.errorCode ?? google.errorCode;
  const serverField = serverCode ? FIELD_OF[serverCode] : undefined;
  const fieldError = (f: FieldName): string | null =>
    ((submitted || touched[f]) && clientErrors[f]) ||
    (serverField === f && serverCode ? errs[serverCode as keyof typeof errs] : null);
  const formError = serverField ? null : (form.error ?? google.error);

  // Form-level server errors: move focus to the banner so it is announced and visible.
  useEffect(() => {
    if (formError) bannerRef.current?.focus();
  }, [formError]);

  const set = (f: FieldName, v: string): void => {
    setValues((prev) => ({ ...prev, [f]: v }));
    if (serverField === f) {
      form.clearError();
      google.clearError();
    }
  };

  const switchMode = (next: Mode): void => {
    setMode(next);
    setSubmitted(false);
    setTouched({});
    setResetSent(false);
    form.clearError();
    google.clearError();
  };

  const submit = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    google.clearError();
    const order: FieldName[] =
      mode === 'signup' ? ['name', 'email', 'password'] : ['email', 'password'];
    const firstInvalid = order.find((f) => clientErrors[f]);
    if (firstInvalid) {
      const target = { name: nameRef, email: emailRef, password: passwordRef }[firstInvalid];
      target.current?.focus();
      return;
    }
    const ok = await form.run(() =>
      mode === 'signin'
        ? cloud.signInWithEmail(email, values.password)
        : mode === 'signup'
          ? cloud.signUpWithEmail(values.name.trim(), email, values.password)
          : cloud.sendPasswordReset(email),
    );
    if (!ok) return;
    if (mode === 'reset') setResetSent(true);
    else onSignedIn();
  };

  const signInWithGoogle = async (): Promise<void> => {
    form.clearError();
    if (await google.run(() => cloud.signInWithGoogle())) onSignedIn();
  };

  // ---- pieces
  const field = (
    name: FieldName,
    label: string,
    control: ReactNode,
    extra?: { hint?: string; after?: ReactNode },
  ): ReactNode => {
    const error = fieldError(name);
    return (
      <div className={`field${error ? ' field--invalid' : ''}`}>
        <label className="field__label" htmlFor={id(name)}>
          {label}
        </label>
        {control}
        {error ? (
          <span className="field__error" id={id(`${name}-err`)}>
            <CircleAlert aria-hidden="true" />
            <span>{error}</span>
          </span>
        ) : (
          extra?.hint && (
            <span className="field__hint" id={id(`${name}-hint`)}>
              {extra.hint}
            </span>
          )
        )}
        {extra?.after}
      </div>
    );
  };
  const aria = (name: FieldName, hint?: boolean) => ({
    'aria-invalid': Boolean(fieldError(name)) || undefined,
    'aria-describedby': describedBy(
      fieldError(name) ? id(`${name}-err`) : hint && id(`${name}-hint`),
    ),
  });

  const nameField = field(
    'name',
    t.name,
    <input
      ref={nameRef}
      id={id('name')}
      className="input"
      type="text"
      autoComplete="name"
      maxLength={NAME_MAX}
      value={values.name}
      disabled={busy}
      {...aria('name', true)}
      onChange={(e) => set('name', e.currentTarget.value)}
      onBlur={() => setTouched((p) => ({ ...p, name: true }))}
    />,
    { hint: t.nameHint },
  );

  const emailField = field(
    'email',
    t.email,
    <input
      ref={emailRef}
      id={id('email')}
      className="input input--ltr"
      type="email"
      inputMode="email"
      autoComplete="email"
      autoCapitalize="none"
      spellCheck={false}
      placeholder={t.emailPh}
      value={values.email}
      disabled={busy}
      {...aria('email')}
      onChange={(e) => set('email', e.currentTarget.value)}
      onBlur={() => setTouched((p) => ({ ...p, email: true }))}
    />,
    {
      after: serverCode === 'email-in-use' && (
        <div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginInlineStart: 'calc(var(--space-4) * -1)' }}
            onClick={() => switchMode('signin')}
          >
            {t.useThisEmail}
          </button>
        </div>
      ),
    },
  );

  const passwordField = field(
    'password',
    t.password,
    <div className="input-group">
      <input
        ref={passwordRef}
        id={id('password')}
        className="input input--ltr"
        type={showPassword ? 'text' : 'password'}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        autoCapitalize="none"
        spellCheck={false}
        value={values.password}
        disabled={busy}
        {...aria('password', mode === 'signup')}
        onChange={(e) => set('password', e.currentTarget.value)}
        onBlur={() => setTouched((p) => ({ ...p, password: true }))}
      />
      <button
        type="button"
        className="input-group__btn"
        aria-pressed={showPassword}
        aria-label={showPassword ? t.hidePassword : t.showPassword}
        // Keep focus (and the caret) in the input while toggling.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShowPassword((v) => !v)}
      >
        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>,
    {
      hint: mode === 'signup' ? t.passwordHint : undefined,
      after: mode === 'signin' && (
        <div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginInlineStart: 'calc(var(--space-4) * -1)' }}
            disabled={busy}
            onClick={() => switchMode('reset')}
          >
            {t.forgot}
          </button>
        </div>
      ),
    },
  );

  const googleButton = (
    <button
      type="button"
      className="gbtn"
      data-autofocus={mode === 'signin' || undefined}
      disabled={busy}
      aria-busy={google.pending || undefined}
      onClick={() => void signInWithGoogle()}
    >
      <GoogleMark className="gbtn__logo" />
      <span>{t.google}</span>
      {google.pending && <LoaderCircle className="gbtn__spinner" aria-hidden="true" />}
    </button>
  );

  const banner = formError && (
    <div className="banner banner--danger" role="alert" tabIndex={-1} ref={bannerRef}>
      <CircleAlert className="banner__icon" aria-hidden="true" />
      <div className="banner__body">
        <span className="banner__text">{formError}</span>
      </div>
    </div>
  );

  const title = mode === 'signup' ? t.titleSignUp : mode === 'reset' ? t.titleReset : t.title;
  const submitLabel = form.pending
    ? mode === 'signup'
      ? t.busySignUp
      : mode === 'reset'
        ? t.busyReset
        : t.busySignIn
    : mode === 'signup'
      ? t.submitSignUp
      : mode === 'reset'
        ? t.submitReset
        : t.submit;
  const formId = id('form');

  const footer =
    mode === 'reset' && resetSent ? (
      <button
        type="button"
        className="btn btn--secondary btn--lg"
        onClick={() => switchMode('signin')}
      >
        {t.backToSignIn}
      </button>
    ) : (
      <button
        type="submit"
        form={formId}
        className="btn btn--primary btn--lg"
        disabled={busy}
        aria-busy={form.pending || undefined}
      >
        {form.pending && <LoaderCircle aria-hidden="true" />}
        {submitLabel}
      </button>
    );

  let body: ReactNode;
  if (mode === 'reset' && resetSent) {
    body = (
      <div className="banner banner--success" role="status">
        <CircleCheck className="banner__icon" aria-hidden="true" />
        <div className="banner__body">
          <span className="banner__title">{t.resetSentTitle}</span>
          <span className="banner__text">{t.resetSent(email)}</span>
        </div>
      </div>
    );
  } else if (mode === 'reset') {
    body = (
      <>
        {banner}
        <p className="text-muted">{t.resetLead}</p>
        <form id={formId} className="stack stack--4" noValidate onSubmit={(e) => void submit(e)}>
          {emailField}
        </form>
      </>
    );
  } else if (mode === 'signup') {
    body = (
      <>
        {banner}
        <form id={formId} className="stack stack--4" noValidate onSubmit={(e) => void submit(e)}>
          {nameField}
          {emailField}
          {passwordField}
        </form>
        <div className="auth-divider">{t.dividerOr}</div>
        {googleButton}
      </>
    );
  } else {
    body = (
      <>
        <p className="text-muted">{t.lead}</p>
        {banner}
        {googleButton}
        <div className="auth-divider">{t.dividerEmail}</div>
        <form id={formId} className="stack stack--4" noValidate onSubmit={(e) => void submit(e)}>
          {emailField}
          {passwordField}
        </form>
        <p className="auth-alt">
          {t.noAccount}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() => switchMode('signup')}
          >
            {t.createAccount}
          </button>
        </p>
        <p className="disclaimer">
          <ShieldCheck aria-hidden="true" />
          <span>{t.privacy}</span>
        </p>
      </>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      icon={<LogIn className="flip-rtl" />}
      onBack={mode === 'signin' ? undefined : () => switchMode('signin')}
      footer={footer}
    >
      {body}
    </Sheet>
  );
}
