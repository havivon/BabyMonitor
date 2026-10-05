import { Apple, Check, Plus, Trash2, X } from 'lucide-react';
import { useId, useRef, useState, type SyntheticEvent, type KeyboardEvent } from 'react';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { RadioGroup, type RadioOption } from '../../components/RadioGroup';
import { Sheet } from '../../components/Sheet';
import type { SolidEntry } from '../../domain/types';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { selectActiveRecentFoods, useAppStore, useActiveBaby } from '../../store';
import { TimeField } from './TimeField';
import { isFuture, nowChoice, resolveTime, type TimeChoice } from './timeChoice';
import { useEntryActions } from './useEntryActions';

const toOption = (label: string): RadioOption<string> => ({ value: label, label });
const AMOUNT_OPTIONS = he.solid.amounts.map(toOption);
const REACTION_OPTIONS = he.solid.reactions.map(toOption);
const MAX_FOOD_LENGTH = 40;
const MAX_FOODS = 12;

const norm = (food: string): string => food.trim().toLowerCase();

/** Splits typed text on commas (Latin and Hebrew/Arabic) into clean food names. */
function splitFoods(text: string): string[] {
  return text
    .split(/[,،]/)
    .map((f) => f.trim().slice(0, MAX_FOOD_LENGTH))
    .filter(Boolean);
}

/** Adds foods, skipping case-insensitive duplicates. */
function addUnique(list: string[], foods: string[]): string[] {
  const out = [...list];
  for (const food of foods) {
    if (out.length >= MAX_FOODS) break;
    if (!out.some((f) => norm(f) === norm(food))) out.push(food);
  }
  return out;
}

function initialReaction(entry?: SolidEntry): { chip: string; other: string } {
  const r = entry?.reaction?.trim();
  if (!r) return { chip: he.solid.reactionNone, other: '' };
  if (he.solid.reactions.includes(r)) return { chip: r, other: '' };
  return { chip: he.solid.reactionOther, other: r };
}

export interface SolidSheetProps {
  open: boolean;
  onClose: () => void;
  entry?: SolidEntry;
}

/**
 * Add / edit a solids meal (DESIGN §7.5): foods as removable chips (Enter or comma), recent foods
 * as `+` suggestions, approximate amount, "new food" (auto-on for never-logged foods until the
 * user flips it), reaction (+ free text for "אחר"), note and time.
 */
export function SolidSheet({ open, onClose, entry }: SolidSheetProps) {
  const baby = useActiveBaby();
  const recentFoods = useAppStore(selectActiveRecentFoods);
  const actions = useEntryActions();
  const now = useNow(15_000);
  const uid = useId();
  const ids = {
    form: `${uid}-form`,
    food: `${uid}-food`,
    foodErr: `${uid}-food-err`,
    foodHint: `${uid}-food-hint`,
    amountLabel: `${uid}-amount`,
    reactionLabel: `${uid}-reaction`,
    other: `${uid}-other`,
    note: `${uid}-note`,
  };

  const [initial] = useState(() => {
    const reaction = initialReaction(entry);
    return {
      foods: entry?.foods ?? [],
      amount: entry?.amount ?? null,
      isNew: entry?.isNewFood ?? null,
      reaction: reaction.chip,
      other: reaction.other,
      note: entry?.note ?? '',
      time: entry ? { kind: 'at' as const, at: entry.at } : nowChoice(),
    };
  });
  const [foods, setFoods] = useState<string[]>(initial.foods);
  const [draft, setDraft] = useState('');
  const [amount, setAmount] = useState<string | null>(initial.amount);
  /** `null` = follow the automatic "never logged before" rule. */
  const [isNewOverride, setIsNewOverride] = useState<boolean | null>(initial.isNew);
  const [reaction, setReaction] = useState<string>(initial.reaction);
  const [other, setOther] = useState(initial.other);
  const [note, setNote] = useState(initial.note);
  const [time, setTime] = useState<TimeChoice>(initial.time);
  const [submitted, setSubmitted] = useState(false);
  const foodInput = useRef<HTMLInputElement>(null);

  // Foods known BEFORE this entry (in edit mode, the entry's own foods don't count as "known").
  const knownFoods = new Set(
    recentFoods.filter((f) => !entry || !initial.foods.some((x) => norm(x) === norm(f))).map(norm),
  );
  const pending = splitFoods(draft);
  const allFoods = addUnique(foods, pending);
  const autoIsNew = allFoods.some((f) => !knownFoods.has(norm(f)));
  const isNew = isNewOverride ?? (allFoods.length > 0 && autoIsNew);
  const suggestions = recentFoods
    .filter((f) => !foods.some((x) => norm(x) === norm(f)))
    .slice(0, 12);

  const foodError = allFoods.length === 0 ? he.solid.errFood : null;
  const showFoodError = submitted && foodError;
  const at = resolveTime(time, now);
  const timeError = isFuture(at, now) ? he.time.errFuture : null;

  const dirty =
    allFoods.join('|') !== initial.foods.join('|') ||
    amount !== initial.amount ||
    isNewOverride !== initial.isNew ||
    reaction !== initial.reaction ||
    other !== initial.other ||
    note !== initial.note ||
    JSON.stringify(time) !== JSON.stringify(initial.time);

  const commitDraft = (): void => {
    if (!pending.length) return;
    setFoods((f) => addUnique(f, pending));
    setDraft('');
  };

  const onFoodKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Enter adds a chip, it does not submit the sheet
      commitDraft();
    } else if (e.key === 'Backspace' && draft === '' && foods.length > 0) {
      setFoods((f) => f.slice(0, -1));
    }
  };

  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    const savedAt = resolveTime(time, Date.now());
    if (foodError) {
      foodInput.current?.focus();
      return;
    }
    if (isFuture(savedAt, Date.now()) || !baby) return;
    const reactionValue =
      reaction === he.solid.reactionOther ? other.trim() || he.solid.reactionOther : reaction;
    const trimmedNote = note.trim();
    const data = {
      at: savedAt,
      foods: allFoods,
      isNewFood: isNew,
      reaction: reactionValue,
      ...(amount ? { amount } : {}),
      ...(trimmedNote ? { note: trimmedNote } : {}),
    };
    if (entry) {
      const next: SolidEntry = { ...entry, ...data };
      if (!amount) delete next.amount;
      if (!trimmedNote) delete next.note;
      actions.update(next);
    } else {
      actions.add({ babyId: baby.id, type: 'solid', ...data }, he.entry.saved);
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? he.edit.title : he.solid.title}
      icon={<Apple />}
      variant="solid"
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
          <button type="submit" form={ids.form} className="btn btn--primary btn--lg">
            <Check aria-hidden="true" />
            {he.common.save}
          </button>
        </>
      }
    >
      <form id={ids.form} className="stack stack--6" noValidate onSubmit={submit}>
        <Field
          label={he.solid.food}
          htmlFor={ids.food}
          hint={he.solid.foodHint}
          hintId={ids.foodHint}
          error={showFoodError || null}
          errorId={ids.foodErr}
        >
          {foods.length > 0 && (
            <ul className="cluster" role="list" aria-label={he.solid.food}>
              {foods.map((food) => (
                <li key={norm(food)}>
                  <button
                    type="button"
                    className="chip is-selected"
                    aria-label={he.solid.removeFood(food)}
                    onClick={() => {
                      setFoods((f) => f.filter((x) => x !== food));
                      foodInput.current?.focus();
                    }}
                  >
                    {food}
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={foodInput}
            id={ids.food}
            className="input"
            type="text"
            autoComplete="off"
            enterKeyHint="enter"
            placeholder={he.solid.foodPh}
            value={draft}
            aria-invalid={Boolean(showFoodError) || undefined}
            aria-describedby={describedBy(showFoodError ? ids.foodErr : ids.foodHint)}
            onChange={(e) => {
              const text = e.currentTarget.value;
              if (/[,،]/.test(text)) {
                setFoods((f) => addUnique(f, splitFoods(text)));
                setDraft('');
              } else {
                setDraft(text);
              }
            }}
            onKeyDown={onFoodKeyDown}
            onBlur={commitDraft}
          />
          {suggestions.length > 0 && (
            <div className="chip-row" role="group" aria-label={he.solid.recent}>
              {suggestions.map((food) => (
                <button
                  key={norm(food)}
                  type="button"
                  className="chip"
                  aria-label={he.solid.addFood(food)}
                  onClick={() => setFoods((f) => addUnique(f, [food]))}
                >
                  <Plus aria-hidden="true" />
                  {food}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label={he.solid.amount} labelId={ids.amountLabel} optional>
          <RadioGroup
            className="cluster"
            optionClassName="chip"
            options={AMOUNT_OPTIONS}
            value={amount}
            onChange={setAmount}
            allowDeselect
            selectOnFocus={false}
            ariaLabelledby={ids.amountLabel}
          />
        </Field>

        <label className="switch-row">
          <span className="switch-row__text">
            <span className="switch-row__title">{he.solid.isNew}</span>
            <span className="switch-row__hint">{he.solid.isNewHint}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={isNew}
            onChange={(e) => setIsNewOverride(e.currentTarget.checked)}
          />
        </label>

        <Field label={he.solid.reaction} labelId={ids.reactionLabel}>
          <RadioGroup
            className="cluster"
            optionClassName="chip"
            options={REACTION_OPTIONS}
            value={reaction}
            onChange={(v) => setReaction(v ?? he.solid.reactionNone)}
            selectOnFocus={false}
            ariaLabelledby={ids.reactionLabel}
          />
          {reaction === he.solid.reactionOther && (
            <input
              id={ids.other}
              className="input"
              type="text"
              maxLength={120}
              aria-label={he.solid.reactionOtherPh}
              placeholder={he.solid.reactionOtherPh}
              value={other}
              onChange={(e) => setOther(e.currentTarget.value)}
            />
          )}
        </Field>

        <TimeField
          label={he.bottle.time}
          value={time}
          onChange={setTime}
          now={now}
          error={timeError}
        />

        <Field label={he.solid.note} htmlFor={ids.note} optional>
          <textarea
            id={ids.note}
            className="textarea"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
        </Field>
      </form>
    </Sheet>
  );
}
