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
    Object.assign(row, { p3, p15, p50, p85, p97 });
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

export interface YAxisSpec {
  domain: [number, number];
  ticks: number[];
}

/** Tick step in chart units: weight 1 or 2 kg (2 or 5 lb) depending on the span; length/head 5 cm. */
function yStep(metric: GrowthIndicator, weightUnit: WeightUnit, span: number): number {
  if (metric !== 'weight') return 5;
  if (weightUnit === 'lb') return span <= 12 ? 2 : 5;
  return span <= 6 ? 1 : 2;
}

/**
 * A "nice" y-axis that hugs the WHO bands and the baby's values (never forced to 0), with explicit
 * ticks on whole steps (design review P1-2).
 */
export function yAxis(
  rows: readonly ChartRow[],
  metric: GrowthIndicator,
  weightUnit: WeightUnit,
): YAxisSpec {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    for (const v of [r.p3, r.p97, r.baby]) {
      if (v === undefined) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min)) return { domain: [0, 1], ticks: [0, 1] };
  const step = yStep(metric, weightUnit, max - min);
  const lo = Math.max(0, Math.floor(min / step) * step);
  const hi = Math.max(lo + step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Number(t.toFixed(6)));
  return { domain: [lo, hi], ticks };
}

export interface EdgeLabel {
  key: string;
  y: number;
}

/**
 * Spreads right-edge percentile labels so neighbours are at least `minGap` px apart, keeping the
 * middle label (P50) in place and pushing the others outward, then shifting the whole set back
 * inside [top, bottom] if needed (design review P1-2). Input/output y are SVG pixels.
 */
export function spreadLabels(
  labels: readonly EdgeLabel[],
  minGap: number,
  top: number,
  bottom: number,
): EdgeLabel[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y).map((l) => ({ ...l }));
  if (sorted.length === 0) return sorted;
  const mid = Math.floor(sorted.length / 2);
  for (let i = mid - 1; i >= 0; i--) {
    const below = sorted[i + 1];
    const cur = sorted[i];
    if (cur && below) cur.y = Math.min(cur.y, below.y - minGap);
  }
  for (let i = mid + 1; i < sorted.length; i++) {
    const above = sorted[i - 1];
    const cur = sorted[i];
    if (cur && above) cur.y = Math.max(cur.y, above.y + minGap);
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first && last) {
    const shift = first.y < top ? top - first.y : last.y > bottom ? bottom - last.y : 0;
    if (shift) for (const l of sorted) l.y += shift;
  }
  return sorted;
}

/** Hebrew age label for a tooltip/table: "12 ימים", "5 שבועות", "4.5 חודשים". */
export function ageLabel(ageDays: number): string {
  if (ageDays < 14) return ageDays === 1 ? 'יום אחד' : `${ageDays} ימים`;
  if (ageDays < 91) return `${Math.floor(ageDays / 7)} שבועות`;
  return `${formatNumber(ageDays / DAYS_PER_MONTH, 0, 1)} חודשים`;
}
