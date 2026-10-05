import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { he } from '../i18n/he';

export interface FieldProps {
  label: ReactNode;
  /** id of the control: renders a `<label for>`. Omit for groups and use `labelId` instead. */
  htmlFor?: string;
  /** id for a non-`<label>` caption, referenced by the group's `aria-labelledby`. */
  labelId?: string;
  optional?: boolean;
  hint?: ReactNode;
  hintId?: string;
  error?: string | null;
  errorId?: string;
  children: ReactNode;
}

/**
 * `.field` column: label → control → hint or error (DESIGN §6.9). The caller wires
 * `aria-describedby` / `aria-invalid` on the control using `hintId` / `errorId`.
 */
export function Field({
  label,
  htmlFor,
  labelId,
  optional,
  hint,
  hintId,
  error,
  errorId,
  children,
}: FieldProps) {
  const labelContent = (
    <>
      {label}
      {optional && <span className="field__optional">{he.common.optional}</span>}
    </>
  );
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      {htmlFor ? (
        <label className="field__label" htmlFor={htmlFor} id={labelId}>
          {labelContent}
        </label>
      ) : (
        <span className="field__label" id={labelId}>
          {labelContent}
        </span>
      )}
      {children}
      {error ? (
        <span className="field__error" id={errorId}>
          <CircleAlert aria-hidden="true" />
          {error}
        </span>
      ) : (
        hint && (
          <span className="field__hint" id={hintId}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}
