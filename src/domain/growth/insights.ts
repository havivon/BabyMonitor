/**
 * Structured growth flags for the UI (which renders Hebrew text + the "not medical advice"
 * disclaimer). Pure: no strings meant for display, only data.
 *
 * Thresholds (PRD §1, common paediatric guidance — e.g. AAP / ABM Clinical Protocol #3):
 * - Newborn weight loss up to ~7 % is common; > 7 % warrants attention; > 10 % → consult.
 * - Birth weight is expected to be regained by day 10–14.
 * - Below P3 / above P97 (WHO) and downward crossing of ≥ 2 major percentile lines are flagged.
 * - Weight gain below the typical age range (see gain.ts) is flagged.
 */
import { ageInDays } from '../age';
import type { Baby, EpochMs, IsoDate, Measurement } from '../types';
import { latestWeightGain, percentChangeFromBirth, typicalWeeklyGain } from './gain';
import type { LmsTable } from './lms';
import { normalQuantile } from './normal';
import { CHART_PERCENTILES } from './percentiles';
import { assessSeries, growthSeries, type AssessedPoint, type GrowthPoint } from './series';
import { GROWTH_INDICATORS, type GrowthIndicator } from './who';

export const NORMAL_BIRTH_WEIGHT_LOSS_PCT = 7;
export const CONSULT_BIRTH_WEIGHT_LOSS_PCT = 10;
/** Birth weight should be regained by this age (days). */
export const REGAIN_BIRTH_WEIGHT_BY_DAY = 14;
/** Newborn-only insights (loss / regained) are shown up to this age. */
export const NEWBORN_INSIGHTS_MAX_AGE_DAYS = 28;
/** Early physiological weight loss distorts percentiles & gain before this age; skip them. */
export const EARLY_PERIOD_DAYS = 14;
/** Minimum span between two weights for a gain assessment. */
export const MIN_GAIN_SPAN_DAYS = 7;
export const LOW_PERCENTILE = 3;
export const HIGH_PERCENTILE = 97;
/** Lines whose downward crossing counts (WHO chart lines P3, P15, P50, P85, P97). */
export const MAJOR_PERCENTILE_LINES: readonly number[] = CHART_PERCENTILES;
export const CROSSING_LINES_THRESHOLD = 2;

export type InsightSeverity = 'info' | 'warn' | 'alert';

export type GrowthInsight =
  | {
      kind: 'birthWeightLoss';
      severity: InsightSeverity;
      /** Largest loss in the first 14 days, positive percent. */
      pct: number;
      ageDays: number;
      date: IsoDate;
    }
  | {
      kind: 'birthWeightRegained';
      severity: 'info';
      ageDays: number;
      date: IsoDate;
      onTime: boolean;
    }
  | {
      kind: 'birthWeightNotRegained';
      severity: 'warn';
      ageDays: number;
      date: IsoDate;
      /** Signed % vs birth weight (negative). */
      pct: number;
    }
  | {
      kind: 'lowPercentile' | 'highPercentile';
      severity: 'warn';
      indicator: GrowthIndicator;
      percentile: number;
      z: number;
      date: IsoDate;
    }
  | {
      kind: 'percentileCrossingDown';
      severity: 'warn';
      indicator: GrowthIndicator;
      linesCrossed: number;
      fromPercentile: number;
      toPercentile: number;
      fromDate: IsoDate;
      toDate: IsoDate;
    }
  | {
      kind: 'lowWeightGain';
      severity: 'warn';
      gPerWeek: number;
      minGPerWeek: number;
      maxGPerWeek: number;
      days: number;
      fromDate: IsoDate;
      toDate: IsoDate;
    };

export interface GrowthInsightsInput {
  baby: Pick<Baby, 'birthDate' | 'birthWeightG' | 'sex'>;
  measurements: readonly Measurement[];
  /** Loaded WHO tables; percentile-based insights are skipped for missing ones. */
  tables: Partial<Record<GrowthIndicator, LmsTable>>;
  now: EpochMs | Date;
}

const SEVERITY_RANK: Record<InsightSeverity, number> = { alert: 0, warn: 1, info: 2 };
const MAJOR_LINE_Z = MAJOR_PERCENTILE_LINES.map((p) => normalQuantile(p / 100));

/** All applicable growth insights, most severe first. */
export function growthInsights(input: GrowthInsightsInput): GrowthInsight[] {
  const { baby, measurements, tables, now } = input;
  const out: GrowthInsight[] = [];
  const todayAge = ageInDays(baby.birthDate, now);
  const weights = growthSeries(baby, measurements, 'weight');

  out.push(...birthWeightInsights(baby.birthWeightG, weights, todayAge));

  const weightGain = lowWeightGainInsight(weights);
  if (weightGain) out.push(weightGain);

  for (const indicator of GROWTH_INDICATORS) {
    const table = tables[indicator];
    if (!table) continue;
    const series = growthSeries(baby, measurements, indicator);
    const assessed = assessSeries(series, table, indicator, baby.sex);
    out.push(...percentileInsights(assessed, indicator));
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function birthWeightInsights(
  birthWeightG: number | undefined,
  weights: readonly GrowthPoint[],
  todayAge: number,
): GrowthInsight[] {
  if (birthWeightG === undefined || !(birthWeightG > 0)) return [];
  const out: GrowthInsight[] = [];
  const later = weights.filter((p) => p.source === 'measurement' && p.ageDays > 0);

  if (todayAge <= NEWBORN_INSIGHTS_MAX_AGE_DAYS) {
    let nadir: GrowthPoint | undefined;
    for (const p of later) {
      if (p.ageDays <= REGAIN_BIRTH_WEIGHT_BY_DAY && (!nadir || p.value < nadir.value)) nadir = p;
    }
    if (nadir && nadir.value < birthWeightG) {
      const pct = -percentChangeFromBirth(birthWeightG, nadir.value);
      const severity: InsightSeverity =
        pct > CONSULT_BIRTH_WEIGHT_LOSS_PCT
          ? 'alert'
          : pct > NORMAL_BIRTH_WEIGHT_LOSS_PCT
            ? 'warn'
            : 'info';
      out.push({
        kind: 'birthWeightLoss',
        severity,
        pct,
        ageDays: nadir.ageDays,
        date: nadir.date,
      });
    }
  }

  const regained = later.find((p) => p.value >= birthWeightG);
  if (regained && todayAge <= NEWBORN_INSIGHTS_MAX_AGE_DAYS) {
    out.push({
      kind: 'birthWeightRegained',
      severity: 'info',
      ageDays: regained.ageDays,
      date: regained.date,
      onTime: regained.ageDays <= REGAIN_BIRTH_WEIGHT_BY_DAY,
    });
  }

  // Still (or again) below birth weight after the expected regain window.
  const latest = later[later.length - 1];
  if (latest && latest.value < birthWeightG && latest.ageDays > REGAIN_BIRTH_WEIGHT_BY_DAY) {
    out.push({
      kind: 'birthWeightNotRegained',
      severity: 'warn',
      ageDays: latest.ageDays,
      date: latest.date,
      pct: percentChangeFromBirth(birthWeightG, latest.value),
    });
  }
  return out;
}

function lowWeightGainInsight(weights: readonly GrowthPoint[]): GrowthInsight | null {
  const eligible = weights.filter((p) => p.ageDays >= EARLY_PERIOD_DAYS);
  const gain = latestWeightGain(eligible, MIN_GAIN_SPAN_DAYS);
  if (!gain) return null;
  const range = typicalWeeklyGain(Math.round((gain.from.ageDays + gain.to.ageDays) / 2));
  if (!range || gain.gPerWeek >= range.minGPerWeek) return null;
  return {
    kind: 'lowWeightGain',
    severity: 'warn',
    gPerWeek: gain.gPerWeek,
    minGPerWeek: range.minGPerWeek,
    maxGPerWeek: range.maxGPerWeek,
    days: gain.days,
    fromDate: gain.from.date,
    toDate: gain.to.date,
  };
}

function percentileInsights(
  assessed: readonly AssessedPoint[],
  indicator: GrowthIndicator,
): GrowthInsight[] {
  const out: GrowthInsight[] = [];
  const valid = assessed.filter(
    (p): p is AssessedPoint & { z: number; percentile: number } =>
      p.z !== null && p.percentile !== null,
  );
  const latest = valid[valid.length - 1];
  if (!latest) return out;

  if (latest.percentile < LOW_PERCENTILE || latest.percentile > HIGH_PERCENTILE) {
    out.push({
      kind: latest.percentile < LOW_PERCENTILE ? 'lowPercentile' : 'highPercentile',
      severity: 'warn',
      indicator,
      percentile: latest.percentile,
      z: latest.z,
      date: latest.date,
    });
  }

  // Downward crossing: compare the latest point with the HIGHEST earlier point (after the early
  // physiological-loss period) and count major lines L with latest.z < L ≤ reference.z.
  if (latest.ageDays >= EARLY_PERIOD_DAYS) {
    let reference: (typeof valid)[number] | undefined;
    for (const p of valid.slice(0, -1)) {
      if (p.ageDays >= EARLY_PERIOD_DAYS && (!reference || p.z > reference.z)) reference = p;
    }
    if (reference) {
      const refZ = reference.z;
      const linesCrossed = MAJOR_LINE_Z.filter((lz) => latest.z < lz && lz <= refZ).length;
      if (linesCrossed >= CROSSING_LINES_THRESHOLD) {
        out.push({
          kind: 'percentileCrossingDown',
          severity: 'warn',
          indicator,
          linesCrossed,
          fromPercentile: reference.percentile,
          toPercentile: latest.percentile,
          fromDate: reference.date,
          toDate: latest.date,
        });
      }
    }
  }
  return out;
}
