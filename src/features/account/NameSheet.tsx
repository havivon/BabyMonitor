import { CircleAlert, LoaderCircle, Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { describedBy } from '../../components/dom';
import { Sheet } from '../../components/Sheet';
import { he } from '../../i18n/he';
import { useCloudAction } from './useCloudAction';

/** Family and member names (contract: 1–60 characters after trimming). */
const NAME_EDIT_MAX = 60;

const f = he.account.family;

export interface NameSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  label: string;
  hint: string;
  /** Current name (prefilled). */
  initial: string;
  /** Saves the trimmed name; rejects with a `CloudError` (shown in a banner). */
  onSave: (name: string) => Promise<void>;
  /** Called after a successful save (the caller closes the sheet and shows a toast). */
  onSaved: () => void;
}

function nameError(value: string): string | null {
  const name = value.trim();
  if (!name) return f.errNameEmpty;
  if (name.length > NAME_EDIT_MAX) return f.errNameLong(NAME_EDIT_MAX);
  return null;
}

/**
 * Small sheet that edits one name (family name, or how I appear to the family). Validates on blur
 * and on submit; server errors go to a focused form banner (same pattern as the sign-in sheet).
 * An unchanged name closes without a request. The caller gives it a fresh `key` per open.
 */
export function NameSheet({
  open,
  onClose,
  title,
  label,
  hint,
  initial,
  onSave,
  onSaved,
}: NameSheetProps) {
  const uid = useId();
  const ids = { form: `${uid}-form`, input: `${uid}-name`, hint: `${uid}-hint`, err: `${uid}-err` };
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const save = useCloudAction();
  const bannerRef = useRef<HTMLDivElement>(null);

  const error = nameError(value);
  const shownError = touched ? error : null;

  useEffect(() => {
    if (save.error) bannerRef.current?.focus();
  }, [save.error]);

  const submit = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault();
    if (save.pending) return;
    setTouched(true);
    if (error) {
      document.getElementById(ids.input)?.focus();
      return;
    }
    const name = value.trim();
    if (name === initial.trim()) {
      onClose();
      return;
    }
    if (await save.run(() => onSave(name))) onSaved();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      icon={<Pencil />}
      dirty={value.trim() !== initial.trim()}
      dense
      footer={
        <button
          type="submit"
          form={ids.form}
          className="btn btn--primary btn--lg"
          disabled={save.pending}
          aria-busy={save.pending || undefined}
        >
          {save.pending && <LoaderCircle aria-hidden="true" />}
          {save.pending ? f.saving : he.common.save}
        </button>
      }
    >
      {save.error && (
        <div className="banner banner--danger" role="alert" tabIndex={-1} ref={bannerRef}>
          <CircleAlert className="banner__icon" aria-hidden="true" />
          <div className="banner__body">
            <span className="banner__text">{save.error}</span>
          </div>
        </div>
      )}
      <form id={ids.form} noValidate onSubmit={(e) => void submit(e)}>
        <div className={`field${shownError ? ' field--invalid' : ''}`}>
          <label className="field__label" htmlFor={ids.input}>
            {label}
          </label>
          <input
            id={ids.input}
            className="input"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={NAME_EDIT_MAX}
            data-autofocus
            value={value}
            disabled={save.pending}
            aria-invalid={Boolean(shownError) || undefined}
            aria-describedby={describedBy(shownError ? ids.err : ids.hint)}
            onChange={(e) => {
              setValue(e.currentTarget.value);
              if (save.error) save.clearError();
            }}
            onBlur={() => setTouched(true)}
          />
          {shownError ? (
            <span className="field__error" id={ids.err}>
              <CircleAlert aria-hidden="true" />
              <span>{shownError}</span>
            </span>
          ) : (
            <span className="field__hint" id={ids.hint}>
              {hint}
            </span>
          )}
        </div>
      </form>
    </Sheet>
  );
}
