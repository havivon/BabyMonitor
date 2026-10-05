import { Calendar, ChevronDown, Clock } from 'lucide-react';
import type { MouseEvent } from 'react';
import { parseDateKey, isValidDateKey } from '../domain/dates';
import type { EpochMs, IsoDate } from '../domain/types';
import {
  dayMonthYear,
  fromDateTimeLocalValue,
  pickerParts,
  toDateTimeLocalValue,
} from '../i18n/format';

/** Opens the native picker on desktop, where clicking the transparent input would only focus it. */
function openNativePicker(e: MouseEvent<HTMLInputElement>): void {
  const input = e.currentTarget;
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
    } catch {
      /* not allowed in this context (e.g. cross-origin iframe) — native behaviour still works */
    }
  }
}

interface BasePickerProps {
  id: string;
  ariaDescribedby?: string;
  invalid?: boolean;
  /** Accessible name if no `<label for={id}>` points at the native input. */
  ariaLabel?: string;
}

export interface DateTimePickerProps extends BasePickerProps {
  value: EpochMs;
  onChange: (at: EpochMs) => void;
  /** Current time, for "היום/אתמול" phrasing and the `max` bound. */
  now: EpochMs;
  /** Latest selectable instant (default: `now`). */
  max?: EpochMs;
  min?: EpochMs;
}

/**
 * `.input--picker` showing "היום, 14:05" over a transparent native `datetime-local` input
 * (DESIGN §6.9). The clock is an LTR isolate.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  now,
  max = now,
  min,
  ariaDescribedby,
  invalid,
  ariaLabel,
}: DateTimePickerProps) {
  const { day, clock } = pickerParts(value, now);
  return (
    <div className="input input--picker">
      <Clock aria-hidden="true" />
      <span className="input__value" aria-hidden="true">
        {day}, <span className="ltr num">{clock}</span>
      </span>
      <ChevronDown aria-hidden="true" />
      <input
        id={id}
        className="input__native"
        type="datetime-local"
        value={toDateTimeLocalValue(value)}
        max={toDateTimeLocalValue(max)}
        min={min !== undefined ? toDateTimeLocalValue(min) : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid || undefined}
        onClick={openNativePicker}
        onChange={(e) => {
          const at = fromDateTimeLocalValue(e.currentTarget.value);
          if (at !== null) onChange(at);
        }}
      />
    </div>
  );
}

export interface DatePickerProps extends BasePickerProps {
  /** `YYYY-MM-DD`, or '' when empty. */
  value: string;
  onChange: (date: string) => void;
  onBlur?: () => void;
  placeholder: string;
  max?: IsoDate;
  min?: IsoDate;
}

/** `.input--picker` for a calendar date ("1 ביולי 2026") over a native `date` input. */
export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  max,
  min,
  ariaDescribedby,
  invalid,
  ariaLabel,
}: DatePickerProps) {
  const label = value && isValidDateKey(value) ? dayMonthYear(parseDateKey(value)) : null;
  return (
    <div className="input input--picker">
      <Calendar aria-hidden="true" />
      <span className={`input__value${label ? '' : ' text-subtle'}`} aria-hidden="true">
        {label ?? placeholder}
      </span>
      <input
        id={id}
        className="input__native"
        type="date"
        value={value}
        max={max}
        min={min}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid || undefined}
        onClick={openNativePicker}
        onBlur={onBlur}
        onChange={(e) => {
          const v = e.currentTarget.value;
          onChange(isValidDateKey(v) ? v : '');
        }}
      />
    </div>
  );
}
