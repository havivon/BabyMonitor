import type { VolumeUnit } from '../../domain/types';
import { mlToOz, UNIT_LABELS } from '../../domain/units';

/** ml → display unit (rounded for oz). */
export function volumeConverter(unit: VolumeUnit): ((ml: number) => number) | undefined {
  return unit === 'oz' ? (ml) => Math.round(mlToOz(ml) * 10) / 10 : undefined;
}

export const volumeUnitLabel = (unit: VolumeUnit): string =>
  unit === 'ml' ? UNIT_LABELS.ml : UNIT_LABELS.oz;
