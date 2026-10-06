import { AppHeader } from '../../app/AppHeader';
import {
  ChartColumn,
  Clock,
  Heart,
  Info,
  Milk,
  Repeat2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ageInDays } from '../../domain/age';
import { expectedDailyMilk } from '../../domain/growth/milk';
import { growthSeries } from '../../domain/growth/series';
import { formatHoursMinutes, formatNumber, mlToOz, UNIT_LABELS } from '../../domain/units';
import { useNow } from '../../hooks/useNow';
import { isMainlyBottleFed } from '../../domain/feeding';
import {
  useActiveBaby,
  useActiveEntries,
  useActiveMeasurements,
  useActiveTimer,
  useSettings,
} from '../../store';
import { signed } from '../growth/ui/format';
import { Segmented } from '../growth/ui/Segmented';
import { DayBars } from './StatsCharts';
import { volumeConverter, volumeUnitLabel } from './volume';
import {
  chartDays,
  daysWithData,
  delta,
  RANGE_OPTIONS,
  statsSummary,
  type RangeDays,
} from './statsModel';

const RANGE_SEG = RANGE_OPTIONS.map((value) => ({
  value: String(value) as `${RangeDays}`,
  label: `${value} ימים`,
}));

interface StatTileProps {
  modifier?: 'primary' | 'bottle' | 'breast';
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  /** Signed text of the change vs the previous period, or null. */
  change: { text: string; direction: number; unit?: string } | null;
  /** Screen-reader context for the delta, e.g. "לעומת 7 הימים הקודמים". */
  vsLabel: string;
}

function StatTile({ modifier, icon, label, value, unit, change, vsLabel }: StatTileProps) {
  return (
    <div className={modifier ? `stat stat--${modifier}` : 'stat'}>
      <span className="stat__label">
        {icon}
        {label}
      </span>
      <span className="stat__value">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </span>
      {change ? (
        // Value + unit only, on one line; the comparison period is captioned once under the grid.
        <span className="stat__delta" style={{ whiteSpace: 'nowrap' }}>
          {change.text === '0' ? (
            'ללא שינוי'
          ) : (
            <>
              {change.direction > 0 ? (
                <TrendingUp aria-hidden="true" />
              ) : (
                <TrendingDown aria-hidden="true" />
              )}
              <span className="ltr">{change.text}</span>
              {change.unit ? ` ${change.unit}` : ''}
            </>
          )}
          <span className="visually-hidden"> {vsLabel}</span>
        </span>
      ) : (
        <span className="stat__sub">ממוצע יומי</span>
      )}
    </div>
  );
}

const DASH = '—';

/** Left-side breast series: a solid tint that keeps ≥ 3:1 contrast (design review P2-5). */
const LEFT_BREAST_COLOR = 'color-mix(in srgb, var(--color-breast) 70%, var(--color-surface))';

/** Stats screen (DESIGN §7.8): daily averages vs the previous period, and per-day charts. */
export function StatsPage() {
  const baby = useActiveBaby();
  const entries = useActiveEntries();
  const measurements = useActiveMeasurements();
  const { volumeUnit } = useSettings();
  const timer = useActiveTimer();
  const now = useNow(60_000);
  const [range, setRange] = useState<RangeDays>(7);

  const summary = useMemo(() => statsSummary(entries, range, now), [entries, range, now]);
  const days = useMemo(() => chartDays(entries, range, now), [entries, range, now]);
  const enoughData = useMemo(() => daysWithData(entries) >= 2, [entries]);

  const guideBand = useMemo(() => {
    if (!baby || !isMainlyBottleFed(entries, now, timer)) return null;
    const weight = growthSeries(baby, measurements, 'weight').at(-1)?.value;
    const r =
      weight === undefined ? null : expectedDailyMilk(weight, ageInDays(baby.birthDate, now));
    if (!r) return null;
    // Guideline shown rounded to 10 ml (design review P3-3).
    const conv = (raw: number) => {
      const ml = Math.round(raw / 10) * 10;
      return volumeUnit === 'oz' ? Math.round(mlToOz(ml) * 10) / 10 : ml;
    };
    return { min: conv(r.minMl), max: conv(r.maxMl) };
  }, [baby, entries, measurements, now, volumeUnit, timer]);

  if (!baby) return null;

  const { current, previous } = summary;
  const vsLabel = `לעומת ${range} הימים הקודמים`;
  /** Change vs the previous period, always carrying the metric's unit (except plain counts). */
  const change = (d: number | null, digits: number, unit?: string) =>
    d === null || current.activeDays === 0 || previous.activeDays === 0
      ? null
      : { text: signed(d, digits), direction: d, unit };
  const vol = (ml: number) =>
    volumeUnit === 'ml' ? Math.round(ml) : Math.round(mlToOz(ml) * 10) / 10;
  const volDigits = volumeUnit === 'ml' ? 0 : 1;

  const hasBottle = days.some((d) => d.bottleMl > 0);
  const hasBreast = days.some((d) => d.rightMin + d.leftMin > 0);
  const hasFeeds = days.some((d) => d.breast + d.bottle + d.solid > 0);
  const volUnit = volumeUnitLabel(volumeUnit);

  return (
    <>
      <AppHeader title="סטטיסטיקה" />
      <main className="page" style={{ gap: 'var(--space-4)' }}>
        {enoughData && (
          <Segmented
            label="טווח"
            options={RANGE_SEG}
            value={String(range) as `${RangeDays}`}
            onChange={(v) => {
              setRange(Number(v) as RangeDays);
            }}
          />
        )}
        {!enoughData ? (
          <div className="empty">
            <span className="empty__icon">
              <ChartColumn aria-hidden="true" />
            </span>
            <p className="empty__title">אין עדיין מספיק נתונים</p>
            <p className="empty__text">אחרי כמה ימים של רישום יופיעו כאן מגמות.</p>
          </div>
        ) : (
          <>
            <div
              className="stat-grid"
              aria-label={`ממוצעים יומיים ב-${range} הימים האחרונים (ללא היום)`}
              role="group"
            >
              <StatTile
                modifier="primary"
                icon={<Clock aria-hidden="true" />}
                label="האכלות חלב ביום"
                value={
                  current.feedsPerDay === null ? DASH : formatNumber(current.feedsPerDay, 0, 1)
                }
                change={change(delta(current.feedsPerDay, previous.feedsPerDay), 1)}
                vsLabel={vsLabel}
              />
              <StatTile
                modifier="bottle"
                icon={<Milk aria-hidden="true" />}
                label="בקבוק ביום"
                value={
                  current.bottleMlPerDay === null
                    ? DASH
                    : formatNumber(vol(current.bottleMlPerDay), volDigits)
                }
                unit={current.bottleMlPerDay === null ? undefined : volUnit}
                change={change(
                  delta(
                    current.bottleMlPerDay === null ? null : vol(current.bottleMlPerDay),
                    previous.bottleMlPerDay === null ? null : vol(previous.bottleMlPerDay),
                  ),
                  volDigits,
                  volUnit,
                )}
                vsLabel={vsLabel}
              />
              <StatTile
                modifier="breast"
                icon={<Heart aria-hidden="true" />}
                label="הנקה ביום"
                value={
                  current.breastMinPerDay === null
                    ? DASH
                    : formatNumber(Math.round(current.breastMinPerDay))
                }
                unit={current.breastMinPerDay === null ? undefined : UNIT_LABELS.minutesShort}
                change={change(
                  delta(
                    current.breastMinPerDay === null ? null : Math.round(current.breastMinPerDay),
                    previous.breastMinPerDay === null ? null : Math.round(previous.breastMinPerDay),
                  ),
                  0,
                  UNIT_LABELS.minutesShort,
                )}
                vsLabel={vsLabel}
              />
              <StatTile
                icon={<Repeat2 aria-hidden="true" />}
                label="מרווח ממוצע"
                value={
                  current.avgIntervalMs === null ? (
                    DASH
                  ) : (
                    <span className="ltr">{formatHoursMinutes(current.avgIntervalMs)}</span>
                  )
                }
                unit={current.avgIntervalMs === null ? undefined : UNIT_LABELS.hoursShort}
                change={(() => {
                  const d = delta(current.avgIntervalMs, previous.avgIntervalMs);
                  return change(
                    d === null ? null : Math.round(d / 60_000),
                    0,
                    UNIT_LABELS.minutesShort,
                  );
                })()}
                vsLabel={vsLabel}
              />
            </div>
            <p
              className="text-sm text-muted"
              style={{ marginBlockStart: 'calc(var(--space-2) * -1)' }}
            >
              ממוצע יומי · השינוי לעומת {range} הימים הקודמים
            </p>

            {hasFeeds && (
              <section className="card" aria-labelledby="stats-feeds-title">
                <div className="card__header">
                  <h2 className="card__title" id="stats-feeds-title">
                    האכלות ומוצקים לפי יום
                  </h2>
                </div>
                <DayBars
                  days={days}
                  height={180}
                  ariaLabel="מספר ההאכלות (הנקה ובקבוק) והארוחות המוצקות לפי יום"
                  series={[
                    { key: 'breast', label: 'הנקה', color: 'var(--color-breast)' },
                    { key: 'bottle', label: 'בקבוק', color: 'var(--color-bottle)' },
                    { key: 'solid', label: 'מוצקים', color: 'var(--color-solid)' },
                  ]}
                />
                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--breast" />
                    הנקה
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--bottle" />
                    בקבוק
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--solid" />
                    מוצקים
                  </span>
                </div>
              </section>
            )}

            {hasBottle && (
              <section className="card" aria-labelledby="stats-ml-title">
                <div className="card__header">
                  <h2 className="card__title" id="stats-ml-title">
                    כמות בקבוק יומית
                  </h2>
                  {guideBand && <span className="badge">הנחיה כללית</span>}
                </div>
                <DayBars
                  days={days}
                  height={170}
                  ariaLabel={`כמות בקבוק יומית ב${volUnit}`}
                  unit={volUnit}
                  convert={volumeConverter(volumeUnit)}
                  formatValue={(v) => formatNumber(v, 0, volDigits)}
                  band={guideBand}
                  series={[
                    { key: 'bottleMl', label: `${volUnit} ביום`, color: 'var(--color-bottle)' },
                  ]}
                />
                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--bottle" />
                    {volUnit} ביום
                  </span>
                  {guideBand && (
                    <span className="legend-item">
                      <span className="legend-swatch legend-swatch--target" />
                      טווח מומלץ (בקבוק בלבד)
                    </span>
                  )}
                </div>
                {guideBand && (
                  <p className="disclaimer">
                    <Info aria-hidden="true" />
                    <span>
                      לפי כ-150 מ״ל לק״ג ליום עבור תינוקות הניזונים מבקבוק. אינו תחליף לייעוץ רפואי.
                    </span>
                  </p>
                )}
              </section>
            )}

            {hasBreast && (
              <section className="card" aria-labelledby="stats-breast-title">
                <div className="card__header">
                  <h2 className="card__title" id="stats-breast-title">
                    זמן הנקה יומי
                  </h2>
                </div>
                <DayBars
                  days={days}
                  height={170}
                  ariaLabel="דקות הנקה ביום, לפי צד"
                  unit={UNIT_LABELS.minutesShort}
                  series={[
                    { key: 'rightMin', label: 'ימין', color: 'var(--color-breast)' },
                    { key: 'leftMin', label: 'שמאל', color: LEFT_BREAST_COLOR },
                  ]}
                />
                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--breast" />
                    ימין
                  </span>
                  <span className="legend-item">
                    <span
                      className="legend-swatch legend-swatch--breast"
                      style={{ background: LEFT_BREAST_COLOR }}
                    />
                    שמאל
                  </span>
                </div>
              </section>
            )}
            <p className="disclaimer">
              <Info aria-hidden="true" />
              <span>הממוצעים מחושבים על ימים מלאים בלבד, ללא היום.</span>
            </p>
          </>
        )}
      </main>
    </>
  );
}
