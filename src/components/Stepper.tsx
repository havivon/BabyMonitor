import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface StepperProps {
  id?: string;
  /** Current value in display units (NaN while the field is empty). */
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  unitLabel: string;
  decLabel: string;
  incLabel: string;
  inputLabel: string;
  /** Fraction digits allowed when typing (0 for ml / minutes, 1 for oz). */
  decimals?: 0 | 1;
  invalid?: boolean;
  ariaDescribedby?: string;
  onBlur?: () => void;
}

const LONG_PRESS_DELAY_MS = 400;
const REPEAT_MS = 120;

function formatValue(v: number, decimals: number): string {
  if (!Number.isFinite(v)) return '';
  return decimals === 0 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

function parseValue(text: string): number {
  const t = text.trim().replace(',', '.');
  if (!t) return Number.NaN;
  return /^\d+(\.\d*)?$/.test(t) ? Number(t) : Number.NaN;
}

/**
 * Amount stepper (DESIGN §6.8): `[−] value [+]` in DOM order (+ renders on the left in RTL), an
 * editable LTR number, buttons disabled at the bounds, and press-and-hold repeat
 * (every 120 ms after 400 ms).
 */
export function Stepper({
  id,
  value,
  onChange,
  step,
  min,
  max,
  unitLabel,
  decLabel,
  incLabel,
  inputLabel,
  decimals = 0,
  invalid,
  ariaDescribedby,
  onBlur,
}: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const valueRef = useRef(value);
  const repeat = useRef<{
    timeout?: ReturnType<typeof setTimeout>;
    interval?: ReturnType<typeof setInterval>;
    fired: boolean;
  }>({ fired: false });

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const bump = (dir: 1 | -1): void => {
    const current = Number.isFinite(valueRef.current) ? valueRef.current : 0;
    // Snap to the step grid first, so 95 + 10 → 100 (not 105).
    const snapped =
      dir > 0 ? Math.floor(current / step + 1e-9) * step : Math.ceil(current / step - 1e-9) * step;
    const next = Math.min(max, Math.max(min, snapped + dir * step));
    const rounded = Math.round(next * 1000) / 1000;
    // At a bound the button becomes disabled and stops receiving pointerup — end the repeat here.
    if (rounded === min || rounded === max) stopRepeat();
    valueRef.current = rounded;
    setDraft(null);
    onChange(rounded);
  };

  const stopRepeat = (): void => {
    clearTimeout(repeat.current.timeout);
    clearInterval(repeat.current.interval);
    repeat.current.timeout = undefined;
    repeat.current.interval = undefined;
  };
  useEffect(() => stopRepeat, []);

  const startRepeat = (dir: 1 | -1): void => {
    stopRepeat();
    repeat.current.fired = false;
    repeat.current.timeout = setTimeout(() => {
      repeat.current.fired = true;
      bump(dir);
      repeat.current.interval = setInterval(() => bump(dir), REPEAT_MS);
    }, LONG_PRESS_DELAY_MS);
  };
  const click = (dir: 1 | -1): void => {
    // A long press already stepped; swallow the click that ends it.
    if (repeat.current.fired) {
      repeat.current.fired = false;
      return;
    }
    bump(dir);
  };

  const finite = Number.isFinite(value);
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        aria-label={decLabel}
        disabled={finite && value <= min}
        onPointerDown={() => startRepeat(-1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => click(-1)}
      >
        <Minus aria-hidden="true" />
      </button>
      <div className="stepper__value">
        <input
          id={id}
          className="stepper__input"
          type="text"
          inputMode={decimals ? 'decimal' : 'numeric'}
          autoComplete="off"
          aria-label={inputLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedby}
          value={draft ?? formatValue(value, decimals)}
          onChange={(e) => {
            const text = e.currentTarget.value;
            setDraft(text);
            onChange(parseValue(text));
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => {
            setDraft(null);
            onBlur?.();
          }}
        />
        <span className="stepper__unit" aria-hidden="true">
          {unitLabel}
        </span>
      </div>
      <button
        type="button"
        className="stepper__btn"
        aria-label={incLabel}
        disabled={finite && value >= max}
        onPointerDown={() => startRepeat(1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => click(1)}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}
