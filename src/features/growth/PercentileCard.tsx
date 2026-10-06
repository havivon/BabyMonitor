import { formatAge } from '../../domain/age';
import { parseDateKey } from '../../domain/dates';
import {
  latestWeightGain,
  percentChangeFromBirth,
  type WeightGain,
} from '../../domain/growth/gain';
import { formatPercentile } from '../../domain/growth/percentiles';
import type { AssessedPoint } from '../../domain/growth/series';
import type { GrowthIndicator } from '../../domain/growth/who';
import type { Baby, WeightUnit } from '../../domain/types';
import { formatNumber, gToLb, UNIT_LABELS } from '../../domain/units';
import { METRIC_LABEL, metricQuantity } from './metrics';
import { percentileDescription } from './percentileCopy';
import { formatDateMedium, signed } from './ui/format';
import { Qty } from './ui/Qty';

/** Gains are reported between points ≥ 7 days apart (DESIGN §7.7). */
const MIN_GAIN_DAYS = 7;
/** "% vs birth weight" is shown while the latest weight is within the first 6 months. */
const VS_BIRTH_MAX_AGE_DAYS = 183;

interface Props {
  baby: Baby;
  metric: GrowthIndicator;
  points: readonly AssessedPoint[];
  weightUnit: WeightUnit;
  /** False while the WHO tables load (percentile shows a placeholder). */
  tablesReady: boolean;
}

const PSCALE_TICKS = [3, 15, 50, 85, 97];

function GainValue({ grams, weightUnit }: { grams: number; weightUnit: WeightUnit }) {
  return weightUnit === 'kg' ? (
    <>
      <span className="ltr num">{signed(grams)}</span> {UNIT_LABELS.g}
    </>
  ) : (
    <>
      <span className="ltr num">{signed(gToLb(grams), 2)}</span> {UNIT_LABELS.lb}
    </>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv__item">
      <span className="kv__label">{label}</span>
      <span className="kv__value">{children}</span>
    </div>
  );
}

const Dash = () => <span aria-label="אין נתון">—</span>;

/** Summary card: latest value, percentile badge + scale, and gain figures. */
export function PercentileCard({ baby, metric, points, weightUnit, tablesReady }: Props) {
  const latest = points[points.length - 1];
  if (!latest) {
    return (
      <section className="card card--roomy" aria-label={`סיכום ${METRIC_LABEL[metric]}`}>
        <div className="empty empty--compact empty--growth">
          <p className="empty__title">עוד אין מדידות {METRIC_LABEL[metric]}</p>
          <p className="empty__text">אחרי הוספת מדידה יופיעו כאן האחוזון והשינוי לאורך זמן.</p>
        </div>
      </section>
    );
  }

  const percentile = latest.percentile;
  const shownPercentile = percentile === null ? null : formatPercentile(percentile);
  const title =
    latest.source === 'birth'
      ? `משקל לידה · ${formatDateMedium(latest.date)}`
      : `${METRIC_LABEL[metric]} אחרון · ${formatDateMedium(latest.date)}`;
  const description =
    percentile !== null
      ? percentileDescription(percentile)
      : tablesReady
        ? 'מחוץ לטווח טבלאות WHO (עד גיל 5)'
        : 'מחשב אחוזון…';

  const gain: WeightGain | null =
    metric === 'weight' ? latestWeightGain(points, MIN_GAIN_DAYS) : null;
  const previous = points.length >= 2 ? points[points.length - 2] : undefined;

  return (
    <section className="card card--roomy" aria-label={`סיכום ${METRIC_LABEL[metric]}`}>
      <div className="percentile">
        <div
          className="percentile__badge"
          role="img"
          aria-label={shownPercentile === null ? 'אחוזון לא זמין' : `אחוזון ${shownPercentile}`}
        >
          <span className="percentile__value ltr">{shownPercentile ?? '—'}</span>
          <span className="percentile__label">אחוזון</span>
        </div>
        <div className="percentile__body">
          <span className="percentile__title">{title}</span>
          <span className="percentile__main">
            <Qty q={metricQuantity(metric, latest.value, weightUnit)} />
          </span>
          <span className="text-sm text-muted">
            {description} ·{' '}
            {latest.ageDays === 0
              ? 'ביום הלידה'
              : `בגיל ${formatAge(baby.birthDate, parseDateKey(latest.date))}`}
          </span>
        </div>
      </div>
      {percentile !== null && (
        <div className="pscale" aria-hidden="true">
          <div className="pscale__track">
            <span
              className="pscale__marker"
              style={{ '--p': `${Math.min(100, Math.max(0, percentile))}%` } as React.CSSProperties}
            />
          </div>
          <div className="pscale__ticks">
            {PSCALE_TICKS.map((t) => (
              <span key={t} style={{ left: `${t}%` }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      <hr className="divider" />
      {metric === 'weight' ? (
        <div className="stack stack--2">
          <div className="kv">
            <Kv label="עלייה ליום">
              {gain ? <GainValue grams={gain.gPerDay} weightUnit={weightUnit} /> : <Dash />}
            </Kv>
            <Kv label="עלייה לשבוע">
              {gain ? <GainValue grams={gain.gPerWeek} weightUnit={weightUnit} /> : <Dash />}
            </Kv>
            {baby.birthWeightG !== undefined &&
            latest.source !== 'birth' &&
            latest.ageDays <= VS_BIRTH_MAX_AGE_DAYS ? (
              <Kv label="ממשקל הלידה">
                <span className="ltr num">
                  {signed(percentChangeFromBirth(baby.birthWeightG, latest.value))}%
                </span>
              </Kv>
            ) : (
              <Kv label="מדידות">
                <span className="num">{formatNumber(points.length)}</span>
              </Kv>
            )}
          </div>
          {!gain && (
            <p className="text-sm text-muted">העלייה תוצג אחרי שתי מדידות בהפרש של שבוע לפחות</p>
          )}
        </div>
      ) : (
        <div className="kv" style={{ '--kv-cols': 2 } as React.CSSProperties}>
          <Kv label="שינוי מהמדידה הקודמת">
            {previous ? (
              <>
                <span className="ltr num">{signed((latest.value - previous.value) / 10, 1)}</span>{' '}
                {UNIT_LABELS.cm}
              </>
            ) : (
              <Dash />
            )}
          </Kv>
          <Kv label="מדידות">
            <span className="num">{formatNumber(points.length)}</span>
          </Kv>
        </div>
      )}
    </section>
  );
}
