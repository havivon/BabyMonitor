import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { he } from '../i18n/he';
import { ConfirmDialog } from './ConfirmDialog';
import { lockBodyScroll, prefersMotion } from './dom';

export type SheetVariant = 'breast' | 'bottle' | 'solid' | 'growth';

export interface SheetProps {
  open: boolean;
  /** Called for every close request: close button, Esc, scrim tap (after the dirty check). */
  onClose: () => void;
  title: string;
  /** Icon shown in the category bubble next to the title (decorative). */
  icon?: ReactNode;
  variant?: SheetVariant;
  /** Sticky footer content (buttons). */
  footer?: ReactNode;
  children: ReactNode;
  /** Full-height sheet (`.sheet--full`, the breastfeeding timer). */
  full?: boolean;
  /** Overrides the close button's accessible label (default "סגירה"). */
  closeLabel?: string;
  /** Overrides the close button's icon (default `X`). */
  closeIcon?: ReactNode;
  /** When true, a close request first asks "לצאת בלי לשמור?" (DESIGN §6.10). */
  dirty?: boolean;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Matches the exit animation in app-extra.css (≈70% of the 320ms enter). */
const EXIT_FALLBACK_MS = 260;

/**
 * Bottom sheet on a native `<dialog>` + `showModal()`: focus trap, inert background and Esc for free.
 * Adds: scrim-tap close, body scroll lock, initial focus on the first control in the body (or on
 * an element marked `data-autofocus`), focus return to the trigger, an exit slide, and an optional
 * "discard changes?" confirmation. Content is only mounted while open, so forms reset on reopen.
 */
export function Sheet({
  open,
  onClose,
  title,
  icon,
  variant,
  footer,
  children,
  full = false,
  closeLabel = he.common.close,
  closeIcon,
  dirty = false,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const pressStartedOnScrim = useRef(false);
  const openRef = useRef(open);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Keep content mounted while the exit animation plays (state derived during render).
  const [prevOpen, setPrevOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setClosing(!open && prefersMotion());
    if (open) setConfirmOpen(false);
  }

  // Open: showModal, scroll lock, initial focus.
  useLayoutEffect(() => {
    openRef.current = open;
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.removeAttribute('data-closing');
    if (!dialog.open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const target =
        dialog.querySelector<HTMLElement>('[data-autofocus]') ??
        dialog.querySelector<HTMLElement>(`.sheet__body :is(${FOCUSABLE})`) ??
        dialog.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }
    return lockBodyScroll();
  }, [open]);

  // Close: play the exit animation (when motion is allowed), then close and restore focus.
  useEffect(() => {
    const dialog = ref.current;
    if (open || !dialog?.open) return;
    const finish = (): void => {
      dialog.removeAttribute('data-closing');
      if (dialog.open) dialog.close();
      const back = returnFocus.current;
      returnFocus.current = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
    if (!closing) {
      finish();
      return;
    }
    dialog.setAttribute('data-closing', '');
    let done = false;
    const end = (): void => {
      if (done) return;
      done = true;
      finish();
      setClosing(false);
    };
    const onAnimationEnd = (e: AnimationEvent): void => {
      if (e.target === dialog) end();
    };
    dialog.addEventListener('animationend', onAnimationEnd);
    const fallback = setTimeout(end, EXIT_FALLBACK_MS);
    return () => {
      dialog.removeEventListener('animationend', onAnimationEnd);
      clearTimeout(fallback);
      // Reopened mid-exit: keep the dialog open; otherwise make sure it really closes.
      if (!done && !openRef.current) {
        done = true;
        finish();
      }
    };
  }, [open, closing]);

  // Unmounted while open (e.g. route change): release focus to the trigger.
  useEffect(
    () => () => {
      const back = returnFocus.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
    },
    [],
  );

  const requestClose = (): void => {
    if (!open) return;
    if (dirty) setConfirmOpen(true);
    else onClose();
  };

  const onCancel = (e: SyntheticEvent<HTMLDialogElement>): void => {
    // Esc: keep the dialog under React's control.
    e.preventDefault();
    requestClose();
  };

  const onMouseDown = (e: MouseEvent<HTMLDialogElement>): void => {
    pressStartedOnScrim.current = e.target === e.currentTarget;
  };
  const onClick = (e: MouseEvent<HTMLDialogElement>): void => {
    // Clicks on ::backdrop target the dialog element itself; the sheet's content never does.
    if (e.target === e.currentTarget && pressStartedOnScrim.current) requestClose();
    pressStartedOnScrim.current = false;
  };

  const className = ['sheet', full ? 'sheet--full' : '', variant ? `sheet--${variant}` : '']
    .filter(Boolean)
    .join(' ');

  const mounted = open || closing;

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={onCancel}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {mounted && (
        <>
          <div className="sheet__handle" aria-hidden="true" />
          <div className="sheet__header">
            {icon && (
              <span className="sheet__icon" aria-hidden="true">
                {icon}
              </span>
            )}
            <h2 className="sheet__title" id={titleId}>
              {title}
            </h2>
            <button
              type="button"
              className="icon-btn"
              aria-label={closeLabel}
              onClick={requestClose}
            >
              {closeIcon ?? <X aria-hidden="true" />}
            </button>
          </div>
          <div className="sheet__body">{children}</div>
          {footer && <div className="sheet__footer">{footer}</div>}
          <ConfirmDialog
            open={confirmOpen}
            title={he.common.leaveDirty.title}
            text={he.common.leaveDirty.text}
            confirmLabel={he.common.leaveDirty.confirm}
            cancelLabel={he.common.leaveDirty.cancel}
            danger
            onConfirm={() => {
              setConfirmOpen(false);
              onClose();
            }}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      )}
    </dialog>
  );
}
