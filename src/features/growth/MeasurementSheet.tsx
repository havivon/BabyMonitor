import { Calendar, ChevronDown, Trash2, Weight } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import { Field } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import type { IsoDate, Measurement, WeightUnit } from '../../domain/types';
import { UNIT_LABELS } from '../../domain/units';
import { he } from '../../i18n/he';
import {
  measurementToFormValues,
  validateMeasurement,
  type MeasurementErrors,
  type MeasurementField,
  type MeasurementFormValues,
  type MeasurementInput,
} from './measurementForm';
import { formatDateLong } from './ui/format';
import { isValidDateKey } from '../../domain/dates';

interface Props {
  open: boolean;
  /** `null` = add a new measurement. */
  measurement: Measurement | null;
  birthDate: IsoDate;
  today: IsoDate;
  weightUnit: WeightUnit;
  onSave: (input: MeasurementInput) => void;
  onDelete: (measurement: Measurement) => void;
  onClose: () => void;
}

const FIELD_ORDER: MeasurementField[] = ['date', 'weight', 'length', 'head'];

/**
 * Add / edit measurement sheet (DESIGN §7.7). Holds the form state, so the parent should give it a
 * new `key` each time it opens (fresh form) while keeping it mounted for the close animation.
 */
export function MeasurementSheet({
  open,
  measurement,
  birthDate,
  today,
  weightUnit,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const uid = useId();
  const formId = `${uid}-form`;
  const ids = {
    date: `${uid}-date`,
    weight: `${uid}-weight`,
    length: `${uid}-length`,
    head: `${uid}-head`,
    note: `${uid}-note`,
  };
  const [initial] = useState<MeasurementFormValues>(() =>
    measurementToFormValues(measurement, weightUnit, today),
  );
  const [values, setValues] = useState<MeasurementFormValues>(initial);
  const [errors, setErrors] = useState<MeasurementErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const dirty = (Object.keys(values) as (keyof MeasurementFormValues)[]).some(
    (k) => values[k] !== initial[k],
  );

  const ctx = { birthDate, today, weightUnit };

  const update = (key: keyof MeasurementFormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  /** Validate one field (on blur, and on change once the user has tried to submit). */
  const revalidate = (next: MeasurementFormValues, field: MeasurementField) => {
    const result = validateMeasurement(next, ctx);
    setErrors((e) => {
      const fieldError = result.ok ? undefined : result.errors[field];
      const copy: MeasurementErrors = { ...e, [field]: fieldError };
      // "At least one value" is reported on weight — clear it as soon as any value exists.
      if (result.ok || !result.errors.weight) copy.weight = undefined;
      return copy;
    });
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const result = validateMeasurement(values, ctx);
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((f) => result.errors[f]);
      if (first) document.getElementById(ids[first])?.focus();
      return;
    }
    onSave(result.value);
  };

  const numberField = (
    field: 'weight' | 'length' | 'head',
    label: string,
    unit: string,
    optional: boolean,
  ) => {
    const errorId = `${ids[field]}-error`;
    const error = errors[field];
    return (
      <Field label={label} htmlFor={ids[field]} optional={optional} error={error} errorId={errorId}>
        <div className="input-group">
          <input
            id={ids[field]}
            className="input input--num"
            inputMode="decimal"
            autoComplete="off"
            value={values[field]}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              update(field, e.target.value);
              if (submitted) revalidate({ ...values, [field]: e.target.value }, field);
            }}
            onBlur={() => {
              if (values[field].trim() !== '' || submitted) revalidate(values, field);
            }}
          />
          <span className="input-group__affix">{unit}</span>
        </div>
      </Field>
    );
  };

  const dateErrorId = `${ids.date}-error`;
  const dateLabel = isValidDateKey(values.date)
    ? values.date === today
      ? `היום, ${formatDateLong(values.date)}`
      : formatDateLong(values.date)
    : 'בחירת תאריך';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      title={measurement ? 'עריכת מדידה' : 'מדידה חדשה'}
      icon={<Weight aria-hidden="true" />}
      variant="growth"
      footer={
        <>
          {measurement && (
            <button
              type="button"
              className="btn btn--ghost-danger"
              onClick={() => {
                onDelete(measurement);
              }}
            >
              <Trash2 aria-hidden="true" />
              {he.common.delete}
            </button>
          )}
          <button type="submit" form={formId} className="btn btn--primary btn--lg">
            {he.common.save}
          </button>
        </>
      }
    >
      <form id={formId} className="stack stack--6" noValidate onSubmit={onSubmit}>
        <Field label="תאריך" htmlFor={ids.date} error={errors.date} errorId={dateErrorId}>
          <label className="input input--picker">
            <Calendar aria-hidden="true" />
            <span className="input__value">{dateLabel}</span>
            <ChevronDown aria-hidden="true" />
            <input
              id={ids.date}
              type="date"
              className="input__native"
              value={values.date}
              min={birthDate}
              max={today}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? dateErrorId : undefined}
              onChange={(e) => {
                update('date', e.target.value);
                revalidate({ ...values, date: e.target.value }, 'date');
              }}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  /* unsupported or not allowed: the native control still works */
                }
              }}
            />
          </label>
        </Field>
        {numberField(
          'weight',
          'משקל',
          weightUnit === 'kg' ? UNIT_LABELS.kg : UNIT_LABELS.lb,
          false,
        )}
        {numberField('length', 'אורך', UNIT_LABELS.cm, true)}
        {numberField('head', 'היקף ראש', UNIT_LABELS.cm, true)}
        <Field label="הערה" htmlFor={ids.note} optional>
          <textarea
            id={ids.note}
            className="textarea"
            rows={2}
            placeholder="למשל: נשקל בטיפת חלב"
            value={values.note}
            onChange={(e) => {
              update('note', e.target.value);
            }}
          />
        </Field>
      </form>
    </Sheet>
  );
}
