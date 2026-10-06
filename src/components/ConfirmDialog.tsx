import { Trash2 } from 'lucide-react';
import {
  useId,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { he } from '../i18n/he';
import { lockBodyScroll } from './dom';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  /** Default "ביטול". */
  cancelLabel?: string;
  /** Destructive action: red confirm button and a danger icon bubble. */
  danger?: boolean;
  /** Icon in the (danger-toned) bubble. Danger dialogs default to `Trash2`; others show none. */
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Non-destructive confirmation with a toned icon bubble and a primary confirm button
   * (`dialog__icon--primary` / `--warning`, e.g. sign out). Ignored when `danger`.
   */
  tone?: 'primary' | 'warning';
  /** Optional third, destructive choice shown between confirm and cancel (e.g. "מחיקה"). */
  extraAction?: { label: string; onAction: () => void };
}

/**
 * Centered confirmation (`.dialog`, `role="alertdialog"`) on a native modal `<dialog>`.
 * Initial focus is on the SAFE action ("ביטול"); Esc and scrim tap cancel; focus returns to the
 * element that had it before opening.
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel = he.common.cancel,
  danger = false,
  icon,
  onConfirm,
  onCancel,
  extraAction,
  tone,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    const unlock = lockBodyScroll();
    return () => {
      unlock();
      if (dialog.open) dialog.close();
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  const onDialogCancel = (e: SyntheticEvent<HTMLDialogElement>): void => {
    e.preventDefault();
    e.stopPropagation(); // never let Esc also close a parent sheet
    onCancel();
  };

  const onClick = (e: MouseEvent<HTMLDialogElement>): void => {
    e.stopPropagation(); // clicks inside a nested dialog are not scrim taps of the parent sheet
    if (e.target === e.currentTarget) onCancel();
  };

  const bubble = icon ?? (danger ? <Trash2 aria-hidden="true" /> : null);

  return (
    <dialog
      ref={ref}
      className="dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={onDialogCancel}
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {open && (
        <>
          {bubble && (
            <span
              className={`dialog__icon${!danger && tone ? ` dialog__icon--${tone}` : ''}`}
              aria-hidden="true"
            >
              {bubble}
            </span>
          )}
          <h2 className="dialog__title" id={titleId}>
            {title}
          </h2>
          <p className="dialog__text" id={textId}>
            {text}
          </p>
          <div className="dialog__actions">
            <button
              type="button"
              className={`btn ${danger ? 'btn--danger' : 'btn--primary'} btn--block`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
            {extraAction && (
              <button
                type="button"
                className="btn btn--ghost-danger btn--block"
                onClick={extraAction.onAction}
              >
                {extraAction.label}
              </button>
            )}
            <button
              ref={cancelRef}
              type="button"
              className="btn btn--outline btn--block"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
