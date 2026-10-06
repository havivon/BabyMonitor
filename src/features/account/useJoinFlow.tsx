import { CircleAlert, Download, KeyRound, LoaderCircle, Merge, Replace } from 'lucide-react';
import { useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { describedBy } from '../../components/dom';
import { backupFileName, serializeBackup } from '../../domain/backup';
import { he } from '../../i18n/he';
import { cloud, INVITE_CODE_LENGTH, type InvitePreview, type JoinMode } from '../../platform/cloud';
import { appStore, selectBackupData, useAppStore } from '../../store';
import { downloadText } from '../settings/download';
import { cleanInviteInput } from './inviteCode';
import { joinNames } from './names';
import { useCloudAction } from './useCloudAction';

const t = he.account.join;
/** Errors shown under the code field (DESIGN §15.8); others go to the banner. */
const CODE_FIELD_ERRORS = new Set(['invite-not-found', 'invite-expired', 'network']);

const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '?';

export interface JoinFlowParts {
  title: string;
  /** Back chevron handler for the sheet header (undefined on the first step without an exit). */
  onBack: (() => void) | undefined;
  icon: ReactNode;
  body: ReactNode;
  footer: ReactNode;
}

/**
 * The join-a-family flow (DESIGN §15.8) as sheet parts, so it can live inside the setup sheet or a
 * sheet of its own: code → preview → (merge / replace with a backup offer and a confirm) → join.
 */
export function useJoinFlow({
  onJoined,
  onExit,
}: {
  onJoined: (familyName: string) => void;
  /** Back from the first step (e.g. to the create/join choice). */
  onExit?: () => void;
}): JoinFlowParts {
  const uid = useId();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [mode, setMode] = useState<JoinMode>('merge');
  const [backedUp, setBackedUp] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const check = useCloudAction();
  const join = useCloudAction();
  const codeRef = useRef<HTMLInputElement>(null);
  const deviceHasData = useAppStore((s) => s.babies.length > 0 || s.entries.length > 0);

  const runCheck = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    if (code.length !== INVITE_CODE_LENGTH || check.pending) return;
    const ok = await check.run(async () => setPreview(await cloud.previewInvite(code)));
    if (!ok) codeRef.current?.focus();
  };

  const askMode = preview !== null && preview.familyHasData && deviceHasData;
  const runJoin = async (): Promise<void> => {
    if (!preview) return;
    setConfirmReplace(false);
    const chosen: JoinMode = askMode ? mode : 'merge';
    if (await join.run(() => cloud.joinFamily(code, chosen))) onJoined(preview.familyName);
  };

  const downloadBackup = (): void => {
    const now = Date.now();
    downloadText(
      backupFileName(now),
      serializeBackup(selectBackupData(appStore.getState()), now),
      'application/json',
    );
    setBackedUp(true);
  };

  const banner = (message: string | null): ReactNode =>
    message && (
      <div className="banner banner--danger" role="alert">
        <CircleAlert className="banner__icon" aria-hidden="true" />
        <div className="banner__body">
          <span className="banner__text">{message}</span>
        </div>
      </div>
    );

  // ---- step 1: code
  if (!preview) {
    const codeError =
      check.errorCode && CODE_FIELD_ERRORS.has(check.errorCode) ? check.error : null;
    const errId = `${uid}-code-err`;
    const formId = `${uid}-code-form`;
    return {
      title: t.title,
      onBack: onExit,
      icon: <KeyRound />,
      body: (
        <>
          <p className="text-muted">{t.lead}</p>
          {banner(codeError ? null : check.error)}
          <form id={formId} noValidate onSubmit={(e) => void runCheck(e)}>
            <div className={`field${codeError ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor={`${uid}-code`}>
                {t.code}
              </label>
              <input
                ref={codeRef}
                id={`${uid}-code`}
                className="input input--code"
                type="text"
                inputMode="text"
                maxLength={INVITE_CODE_LENGTH}
                autoCapitalize="characters"
                autoComplete="one-time-code"
                spellCheck={false}
                placeholder={t.codePh}
                value={code}
                disabled={check.pending}
                aria-invalid={Boolean(codeError) || undefined}
                aria-describedby={describedBy(codeError && errId)}
                onChange={(e) => {
                  setCode(cleanInviteInput(e.currentTarget.value));
                  check.clearError();
                }}
              />
              {codeError && (
                <span className="field__error" id={errId}>
                  <CircleAlert aria-hidden="true" />
                  <span>{codeError}</span>
                </span>
              )}
            </div>
          </form>
        </>
      ),
      footer: (
        <button
          type="submit"
          form={formId}
          className="btn btn--primary btn--lg"
          disabled={code.length !== INVITE_CODE_LENGTH || check.pending}
          aria-busy={check.pending || undefined}
        >
          {check.pending && <LoaderCircle aria-hidden="true" />}
          {check.pending ? t.checking : t.check}
        </button>
      ),
    };
  }

  // ---- step 2: preview (+ merge / replace)
  const members = preview.memberNames;
  const choice = (value: JoinMode, icon: ReactNode, title: string, text: string): ReactNode => (
    <label className="choice">
      <input
        type="radio"
        className="visually-hidden"
        name={`${uid}-mode`}
        value={value}
        checked={mode === value}
        onChange={() => setMode(value)}
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

  return {
    title: t.title,
    onBack: () => {
      setPreview(null);
      join.clearError();
    },
    icon: <KeyRound />,
    body: (
      <>
        {banner(join.error)}
        <div className="family-preview">
          <span className="avatar-stack" aria-hidden="true">
            {members.map((m, i) => (
              <span key={`${m}-${i}`} className={`avatar avatar--lg${i % 2 ? ' avatar--alt' : ''}`}>
                {initialOf(m)}
              </span>
            ))}
          </span>
          <span className="family-preview__name">{preview.familyName}</span>
          {(members.length > 0 || preview.familyHasData) && (
            <span className="family-preview__members">
              {[members.length > 0 && joinNames(members), preview.familyHasData && t.familyHasData]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
        {askMode ? (
          <fieldset className="field">
            <legend className="field__label">{t.bothHaveData}</legend>
            <div className="choice-group" role="radiogroup">
              {choice('merge', <Merge />, t.merge, t.mergeText)}
              {choice('replace', <Replace />, t.replace, t.replaceText)}
            </div>
            {mode === 'replace' && (
              <div className="cluster">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={downloadBackup}
                >
                  <Download aria-hidden="true" />
                  {t.backup}
                </button>
                {backedUp && (
                  <span className="field__hint" role="status">
                    {t.backupDone}
                  </span>
                )}
              </div>
            )}
          </fieldset>
        ) : (
          deviceHasData && <p className="text-sm text-muted">{t.uploadNote}</p>
        )}
        <ConfirmDialog
          open={confirmReplace}
          title={t.replaceConfirmTitle}
          text={t.replaceConfirmText}
          confirmLabel={t.replaceConfirm}
          cancelLabel={t.replaceBack}
          danger
          icon={<Replace aria-hidden="true" />}
          onConfirm={() => void runJoin()}
          onCancel={() => setConfirmReplace(false)}
        />
      </>
    ),
    footer: (
      <button
        type="button"
        className="btn btn--primary btn--lg"
        disabled={join.pending}
        aria-busy={join.pending || undefined}
        onClick={() => {
          if (askMode && mode === 'replace') setConfirmReplace(true);
          else void runJoin();
        }}
      >
        {join.pending && <LoaderCircle aria-hidden="true" />}
        {join.pending ? t.joining : t.submit(preview.familyName)}
      </button>
    ),
  };
}
