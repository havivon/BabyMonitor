import { Check, CircleAlert, Undo2 } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ToastOptions {
  text: string;
  /** Label of the single action button (e.g. "בטל"). */
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'error';
  /** Lifetime in ms. Default: 6 s with an action, 3.5 s without (DESIGN §6.11). */
  durationMs?: number;
}

export interface ToastApi {
  show: (opts: ToastOptions) => void;
  /** Dismisses the current toast (if any). */
  dismiss: () => void;
}

interface ActiveToast extends ToastOptions {
  id: number;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_DURATION_WITH_ACTION_MS = 6000;
const TOAST_DURATION_MS = 3500;

/**
 * Hosts the single app toast. Must wrap everything that calls `useToast()`.
 * The `.toast-region` is a polite live region that is always in the DOM (so screen readers
 * register it before the first message); the toast never takes focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const seq = useRef(0);

  const show = useCallback((opts: ToastOptions) => {
    seq.current += 1;
    setToast({ ...opts, id: seq.current });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && <ToastView key={toast.id} toast={toast} onDone={dismiss} />}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ActiveToast; onDone: () => void }) {
  const hasAction = Boolean(toast.actionLabel && toast.onAction);
  const duration =
    toast.durationMs ?? (hasAction ? TOAST_DURATION_WITH_ACTION_MS : TOAST_DURATION_MS);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(duration);
  const paused = hovered || focused;

  // Countdown that pauses on hover / focus and resumes with the remaining time.
  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const id = setTimeout(onDone, remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, onDone]);

  const isError = toast.variant === 'error';
  const Icon = isError ? CircleAlert : Check;

  return (
    <div
      className={`toast${isError ? ' toast--error' : ''}`}
      role={isError ? 'alert' : 'status'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <Icon className="toast__icon" aria-hidden="true" />
      <span className="toast__text">{toast.text}</span>
      {hasAction && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.onAction?.();
            onDone();
          }}
        >
          <Undo2 className="flip-rtl" aria-hidden="true" />
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}

/** Access the app toast. Throws outside `<ToastProvider>` (a wiring bug, not a runtime state). */
// The shared contract puts the provider and its hook in this one module.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>');
  return ctx;
}
