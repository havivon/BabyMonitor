import { CircleDashed, Ruler, Weight } from 'lucide-react';
import { ageInDaysOn } from '../../domain/age';
import { assess, formatPercentile } from '../../domain/growth/percentiles';
import { birthValue, measurementValue } from '../../domain/growth/series';
import type { GrowthIndicator, WhoTables } from '../../domain/growth/who';
import type { Baby, Measurement, WeightUnit } from '../../domain/types';
import { BIRTH_LABEL, METRIC_LABEL, metricQuantity } from './metrics';
import { formatDateLong, lengthQuantity, weightQuantity } from './ui/format';
import { Qty } from './ui/Qty';

const ICON: Record<GrowthIndicator, typeof Weight> = {
  weight: Weight,
  length: Ruler,
  head: CircleDashed,
};
const OTHERS: Record<GrowthIndicator, GrowthIndicator[]> = {
  weight: ['length', 'head'],
  length: ['weight', 'head'],
  head: ['weight', 'length'],
};

interface Props {
  baby: Baby;
  /** Newest first. */
  measurements: readonly Measurement[];
  metric: GrowthIndicator;
  weightUnit: WeightUnit;
  tables: WhoTables | null;
  onEdit: (measurement: Measurement) => void;
}

function EndValue({
  baby,
  metric,
  value,
  date,
  weightUnit,
  tables,
}: {
  baby: Baby;
  metric: GrowthIndicator;
  value: number | undefined;
  date: string;
  weightUnit: WeightUnit;
  tables: WhoTables | null;
}) {
  if (value === undefined) return <span className="row__end">—</span>;
  const a = tables
    ? assess(tables[metric], metric, baby.sex, ageInDaysOn(baby.birthDate, date), value)
    : null;
  return (
    <span className="row__end">
      <span className="row__value">
        <Qty q={metricQuantity(metric, value, weightUnit)} />
      </span>
      {a && (
        <span
          className="badge badge--growth"
          aria-label={`אחוזון ${formatPercentile(a.percentile)}`}
        >
          <span className="ltr">{formatPercentile(a.percentile)}</span>
        </span>
      )}
    </span>
  );
}

/**
 * Measurements, newest first, with the profile's birth value of the selected metric as the last
 * (read-only, edited in Settings) row — unless it was also recorded as a measurement that day.
 */
export function MeasurementList({ baby, measurements, metric, weightUnit, tables, onEdit }: Props) {
  const Icon = ICON[metric];
  // The profile's birth value of this metric, unless also recorded as a measurement that day.
  const atBirth = birthValue(baby, metric);
  const measuredAtBirth = measurements.some(
    (m) => m.date === baby.birthDate && measurementValue(m, metric) !== undefined,
  );
  return (
    <ul className="list" role="list">
      {measurements.map((m) => {
        const others = OTHERS[metric]
          .map((k) => {
            const v = measurementValue(m, k);
            if (v === undefined) return null;
            const q = k === 'weight' ? weightQuantity(v, weightUnit) : lengthQuantity(v);
            return (
              <span key={k}>
                {METRIC_LABEL[k]} <Qty q={q} />
              </span>
            );
          })
          .filter((x) => x !== null);
        return (
          <li key={m.id}>
            <button
              type="button"
              className="row row--growth"
              onClick={() => {
                onEdit(m);
              }}
              aria-label={`עריכת מדידה מ-${formatDateLong(m.date)}`}
            >
              <span className="row__icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="row__body">
                <span className="row__title">{formatDateLong(m.date)}</span>
                {(() => {
                  const parts: React.ReactNode[] = [];
                  if (m.date === baby.birthDate) parts.push('משקל לידה');
                  parts.push(...others);
                  if (m.note) parts.push(m.note);
                  return parts.length > 0 ? (
                    <span className="row__sub">
                      {parts.map((node, i) => (
                        <span key={i}>
                          {i > 0 && ' · '}
                          {node}
                        </span>
                      ))}
                    </span>
                  ) : null;
                })()}
              </span>
              <EndValue
                baby={baby}
                metric={metric}
                value={measurementValue(m, metric)}
                date={m.date}
                weightUnit={weightUnit}
                tables={tables}
              />
            </button>
          </li>
        );
      })}
      {atBirth !== undefined && !measuredAtBirth && (
        <li>
          <div className="row row--growth">
            <span className="row__icon">
              <Icon aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">{formatDateLong(baby.birthDate)}</span>
              <span className="row__sub">{BIRTH_LABEL[metric]}</span>
            </span>
            <EndValue
              baby={baby}
              metric={metric}
              value={atBirth}
              date={baby.birthDate}
              weightUnit={weightUnit}
              tables={tables}
            />
          </div>
        </li>
      )}
    </ul>
  );
}
