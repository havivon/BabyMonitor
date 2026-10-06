import { useId, useRef, useState, type SyntheticEvent, type ReactNode } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { DatePicker } from '../../components/Pickers';
import { RadioGroup, type RadioOption } from '../../components/RadioGroup';
import { addDaysToKey, isValidDateKey, toDateKey } from '../../domain/dates';
import type { Baby, Sex, WeightUnit } from '../../domain/types';
import { formatNumber, weightFromG, weightToG } from '../../domain/units';
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

const SEX_OPTIONS: readonly RadioOption<Sex>[] = [
  { value: 'female', label: he.onb.female },
  { value: 'male', label: he.onb.male },
];

type FieldName = 'name' | 'birthDate' | 'sex' | 'weight';
type Errors = Partial<Record<FieldName, string>>;

interface Values {
  name: string;
  birthDate: string;
  sex: Sex | null;
  weight: string;
}

function weightDisplay(g: number | undefined, unit: WeightUnit): string {
  if (g === undefined) return '';
  return unit === 'kg' ? weightFromG(g, unit).toFixed(2) : weightFromG(g, unit).toFixed(1);
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
  };
  const [values, setValues] = useState<Values>(() => ({
    name: initial?.name ?? '',
    birthDate: initial?.birthDate ?? '',
    sex: initial?.sex ?? null,
    weight: weightDisplay(initial?.birthWeightG, weightUnit),
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
    onSubmit({
      name: values.name.trim(),
      birthDate: values.birthDate,
      sex: values.sex,
      ...(weight ? { birthWeightG: weightToG(parseDecimal(weight), weightUnit) } : {}),
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
