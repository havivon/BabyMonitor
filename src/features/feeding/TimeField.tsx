import { useId, type CSSProperties } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { DateTimePicker } from '../../components/Pickers';
import type { EpochMs } from '../../domain/types';
import { he } from '../../i18n/he';
import { QUICK_AGO_MINUTES, resolveTime, type TimeChoice } from './timeChoice';

const quickLabel = (minutes: number): string =>
  minutes === 0 ? he.common.now : minutes === 60 ? he.common.hourAgo : he.common.minAgo(minutes);

export interface TimeFieldProps {
  label: string;
  value: TimeChoice;
  onChange: (value: TimeChoice) => void;
  now: EpochMs;
  error?: string | null;
  /** Earliest selectable instant. */
  min?: EpochMs;
}

/** "שעה" field: friendly picker + quick chips עכשיו · לפני 15 ד׳ · לפני 30 ד׳ · לפני שעה. */
export function TimeField({ label, value, onChange, now, error, min }: TimeFieldProps) {
  const id = useId();
  const errorId = `${id}-err`;
  return (
    <Field label={label} htmlFor={id} error={error} errorId={errorId}>
      <DateTimePicker
        id={id}
        value={resolveTime(value, now)}
        now={now}
        min={min}
        invalid={Boolean(error)}
        ariaDescribedby={describedBy(error && errorId)}
        onChange={(at) => onChange({ kind: 'at', at })}
      />
      {/* Equal 4-column grid (not a scrolling row): all four fit at 360px, nothing is clipped. */}
      <div
        className="chip-grid"
        style={{ '--chip-cols': QUICK_AGO_MINUTES.length } as CSSProperties}
        role="group"
        aria-label={he.time.quick}
      >
        {QUICK_AGO_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-pressed={value.kind === 'ago' && value.minutes === m}
            onClick={() => onChange({ kind: 'ago', minutes: m })}
          >
            {quickLabel(m)}
          </button>
        ))}
      </div>
    </Field>
  );
}
