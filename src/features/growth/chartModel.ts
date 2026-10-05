/**
 * Pure view-model for the growth chart: x-range, ticks and Recharts rows (WHO bands + baby points).
 */
import type { LmsTable } from '../../domain/growth/lms';
import {
  CHART_PERCENTILES,
  percentileCurves,
  type PercentileCurvePoint,
} from '../../domain/growth/percentiles';
import type { AssessedPoint } from '../../domain/growth/series';
import { WHO_MAX_AGE_DAYS, type GrowthIndicator } from '../../domain/growth/who';
import { formatNumber, gToLb } from '../../domain/units';
import type { Sex, WeightUnit } from '../../domain/types';

export const DAYS_PER_MONTH = 30.4375;
/** Chart widths in months; the smallest that fits is used (DESIGN §7.7: 0–6 → 0–12 → 0–24 …). */
const RANGE_STEPS_MONTHS = [3, 6, 12, 24, 36, 48, 60] as const;

export type AxisUnit = 'weeks' | 'months';

export interface ChartRange {
  months: number;
  days: number;
  unit: AxisUnit;
}

/**
 * x-range: from birth to max(today's age + 2 months, last measurement + 1 month), snapped up to a
 * standard width and capped at 60 months (WHO table limit). A 0–3 month range is drawn in weeks.
 */
export function chartRange(
  todayAgeDays: number,
  lastMeasurementAgeDays: number | null,
): ChartRange {
  const needed = Math.max(
    Math.max(0, todayAgeDays) / DAYS_PER_MONTH + 2,
    (lastMeasurementAgeDays ?? 0) / DAYS_PER_MONTH + 1,
  );
  const months = RANGE_STEPS_MONTHS.find((m) => m >= needed) ?? 60;
  return {
    months,
    days: Math.min(WHO_MAX_AGE_DAYS, Math.round(months * DAYS_PER_MONTH)),
    unit: months <= 3 ? 'weeks' : 'months',
  };
}

export const toX = (ageDays: number, unit: AxisUnit): number =>
  unit === 'weeks' ? ageDays / 7 : ageDays / DAYS_PER_MONTH;

/** Tick positions in x units. */
export function xTicks(range: ChartRange): number[] {
  const [max, step] =
    range.unit === 'weeks'
      ? [Math.floor(range.days / 7), 2]
      : [range.months, range.months <= 6 ? 1 : range.months <= 12 ? 2 : range.months <= 24 ? 3 : 6];
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return ticks;
}

/** Converts app units (g / mm) to chart units (kg or lb / cm). */
export function toChartUnit(
  metric: GrowthIndicator,
  value: number,
  weightUnit: WeightUnit,
): number {
  if (metric !== 'weight') return value / 10;
  return weightUnit === 'kg' ? value / 1000 : gToLb(value);
}

export interface ChartRow {
  x: number;
  ageDays: number;
  p3?: number;
  p15?: number;
  p50?: number;
  p85?: number;
  p97?: number;
  /** Stacked-area helpers: transparent base + band height. */
  outerBase?: number;
  outerBand?: number;
  innerBase?: number;
  innerBand?: number;
  baby?: number;
  babyPercentile?: number | null;
  /** Original app-unit value (g / mm) for tooltips. */
  babyRaw?: number;
  isLatest?: boolean;
}

function curveRow(
  point: PercentileCurvePoint,
  convert: (v: number) => number,
  unit: AxisUnit,
): ChartRow {
  const get = (p: number): number | undefined => {
    const v = point[`p${p}`];
    return v === undefined ? undefined : convert(v);
  };
  const [p3, p15, p50, p85, p97] = CHART_PERCENTILES.map(get);
  const row: ChartRow = { x: toX(point.ageDays, unit), ageDays: point.ageDays };
  if (
    p3 !== undefined &&
    p15 !== undefined &&
    p50 !== undefined &&
    p85 !== undefined &&
    p97 !== undefined
  ) {
    Object.assign(row, {
      p3,
      p15,
      p50,
      p85,
      p97,
      outerBase: p3,
      outerBand: p97 - p3,
      innerBase: p15,
      innerBand: p85 - p15,
    });
  }
  return row;
}

/**
 * Rows for a Recharts `ComposedChart`: WHO curves sampled across the range plus one row per baby
 * point (with the curve values at that exact age, so bands stay continuous and tooltips line up).
 */
export function buildChartRows(
  table: LmsTable | null,
  metric: GrowthIndicator,
  sex: Sex,
  range: ChartRange,
  points: readonly AssessedPoint[],
  weightUnit: WeightUnit,
): ChartRow[] {
  const convert = (v: number) => toChartUnit(metric, v, weightUnit);
  const rows = new Map<number, ChartRow>();
  if (table) {
    for (const p of percentileCurves(table, metric, sex, 0, range.days)) {
      rows.set(p.ageDays, curveRow(p, convert, range.unit));
    }
  }
  const visible = points.filter((p) => p.ageDays <= range.days);
  visible.forEach((p, i) => {
    const base =
      rows.get(p.ageDays) ??
      (table
        ? curveRow(
            percentileCurves(table, metric, sex, p.ageDays, p.ageDays)[0] ?? { ageDays: p.ageDays },
            convert,
            range.unit,
          )
        : { x: toX(p.ageDays, range.unit), ageDays: p.ageDays });
    rows.set(p.ageDays, {
      ...base,
      baby: convert(p.value),
      babyRaw: p.value,
      babyPercentile: p.percentile,
      isLatest: i === visible.length - 1,
    });
  });
  return [...rows.values()].sort((a, b) => a.ageDays - b.ageDays);
}

/** A rounded y-domain that contains the bands and the baby's values. */
export function yDomain(rows: readonly ChartRow[], metric: GrowthIndicator): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    for (const v of [r.p3, r.p97, r.baby]) {
      if (v === undefined) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min)) return [0, 1];
  const step = metric === 'weight' ? 1 : 5;
  return [Math.max(0, Math.floor(min / step) * step), Math.ceil(max / step) * step];
}

/** Hebrew age label for a tooltip/table: "12 ימים", "5 שבועות", "4.5 חודשים". */
export function ageLabel(ageDays: number): string {
  if (ageDays < 14) return ageDays === 1 ? 'יום אחד' : `${ageDays} ימים`;
  if (ageDays < 91) return `${Math.floor(ageDays / 7)} שבועות`;
  return `${formatNumber(ageDays / DAYS_PER_MONTH, 0, 1)} חודשים`;
}
