import { useId, type CSSProperties, type SyntheticEvent } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { Stepper } from '../../components/Stepper';
import type { EpochMs, Side } from '../../domain/types';
import { he, SIDE_LABEL } from '../../i18n/he';
import type { BreastFormErrors, BreastFormState } from './breastFormState';
import { TimeField } from './TimeField';

const QUICK_MINUTES = [5, 10, 15, 20] as const;
const MAX_MINUTES = 120;
const SIDES: readonly Side[] = ['right', 'left']; // ימין first: physical right on the right (RTL)

export interface BreastFieldsProps {
  formId: string;
  state: BreastFormState;
  errors: BreastFormErrors;
  /** Show errors (after a submit attempt). */
  showErrors: boolean;
  now: EpochMs;
  onSubmit: (e: SyntheticEvent) => void;
}

/** Manual / edit breastfeed form: start time, minutes per side (stepper + 5/10/15/20), note. */
export function BreastFields({
  formId,
  state,
  errors,
  showErrors,
  now,
  onSubmit,
}: BreastFieldsProps) {
  const uid = useId();
  const minutesErrId = `${uid}-min-err`;
  const minutesError = showErrors ? errors.minutes : null;
  const label = (side: Side): string =>
    side === 'right' ? he.timer.manualRight : he.timer.manualLeft;

  return (
    <form id={formId} className="stack stack--6" noValidate onSubmit={onSubmit}>
      <TimeField
        label={he.timer.manualStart}
        value={state.time}
        onChange={state.setTime}
        now={now}
        error={showErrors ? errors.time : null}
      />
      {SIDES.map((side, i) => (
        <Field
          key={side}
          label={label(side)}
          htmlFor={`${uid}-${side}`}
          // The "at least one side" error is shown once, under the last side.
          error={i === SIDES.length - 1 ? minutesError : null}
          errorId={minutesErrId}
        >
          <Stepper
            id={`${uid}-${side}`}
            value={state.minutes[side]}
            onChange={(v) => state.setMinutes({ ...state.minutes, [side]: v })}
            step={1}
            min={0}
            max={MAX_MINUTES}
            unitLabel={he.units.min}
            decLabel={`${he.timer.minDec} (${SIDE_LABEL[side]})`}
            incLabel={`${he.timer.minInc} (${SIDE_LABEL[side]})`}
            inputLabel={label(side)}
            invalid={Boolean(minutesError)}
            ariaDescribedby={describedBy(minutesError && minutesErrId)}
          />
          <div
            className="chip-grid"
            style={{ '--chip-cols': QUICK_MINUTES.length } as CSSProperties}
            role="group"
            aria-label={`${he.timer.minutesQuick} (${SIDE_LABEL[side]})`}
          >
            {QUICK_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={state.minutes[side] === m}
                aria-label={`${m} ${he.units.min}`}
                onClick={() => state.setMinutes({ ...state.minutes, [side]: m })}
              >
                <span className="num">{m}</span>
              </button>
            ))}
          </div>
        </Field>
      ))}
      <Field label={he.bottle.note} htmlFor={`${uid}-note`} optional>
        <textarea
          id={`${uid}-note`}
          className="textarea"
          rows={2}
          maxLength={500}
          value={state.note}
          onChange={(e) => state.setNote(e.currentTarget.value)}
        />
      </Field>
    </form>
  );
}
