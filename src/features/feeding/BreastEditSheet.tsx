import { Check, Heart, Trash2 } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import { Sheet } from '../../components/Sheet';
import type { BreastEntry } from '../../domain/types';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { applyBreastEdit, entryMinutes } from './breastEntry';
import { BreastFields } from './BreastFields';
import { useBreastFormState, validateBreastForm } from './breastFormState';
import { resolveTime } from './timeChoice';
import { useEntryActions } from './useEntryActions';

export interface BreastEditSheetProps {
  open: boolean;
  onClose: () => void;
  entry: BreastEntry;
}

/** Edit a saved breastfeed: start time, per-side minutes (segments simplified), note; delete. */
export function BreastEditSheet({ open, onClose, entry }: BreastEditSheetProps) {
  const actions = useEntryActions();
  const now = useNow(15_000);
  const formId = `${useId()}-form`;
  const state = useBreastFormState(() => ({
    time: { kind: 'at', at: entry.startedAt },
    minutes: entryMinutes(entry),
    note: entry.note ?? '',
  }));
  const [submitted, setSubmitted] = useState(false);
  const errors = validateBreastForm(state, now);

  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    const at = Date.now();
    const current = validateBreastForm(state, at);
    if (current.minutes || current.time) return;
    const next = applyBreastEdit(entry, {
      startedAt: resolveTime(state.time, at),
      minutes: state.minutes,
      note: state.note,
    });
    if (!next) return;
    actions.update(next);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={he.edit.title}
      icon={<Heart />}
      variant="breast"
      dirty={state.dirty}
      footer={
        <>
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
          <button type="submit" form={formId} className="btn btn--primary btn--lg">
            <Check aria-hidden="true" />
            {he.common.save}
          </button>
        </>
      }
    >
      <BreastFields
        formId={formId}
        state={state}
        errors={errors}
        showErrors={submitted}
        now={now}
        onSubmit={submit}
      />
    </Sheet>
  );
}
