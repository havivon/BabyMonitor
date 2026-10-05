import type { GrowthIndicator } from '../../domain/growth/who';
import type { WeightUnit } from '../../domain/types';
import { lengthQuantity, weightQuantity, type Quantity } from './ui/format';

export const METRIC_LABEL: Record<GrowthIndicator, string> = {
  weight: 'משקל',
  length: 'אורך',
  head: 'היקף ראש',
};

export const CHART_TITLE: Record<GrowthIndicator, string> = {
  weight: 'משקל לגיל',
  length: 'אורך לגיל',
  head: 'היקף ראש לגיל',
};

/** Display quantity of a metric value stored in app units (g / mm). */
export function metricQuantity(
  metric: GrowthIndicator,
  value: number,
  weightUnit: WeightUnit,
): Quantity {
  return metric === 'weight' ? weightQuantity(value, weightUnit) : lengthQuantity(value);
}
