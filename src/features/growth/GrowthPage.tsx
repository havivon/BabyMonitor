import { Info, LoaderCircle, Plus, RotateCw, Sprout, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppHeader } from '../../app/AppHeader';
import { useToast } from '../../components/toast';
import { ageInDays } from '../../domain/age';
import { toDateKey } from '../../domain/dates';
import { growthInsights } from '../../domain/growth/insights';
import { formatPercentile } from '../../domain/growth/percentiles';
import { assessSeries, growthSeries } from '../../domain/growth/series';
import type { GrowthIndicator } from '../../domain/growth/who';
import type { Measurement } from '../../domain/types';
import { useNow } from '../../hooks/useNow';
import { he } from '../../i18n/he';
import {
  appStore,
  useActiveBaby,
  useActiveEntries,
  useActiveMeasurements,
  useSettings,
} from '../../store';
import { ageLabel, buildChartRows, chartRange } from './chartModel';
import { GrowthChart } from './GrowthChart';
import { InsightBanners } from './InsightBanners';
import { MeasurementList } from './MeasurementList';
import { MeasurementSheet } from './MeasurementSheet';
import type { MeasurementInput } from './measurementForm';
import { CHART_TITLE, METRIC_LABEL, metricQuantity } from './metrics';
import { MilkGuideCard } from './MilkGuideCard';
import { milkGuide } from './milkModel';
import { PercentileCard } from './PercentileCard';
import { formatDateLong } from './ui/format';
import { Segmented } from './ui/Segmented';
import { useWhoTables } from './useWhoTables';

const METRIC_OPTIONS = (['weight', 'length', 'head'] as const).map((value) => ({
  value,
  label: METRIC_LABEL[value],
}));

type SheetState = { open: boolean; measurement: Measurement | null; session: number };

const DISCLAIMER =
  'האחוזונים מחושבים לפי טבלאות ארגון הבריאות העולמי (WHO). המידע אינו מהווה ייעוץ רפואי.';

/** Growth screen (DESIGN §7.7): WHO percentile summary, chart, flags, measurements and guideline. */
export function GrowthPage() {
  const baby = useActiveBaby();
  const measurements = useActiveMeasurements();
  const entries = useActiveEntries();
  const { weightUnit, volumeUnit } = useSettings();
  const now = useNow(60_000);
  const toast = useToast();
  const { state: who, retry } = useWhoTables();
  const tables = who.status === 'ready' ? who.tables : null;
  const [metric, setMetric] = useState<GrowthIndicator>('weight');
  const [sheet, setSheet] = useState<SheetState>({ open: false, measurement: null, session: 0 });

  const today = toDateKey(now);
  const todayAge = baby ? ageInDays(baby.birthDate, now) : 0;

  const points = useMemo(() => {
    if (!baby) return [];
    const series = growthSeries(baby, measurements, metric);
    return tables
      ? assessSeries(series, tables[metric], metric, baby.sex)
      : series.map((p) => ({ ...p, z: null, percentile: null }));
  }, [baby, measurements, metric, tables]);

  const range = chartRange(todayAge, points[points.length - 1]?.ageDays ?? null);
  const rows = useMemo(
    () =>
      baby
        ? buildChartRows(tables?.[metric] ?? null, metric, baby.sex, range, points, weightUnit)
        : [],
    // `range` is derived from primitives below; listing them keeps the memo stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baby, tables, metric, range.days, range.unit, points, weightUnit],
  );

  const insights = useMemo(
    () => (baby ? growthInsights({ baby, measurements, tables: tables ?? {}, now }) : []),
    [baby, measurements, tables, now],
  );

  const latestWeight = useMemo(() => {
    if (!baby) return undefined;
    return growthSeries(baby, measurements, 'weight').at(-1)?.value;
  }, [baby, measurements]);
  const guide = useMemo(
    () => milkGuide(latestWeight, todayAge, entries, now),
    [latestWeight, todayAge, entries, now],
  );

  if (!baby) return null;

  const openSheet = (measurement: Measurement | null) => {
    setSheet((s) => ({ open: true, measurement, session: s.session + 1 }));
  };
  const closeSheet = () => {
    setSheet((s) => ({ ...s, open: false }));
  };

  const save = (input: MeasurementInput) => {
    const { addMeasurement, updateMeasurement } = appStore.getState();
    if (sheet.measurement)
      updateMeasurement({ id: sheet.measurement.id, babyId: sheet.measurement.babyId, ...input });
    else addMeasurement({ babyId: baby.id, ...input });
    closeSheet();
    toast.show({ text: 'המדידה נשמרה' });
  };

  const remove = (m: Measurement) => {
    const removed = appStore.getState().deleteMeasurement(m.id);
    closeSheet();
    if (removed) {
      toast.show({
        text: 'המדידה נמחקה',
        actionLabel: he.common.undo,
        onAction: () => {
          appStore.getState().restoreMeasurement(removed);
        },
      });
    }
  };

  const hasAnyData = measurements.length > 0 || baby.birthWeightG !== undefined;
  const newestFirst = [...measurements].reverse();
  const sexLabel = baby.sex === 'female' ? 'בנות' : 'בנים';

  return (
    <>
      <AppHeader
        title="גדילה"
        actions={
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              openSheet(null);
            }}
          >
            <Plus aria-hidden="true" />
            הוספת מדידה
          </button>
        }
      />
      <main className="page" style={{ gap: 'var(--space-4)' }}>
        {!hasAnyData ? (
          <div className="empty empty--growth">
            <span className="empty__icon">
              <Sprout aria-hidden="true" />
            </span>
            <p className="empty__title">עוד אין מדידות</p>
            <p className="empty__text">הוספת מדידת משקל ראשונה תציג את עקומת הגדילה והאחוזון.</p>
            <button
              type="button"
              className="btn btn--primary empty__action"
              onClick={() => {
                openSheet(null);
              }}
            >
              <Plus aria-hidden="true" />
              הוספת מדידה
            </button>
          </div>
        ) : (
          <>
            <Segmented label="מדד" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
            <InsightBanners insights={insights} />
            <PercentileCard
              baby={baby}
              metric={metric}
              points={points}
              weightUnit={weightUnit}
              tablesReady={tables !== null}
            />
            <section className="card" aria-labelledby="growth-chart-title">
              <div className="card__header">
                <div>
                  <h2 className="card__title" id="growth-chart-title">
                    {CHART_TITLE[metric]}
                  </h2>
                  <p className="card__subtitle">
                    {sexLabel} · <span className="ltr">0–{range.months}</span> חודשים · WHO
                  </p>
                </div>
              </div>
              {who.status === 'loading' && (
                <div
                  className="chart"
                  aria-busy="true"
                  style={{ display: 'grid', placeItems: 'center' }}
                >
                  <span className="cluster text-muted text-sm">
                    <LoaderCircle aria-hidden="true" />
                    טוען את טבלאות הגדילה…
                  </span>
                </div>
              )}
              {who.status === 'error' && (
                <div className="banner banner--danger" role="alert">
                  <span className="banner__icon">
                    <TriangleAlert aria-hidden="true" />
                  </span>
                  <div className="banner__body">
                    <p className="banner__title">לא הצלחנו לטעון את טבלאות הגדילה</p>
                    <p className="banner__text">אפשר לנסות שוב. המדידות עצמן שמורות.</p>
                    <button type="button" className="btn btn--outline btn--sm" onClick={retry}>
                      <RotateCw aria-hidden="true" />
                      ניסיון חוזר
                    </button>
                  </div>
                </div>
              )}
              {who.status === 'ready' && (
                <>
                  <GrowthChart
                    metric={metric}
                    rows={rows}
                    range={range}
                    weightUnit={weightUnit}
                    babyName={baby.name}
                    ariaLabel={`עקומת ${CHART_TITLE[metric]} של ${baby.name} עם אחוזוני WHO. הנתונים מופיעים גם בטבלה.`}
                  />
                  <div className="chart-legend">
                    <span className="legend-item">
                      <span className="legend-swatch legend-swatch--line legend-swatch--growth" />
                      {baby.name}
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch legend-swatch--dashed" />
                      אחוזון 50
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch legend-swatch--band" />
                      אחוזונים <span className="ltr">15–85</span>
                    </span>
                  </div>
                </>
              )}
              <table className="visually-hidden">
                <caption>{CHART_TITLE[metric]} — מדידות ואחוזונים</caption>
                <thead>
                  <tr>
                    <th scope="col">תאריך</th>
                    <th scope="col">גיל</th>
                    <th scope="col">{METRIC_LABEL[metric]}</th>
                    <th scope="col">אחוזון</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => {
                    const q = metricQuantity(metric, p.value, weightUnit);
                    return (
                      <tr key={p.date}>
                        <td>{formatDateLong(p.date)}</td>
                        <td>{ageLabel(p.ageDays)}</td>
                        <td>
                          {q.number} {q.unit}
                        </td>
                        <td>{p.percentile === null ? '—' : formatPercentile(p.percentile)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
            {metric === 'weight' && guide && (
              <MilkGuideCard guide={guide} volumeUnit={volumeUnit} />
            )}
            <section className="section">
              <div className="section__header">
                <h2 className="section__title">מדידות</h2>
              </div>
              <MeasurementList
                baby={baby}
                measurements={newestFirst}
                metric={metric}
                weightUnit={weightUnit}
                tables={tables}
                onEdit={openSheet}
              />
            </section>
          </>
        )}
        <p className="disclaimer">
          <Info aria-hidden="true" />
          <span>{DISCLAIMER}</span>
        </p>
      </main>
      <MeasurementSheet
        key={sheet.session}
        open={sheet.open}
        measurement={sheet.measurement}
        birthDate={baby.birthDate}
        today={today}
        weightUnit={weightUnit}
        onSave={save}
        onDelete={remove}
        onClose={closeSheet}
      />
    </>
  );
}
