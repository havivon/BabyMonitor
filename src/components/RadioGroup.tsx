import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string;
  /** Extra class on this option (e.g. `chip--breast`). */
  className?: string;
}

export interface RadioGroupProps<T extends string> {
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Container classes, e.g. `seg seg--lg` or `cluster`. */
  className: string;
  /** Option classes, e.g. `seg__option` or `chip`. */
  optionClassName: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  ariaInvalid?: boolean;
  /** Tapping the selected option clears the selection ("tap again to clear"). */
  allowDeselect?: boolean;
  /** Arrow-key navigation changes the selection (true for segmented controls). */
  selectOnFocus?: boolean;
  id?: string;
}

/**
 * Single-select group: `role="radiogroup"` + `role="radio"` buttons with `aria-checked`, roving
 * tabindex and arrow-key navigation that follows the reading direction (RTL aware). Used for the
 * segmented control (`.seg`) and single-select chip sets (`.chip`) — DESIGN §6.6 / §12.
 */
export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  className,
  optionClassName,
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
  ariaInvalid,
  allowDeselect = false,
  selectOnFocus = true,
  id,
}: RadioGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = index + 1;
        break;
      case 'ArrowUp':
        next = index - 1;
        break;
      case 'ArrowLeft':
        next = rtl ? index + 1 : index - 1;
        break;
      case 'ArrowRight':
        next = rtl ? index - 1 : index + 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const n = options.length;
    const target = ((next % n) + n) % n;
    refs.current[target]?.focus();
    const option = options[target];
    if (selectOnFocus && option) onChange(option.value);
  };

  return (
    <div
      id={id}
      className={className}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-invalid={ariaInvalid || undefined}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={index === tabStop ? 0 : -1}
            className={
              option.className ? `${optionClassName} ${option.className}` : optionClassName
            }
            onClick={() => onChange(checked && allowDeselect ? null : option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
