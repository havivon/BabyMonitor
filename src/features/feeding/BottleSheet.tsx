import { Check, Droplet, Milk, Trash2, TriangleAlert } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { RadioGroup, type RadioOption } from '../../components/RadioGroup';
import { Sheet } from '../../components/Sheet';
import { Stepper } from '../../components/Stepper';
import { lastFeed } from '../../domain/feeding';
import type { BottleContent, BottleEntry, VolumeUnit } from '../../domain/types';
import { formatVolume, volumeToMl } from '../../domain/units';
import { useNow } from '../../hooks/useNow';
import { displayVolume, volumeUnitLabel } from '../../i18n/format';
import { CONTENT_LABEL, he } from '../../i18n/he';
import { appStore, useActiveBaby, useSettings } from '../../store';
import { TimeField } from './TimeField';
import { isFuture, nowChoice, resolveTime, type TimeChoice } from './timeChoice';
import { useEntryActions } from './useEntryActions';

/** Hard limit (team-lead brief): amounts above this are rejected. */
const BOTTLE_MAX_ML = 500;
/** Above this, show the "unusually high" warning (still allowed) — DESIGN §7.4. */
const BOTTLE_WARN_ML = 400;
const DEFAULT_ML = 90;

const UNIT_CONFIG: Record<
  VolumeUnit,
  { step: number; max: number; chips: number[]; decimals: 0 | 1 }
> = {
  ml: { step: 10, max: BOTTLE_MAX_ML, chips: [30, 60, 90, 120, 150], decimals: 0 },
  oz: { step: 0.5, max: 16.5, chips: [1, 2, 3, 4, 5], decimals: 1 },
};

const CONTENT_OPTIONS: readonly RadioOption<BottleContent>[] = [
  {
    value: 'breastmilk',
    label: (
      <>
        <Droplet aria-hidden="true" />
        {CONTENT_LABEL.breastmilk}
      </>
    ),
    ariaLabel: CONTENT_LABEL.breastmilk,
  },
  {
    value: 'formula',
    label: (
      <>
        <Milk aria-hidden="true" />
        {CONTENT_LABEL.formula}
      </>
    ),
    ariaLabel: CONTENT_LABEL.formula,
  },
];

export interface BottleSheetProps {
  open: boolean;
  onClose: () => void;
  /** Edit mode when given. */
  entry?: BottleEntry;
}

/**
 * Add / edit a bottle feed (DESIGN §7.4). Defaults to the last used content and amount.
 * State initialises on mount — the host remounts this component for every new open.
 */
export function BottleSheet({ open, onClose, entry }: BottleSheetProps) {
  const baby = useActiveBaby();
  const { volumeUnit } = useSettings();
  const actions = useEntryActions();
  const now = useNow(15_000);
  const uid = useId();
  const formId = `${uid}-form`;
  const amountErrId = `${uid}-amount-err`;
  const amountWarnId = `${uid}-amount-warn`;
  const cfg = UNIT_CONFIG[volumeUnit];

  const [initial] = useState(() => {
    const source =
      entry ??
      (lastFeed(
        appStore.getState().entries.filter((e) => e.babyId === baby?.id),
        ['bottle'],
      ) as BottleEntry | null);
    return {
      content: source?.content ?? 'breastmilk',
      amount: displayVolume(source?.amountMl ?? DEFAULT_ML, volumeUnit),
      time: entry ? { kind: 'at' as const, at: entry.at } : nowChoice(),
      note: entry?.note ?? '',
    };
  });

  const [content, setContent] = useState<BottleContent>(initial.content);
  const [amount, setAmount] = useState<number>(initial.amount);
  const [time, setTime] = useState<TimeChoice>(initial.time);
  const [note, setNote] = useState(initial.note);
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Keep the stored ml when an edited amount is untouched (no oz → ml rounding drift).
  const amountMl =
    entry && amount === initial.amount ? entry.amountMl : volumeToMl(amount, volumeUnit);
  const amountError = !(amountMl > 0)
    ? he.bottle.errZero
    : amountMl > BOTTLE_MAX_ML
      ? he.bottle.errMax(formatVolume(BOTTLE_MAX_ML, volumeUnit))
      : null;
  const at = resolveTime(time, now);
  const timeError = isFuture(at, now) ? he.time.errFuture : null;
  const showAmountError = (amountTouched || submitted) && amountError;
  const showWarning = !amountError && amountMl > BOTTLE_WARN_ML;

  const dirty =
    content !== initial.content ||
    amount !== initial.amount ||
    note !== initial.note ||
    JSON.stringify(time) !== JSON.stringify(initial.time);

  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    const savedAt = resolveTime(time, Date.now());
    if (amountError) {
      document.getElementById(`${uid}-amount`)?.focus();
      return;
    }
    if (isFuture(savedAt, Date.now()) || !baby) return;
    const trimmed = note.trim();
    if (entry) {
      const next: BottleEntry = { ...entry, at: savedAt, content, amountMl };
      if (trimmed) next.note = trimmed;
      else delete next.note;
      actions.update(next);
    } else {
      actions.add(
        {
          babyId: baby.id,
          type: 'bottle',
          at: savedAt,
          content,
          amountMl,
          ...(trimmed ? { note: trimmed } : {}),
        },
        he.bottle.saved,
      );
    }
    onClose();
  };

  const unitLabel = volumeUnitLabel(volumeUnit);
  const stepLabel = String(cfg.step);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? he.edit.title : he.bottle.title}
      icon={<Milk />}
      variant="bottle"
      dirty={dirty}
      footer={
        <>
          {entry && (
            <button
              type="button"
              className="btn btn--ghost-danger btn--lg"
              onClick={() => {
                onClose();
                actions.remove(entry);
              }}
            >
              <Trash2 aria-hidden="true" />
              {he.common.delete}
            </button>
          )}
          <button type="submit" form={formId} className="btn btn--primary btn--lg">
            <Check aria-hidden="true" />
            {he.common.save}
          </button>
        </>
      }
    >
      <form id={formId} className="stack stack--6" noValidate onSubmit={submit}>
        <RadioGroup
          className="seg seg--lg"
          optionClassName="seg__option"
          options={CONTENT_OPTIONS}
          value={content}
          onChange={(v) => {
            if (v) setContent(v);
          }}
          ariaLabel={he.bottle.content}
        />

        <Field
          label={he.bottle.amount}
          htmlFor={`${uid}-amount`}
          error={showAmountError || null}
          errorId={amountErrId}
        >
          <Stepper
            id={`${uid}-amount`}
            value={amount}
            onChange={setAmount}
            step={cfg.step}
            min={0}
            max={cfg.max}
            decimals={cfg.decimals}
            unitLabel={unitLabel}
            decLabel={he.bottle.dec(stepLabel, unitLabel)}
            incLabel={he.bottle.inc(stepLabel, unitLabel)}
            inputLabel={he.bottle.amountAria(unitLabel)}
            invalid={Boolean(showAmountError)}
            ariaDescribedby={describedBy(
              showAmountError && amountErrId,
              showWarning && amountWarnId,
            )}
            onBlur={() => setAmountTouched(true)}
          />
          <div className="chip-grid" role="group" aria-label={he.bottle.quick}>
            {cfg.chips.map((v) => (
              <button
                key={v}
                type="button"
                className="chip chip--lg"
                aria-pressed={amount === v}
                aria-label={`${v} ${unitLabel}`}
                onClick={() => setAmount(v)}
              >
                <span className="num">{v}</span>
              </button>
            ))}
          </div>
          {showWarning && (
            <p className="field__hint field__hint--warning" id={amountWarnId} role="status">
              <TriangleAlert aria-hidden="true" />
              {he.bottle.warnHigh}
            </p>
          )}
        </Field>

        <TimeField
          label={he.bottle.time}
          value={time}
          onChange={setTime}
          now={now}
          error={timeError}
        />

        <Field label={he.bottle.note} htmlFor={`${uid}-note`} optional>
          <textarea
            id={`${uid}-note`}
            className="textarea"
            rows={2}
            maxLength={500}
            placeholder={he.bottle.notePh}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
        </Field>
      </form>
    </Sheet>
  );
}
