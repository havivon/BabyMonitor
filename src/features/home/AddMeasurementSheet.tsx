import { useToast } from '../../components/toast';
import { toDateKey } from '../../domain/dates';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import { appStore, useActiveBaby, useSettings } from '../../store';
import { MeasurementSheet } from '../growth/MeasurementSheet';
import type { MeasurementInput } from '../growth/measurementForm';

/**
 * The Home "מדידה" tile's sheet: engineer #1's `MeasurementSheet` (add mode) for the active baby,
 * saved like the Growth screen does. Hosted by `FeedingSheetsProvider` (`open({ kind: 'measurement' })`),
 * which gives it a fresh `key` per open and keeps it mounted for the exit animation.
 */
export function AddMeasurementSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const baby = useActiveBaby();
  const { weightUnit } = useSettings();
  const toast = useToast();
  const today = toDateKey(useNow(60_000));
  if (!baby) return null;

  const save = (input: MeasurementInput): void => {
    appStore.getState().addMeasurement({ babyId: baby.id, ...input });
    onClose();
    toast.show({ text: he.home.measurementSaved });
  };

  return (
    <MeasurementSheet
      open={open}
      measurement={null}
      birthDate={baby.birthDate}
      today={today}
      weightUnit={weightUnit}
      onSave={save}
      onDelete={onClose} // add mode has no delete
      onClose={onClose}
    />
  );
}
