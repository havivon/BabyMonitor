import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string;
}

interface SegmentedProps<T extends string> {
  /** Accessible name of the radiogroup. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'lg' | 'inline';
}

/**
 * `.seg` radiogroup (DESIGN §6.6) with roving tabindex. Arrow keys follow the visual order in RTL:
 * ArrowLeft moves to the next option (further left on screen), ArrowRight to the previous.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const deltas: Record<string, number> = {
      ArrowLeft: 1,
      ArrowDown: 1,
      ArrowRight: -1,
      ArrowUp: -1,
    };
    if (event.key in deltas) {
      event.preventDefault();
      move(index, deltas[event.key] ?? 0);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      move(event.key === 'Home' ? 0 : options.length - 1, 0);
    }
  };

  return (
    <div className={size ? `seg seg--${size}` : 'seg'} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            className="seg__option"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              onChange(option.value);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
