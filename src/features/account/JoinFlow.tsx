import { Check, CircleAlert, Download, LoaderCircle, Users } from 'lucide-react';
import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { RadioGroup, type RadioOption } from '../../components/RadioGroup';
import { useToast } from '../../components/toast';
import { backupFileName, serializeBackup } from '../../domain/backup';
import { he } from '../../i18n/he';
import { cloud, type InvitePreview, type JoinMode } from '../../platform/cloud';
import { appStore, selectBackupData, useAppStore } from '../../store';
import { downloadText } from '../settings/download';
import { CODE_LENGTH, normalizeInviteCode } from './inviteCode';
import { useCloudAction } from './useCloudAction';

const t = he.account.join;

/** Merge / replace rows; the selected one shows a check (state is also `aria-checked`). */
function modeOptions(selected: JoinMode): readonly RadioOption<JoinMode>[] {
  const option = (value: JoinMode, title: string, hint: string): RadioOption<JoinMode> => ({
    value,
    ariaLabel: title,
    label: (
      <>
        <span className="row__body">
          <span className="row__title">{title}</span>
          <span className="row__sub">{hint}</span>
        </span>
        <span className="row__end">{selected === value && <Check aria-hidden="true" />}</span>
      </>
    ),
  });
  return [option('merge', t.merge, t.mergeHint), option('replace', t.replace, t.replaceHint)];
}

export interface JoinFlowProps {
  /** Called after a successful join (with the family name). */
  onJoined: (familyName: string) => void;
}

/**
 * Join a family with an invite code: code → preview (family + members) → when both the device and
 * the family hold data, choose merge vs. replace (with a JSON backup download offered before
 * replacing) → join. Renders its own primary button (used inside sheets).
 */
export function JoinFlow({ onJoined }: JoinFlowProps) {
  const uid = useId();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [mode, setMode] = useState<JoinMode>('merge');
  const action = useCloudAction();
  const codeRef = useRef<HTMLInputElement>(null);
  const deviceHasData = useAppStore((s) => s.babies.length > 0 || s.entries.length > 0);
  const askMode = preview !== null && preview.familyHasData && deviceHasData;
  const codeError = code.length === CODE_LENGTH ? null : t.errCode;

  const check = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    setSubmitted(true);
    if (codeError) {
      codeRef.current?.focus();
      return;
    }
    await action.run(async () => setPreview(await cloud.previewInvite(code)));
  };

  const join = async (): Promise<void> => {
    if (!preview) return;
    const chosen: JoinMode = askMode ? mode : 'merge';
    if (await action.run(() => cloud.joinFamily(code, chosen))) onJoined(preview.familyName);
  };

  const downloadBackup = (): void => {
    const now = Date.now();
    downloadText(
      backupFileName(now),
      serializeBackup(selectBackupData(appStore.getState()), now),
      'application/json',
    );
    toast.show({ text: t.backupDone });
  };

  const errorBanner = action.error && (
    <div className="banner banner--danger" role="alert">
      <CircleAlert className="banner__icon" aria-hidden="true" />
      <div className="banner__body">
        <span className="banner__text">{action.error}</span>
      </div>
    </div>
  );
  const spinner = action.pending && <LoaderCircle aria-hidden="true" />;

  if (!preview) {
    const errId = `${uid}-code-err`;
    const hintId = `${uid}-code-hint`;
    const shownError = submitted ? codeError : null;
    return (
      <form className="stack stack--4" noValidate onSubmit={(e) => void check(e)}>
        {errorBanner}
        <Field
          label={t.code}
          htmlFor={`${uid}-code`}
          hint={t.codeHint}
          hintId={hintId}
          error={shownError}
          errorId={errId}
        >
          <input
            ref={codeRef}
            id={`${uid}-code`}
            className="input input--num"
            type="text"
            dir="ltr"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={t.codePh}
            value={code}
            disabled={action.pending}
            aria-invalid={Boolean(shownError) || undefined}
            aria-describedby={describedBy(shownError ? errId : hintId)}
            onChange={(e) => {
              setCode(normalizeInviteCode(e.currentTarget.value));
              action.clearError();
            }}
          />
        </Field>
        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={action.pending}
          aria-busy={action.pending || undefined}
        >
          {spinner}
          {t.check}
        </button>
      </form>
    );
  }

  return (
    <div className="stack stack--4">
      {errorBanner}
      <div className="card card--flat">
        <div className="row" style={{ padding: 0 }}>
          <span className="row__icon" aria-hidden="true">
            <Users />
          </span>
          <span className="row__body">
            <span className="row__sub">{t.previewLead}</span>
            <span className="row__title">{preview.familyName}</span>
            {preview.memberNames.length > 0 && (
              <span className="row__sub">{t.membersLine(preview.memberNames.join(', '))}</span>
            )}
          </span>
        </div>
      </div>

      {askMode && (
        <div className="field">
          <span className="field__label" id={`${uid}-mode`}>
            {t.bothHaveData}
          </span>
          <RadioGroup
            className="list"
            optionClassName="row"
            options={modeOptions(mode)}
            value={mode}
            onChange={(v) => {
              if (v) setMode(v);
            }}
            ariaLabelledby={`${uid}-mode`}
          />
          {mode === 'replace' && (
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={downloadBackup}
            >
              <Download aria-hidden="true" />
              {t.backup}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary btn--lg btn--block"
        disabled={action.pending}
        aria-busy={action.pending || undefined}
        onClick={() => void join()}
      >
        {spinner}
        {t.submit}
      </button>
    </div>
  );
}
