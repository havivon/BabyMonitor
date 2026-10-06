import { useId, useRef, useState, type SyntheticEvent, type ReactNode } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { DatePicker } from '../../components/Pickers';
import { RadioGroup, type RadioOption } from '../../components/RadioGroup';
import { addDaysToKey, isValidDateKey, toDateKey } from '../../domain/dates';
import type { Baby, Sex, WeightUnit } from '../../domain/types';
import { formatNumber, UNIT_LABELS, weightFromG, weightToG } from '../../domain/units';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { useSettings, type NewBaby } from '../../store';

export interface BabyFormProps {
  initial?: Partial<Baby>;
  submitLabel: string;
  onSubmit: (data: NewBaby) => void;
  onCancel?: () => void;
  /** Extra content under the buttons (onboarding puts the privacy note here). */
  footerNote?: ReactNode;
}

const NAME_MAX = 30;
/** Plausible birth weight bounds (grams) — guards typos such as 33 kg or 0.33 kg. */
const BIRTH_WEIGHT_MIN_G = 500;
const BIRTH_WEIGHT_MAX_G = 6500;
/** Plausible birth length / head circumference bounds (cm), inclusive. */
const BIRTH_LENGTH_CM = { min: 35, max: 65 } as const;
const BIRTH_HEAD_CM = { min: 25, max: 45 } as const;

const SEX_OPTIONS: readonly RadioOption<Sex>[] = [
  { value: 'female', label: he.onb.female },
  { value: 'male', label: he.onb.male },
];

type FieldName = 'name' | 'birthDate' | 'sex' | 'weight' | 'length' | 'head';
type Errors = Partial<Record<FieldName, string>>;

interface Values {
  name: string;
  birthDate: string;
  sex: Sex | null;
  weight: string;
  length: string;
  head: string;
}

function weightDisplay(g: number | undefined, unit: WeightUnit): string {
  if (g === undefined) return '';
  return unit === 'kg' ? weightFromG(g, unit).toFixed(2) : weightFromG(g, unit).toFixed(1);
}

function cmDisplay(mm: number | undefined): string {
  return mm === undefined ? '' : formatNumber(mm / 10, 0, 1);
}

/** Whole millimetres from a cm text ("49.5" → 495); `NaN` when not a number. */
function cmTextToMm(text: string): number {
  return Math.round(parseDecimal(text) * 10);
}

function inCmRange(text: string, range: { min: number; max: number }): boolean {
  const mm = cmTextToMm(text);
  return mm >= range.min * 10 && mm <= range.max * 10;
}

type OptionalKey = 'birthWeightG' | 'birthLengthMm' | 'birthHeadMm';

/** `{ [key]: value }` when entered; `{ [key]: undefined }` when cleared but set before; else `{}`. */
function optional(
  key: OptionalKey,
  value: number | '',
  initial: Partial<Baby> | undefined,
): Partial<Record<OptionalKey, number>> {
  if (value !== '') return { [key]: value };
  return initial?.[key] !== undefined ? { [key]: undefined } : {};
}

/** Accepts "3.3", "3,3" and surrounding spaces. `NaN` for anything else. */
function parseDecimal(text: string): number {
  const t = text.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

function validate(v: Values, unit: WeightUnit, today: string): Errors {
  const errors: Errors = {};
  const name = v.name.trim();
  if (!name) errors.name = he.onb.err.name;
  else if (name.length > NAME_MAX) errors.name = he.onb.err.nameLong;

  if (!v.birthDate || !isValidDateKey(v.birthDate)) errors.birthDate = he.onb.err.birthDate;
  else if (v.birthDate > today) errors.birthDate = he.onb.err.birthFuture;
  else if (v.birthDate < addDaysToKey(today, -3 * 366)) errors.birthDate = he.onb.err.birthOld;

  if (!v.sex) errors.sex = he.onb.err.sex;

  if (v.weight.trim()) {
    const g = weightToG(parseDecimal(v.weight), unit);
    if (!(g >= BIRTH_WEIGHT_MIN_G && g <= BIRTH_WEIGHT_MAX_G)) {
      errors.weight = he.onb.err.weight(
        formatNumber(weightFromG(BIRTH_WEIGHT_MIN_G, unit), 0, 1),
        formatNumber(weightFromG(BIRTH_WEIGHT_MAX_G, unit), 0, 1),
        unit === 'kg' ? he.units.kg : he.units.lb,
      );
    }
  }
  if (v.length.trim() && !inCmRange(v.length, BIRTH_LENGTH_CM))
    errors.length = he.onb.err.length(BIRTH_LENGTH_CM.min, BIRTH_LENGTH_CM.max);
  if (v.head.trim() && !inCmRange(v.head, BIRTH_HEAD_CM))
    errors.head = he.onb.err.head(BIRTH_HEAD_CM.min, BIRTH_HEAD_CM.max);
  return errors;
}

/**
 * Baby details form (onboarding, and add/edit baby in Settings). Name, birth date, sex (required
 * for WHO percentiles) and optional birth weight in the user's weight unit. Validates on blur and
 * on submit (never while typing) and focuses the first invalid field on a failed submit.
 *
 * The birth weight is returned as `birthWeightG` only — it is the single source of truth (growth
 * plots it as the birth point); callers must NOT also create a Measurement for it.
 */
export function BabyForm({ initial, submitLabel, onSubmit, onCancel, footerNote }: BabyFormProps) {
  const { weightUnit } = useSettings();
  const uid = useId();
  const ids = {
    name: `${uid}-name`,
    nameErr: `${uid}-name-err`,
    date: `${uid}-date`,
    dateErr: `${uid}-date-err`,
    sexLabel: `${uid}-sex-label`,
    sexHint: `${uid}-sex-hint`,
    sexErr: `${uid}-sex-err`,
    weight: `${uid}-weight`,
    weightHint: `${uid}-weight-hint`,
    weightErr: `${uid}-weight-err`,
    length: `${uid}-length`,
    lengthHint: `${uid}-length-hint`,
    lengthErr: `${uid}-length-err`,
    head: `${uid}-head`,
    headHint: `${uid}-head-hint`,
    headErr: `${uid}-head-err`,
  };
  const [values, setValues] = useState<Values>(() => ({
    name: initial?.name ?? '',
    birthDate: initial?.birthDate ?? '',
    sex: initial?.sex ?? null,
    weight: weightDisplay(initial?.birthWeightG, weightUnit),
    length: cmDisplay(initial?.birthLengthMm),
    head: cmDisplay(initial?.birthHeadMm),
  }));
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const today = toDateKey(useNow(60_000));
  const errors = validate(values, weightUnit, today);
  const shown = (f: FieldName): string | undefined =>
    submitted || touched[f] ? errors[f] : undefined;
  const requiredValid = !errors.name && !errors.birthDate && !errors.sex;

  const set = <K extends keyof Values>(key: K, value: Values[K]): void =>
    setValues((v) => ({ ...v, [key]: value }));
  const touch = (f: FieldName): void => setTouched((t) => ({ ...t, [f]: true }));

  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    const order: [FieldName, string][] = [
      ['name', ids.name],
      ['birthDate', ids.date],
      ['sex', ids.sexLabel],
      ['weight', ids.weight],
      ['length', ids.length],
      ['head', ids.head],
    ];
    const firstInvalid = order.find(([f]) => errors[f]);
    if (firstInvalid) {
      const [field, id] = firstInvalid;
      const el =
        field === 'sex'
          ? formRef.current?.querySelector<HTMLElement>(`[aria-labelledby="${id}"] [tabindex="0"]`)
          : document.getElementById(id);
      el?.focus();
      return;
    }
    if (!values.sex) return; // narrowed by validation above
    const weight = values.weight.trim();
    const length = values.length.trim();
    const head = values.head.trim();
    onSubmit({
      name: values.name.trim(),
      birthDate: values.birthDate,
      sex: values.sex,
      // A cleared field that had a value is sent as `undefined`, so an edit (a merged patch)
      // removes it instead of keeping the old value.
      ...optional('birthWeightG', weight && weightToG(parseDecimal(weight), weightUnit), initial),
      ...optional('birthLengthMm', length && cmTextToMm(length), initial),
      ...optional('birthHeadMm', head && cmTextToMm(head), initial),
    });
  };

  const unitLabel = weightUnit === 'kg' ? he.units.kg : he.units.lb;

  return (
    <form
      ref={formRef}
      className="stack stack--8"
      style={{ flex: '1 1 auto' }}
      noValidate
      onSubmit={submit}
    >
      <div className="onboarding__form">
        <Field label={he.onb.name} htmlFor={ids.name} error={shown('name')} errorId={ids.nameErr}>
          <input
            id={ids.name}
            className="input"
            type="text"
            autoComplete="off"
            enterKeyHint="next"
            maxLength={60}
            placeholder={he.onb.namePh}
            value={values.name}
            aria-invalid={Boolean(shown('name')) || undefined}
            aria-describedby={describedBy(shown('name') && ids.nameErr)}
            onChange={(e) => set('name', e.currentTarget.value)}
            onBlur={() => touch('name')}
          />
        </Field>

        <Field
          label={he.onb.birthDate}
          htmlFor={ids.date}
          error={shown('birthDate')}
          errorId={ids.dateErr}
        >
          <DatePicker
            id={ids.date}
            value={values.birthDate}
            placeholder="בחירת תאריך"
            max={today}
            min={addDaysToKey(today, -3 * 366)}
            invalid={Boolean(shown('birthDate'))}
            ariaDescribedby={describedBy(shown('birthDate') && ids.dateErr)}
            onChange={(d) => {
              set('birthDate', d);
              touch('birthDate');
            }}
            onBlur={() => touch('birthDate')}
          />
        </Field>

        <Field
          label={he.onb.sex}
          labelId={ids.sexLabel}
          hint={he.onb.sexHint}
          hintId={ids.sexHint}
          error={shown('sex')}
          errorId={ids.sexErr}
        >
          <RadioGroup
            className="seg seg--lg"
            optionClassName="seg__option"
            options={SEX_OPTIONS}
            value={values.sex}
            ariaLabelledby={ids.sexLabel}
            ariaDescribedby={shown('sex') ? ids.sexErr : ids.sexHint}
            ariaInvalid={Boolean(shown('sex'))}
            onChange={(v) => {
              if (v) set('sex', v);
            }}
          />
        </Field>

        <Field
          label={he.onb.birthWeight}
          htmlFor={ids.weight}
          optional
          hint={he.onb.birthWeightHint}
          hintId={ids.weightHint}
          error={shown('weight')}
          errorId={ids.weightErr}
        >
          <div className="input-group">
            <input
              id={ids.weight}
              className="input input--num"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.weight}
              aria-invalid={Boolean(shown('weight')) || undefined}
              aria-describedby={shown('weight') ? ids.weightErr : ids.weightHint}
              onChange={(e) => set('weight', e.currentTarget.value)}
              onBlur={() => touch('weight')}
            />
            <span className="input-group__affix" aria-hidden="true">
              {unitLabel}
            </span>
          </div>
        </Field>

        <CmField
          id={ids.length}
          hintId={ids.lengthHint}
          errorId={ids.lengthErr}
          label={he.onb.birthLength}
          value={values.length}
          error={shown('length')}
          onChange={(v) => set('length', v)}
          onBlur={() => touch('length')}
        />
        <CmField
          id={ids.head}
          hintId={ids.headHint}
          errorId={ids.headErr}
          label={he.onb.birthHead}
          value={values.head}
          error={shown('head')}
          onChange={(v) => set('head', v)}
          onBlur={() => touch('head')}
        />
      </div>

      <div className="onboarding__footer">
        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          aria-disabled={!requiredValid || undefined}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--outline btn--lg btn--block" onClick={onCancel}>
            {he.common.cancel}
          </button>
        )}
        {footerNote}
      </div>
    </form>
  );
}

/** Optional birth measure in cm (length / head circumference), with the hospital-summary hint. */
function CmField(props: {
  id: string;
  hintId: string;
  errorId: string;
  label: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const { id, hintId, errorId, label, value, error, onChange, onBlur } = props;
  return (
    <Field
      label={label}
      htmlFor={id}
      optional
      hint={he.onb.birthMeasureHint}
      hintId={hintId}
      error={error}
      errorId={errorId}
    >
      <div className="input-group">
        <input
          id={id}
          className="input input--num"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : hintId}
          onChange={(e) => onChange(e.currentTarget.value)}
          onBlur={onBlur}
        />
        <span className="input-group__affix" aria-hidden="true">
          {UNIT_LABELS.cm}
        </span>
      </div>
    </Field>
  );
}
