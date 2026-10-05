import { CircleDashed, Ruler, Weight } from 'lucide-react';
import { ageInDaysOn } from '../../domain/age';
import { assess, formatPercentile } from '../../domain/growth/percentiles';
import { measurementValue } from '../../domain/growth/series';
import type { GrowthIndicator, WhoTables } from '../../domain/growth/who';
import type { Baby, Measurement, WeightUnit } from '../../domain/types';
import { METRIC_LABEL, metricQuantity } from './metrics';
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
 * Measurements, newest first, with the birth weight as the last (read-only, edited in Settings)
 * row — unless a weight was also recorded as a measurement on the birth date.
 */
export function MeasurementList({ baby, measurements, metric, weightUnit, tables, onEdit }: Props) {
  const Icon = ICON[metric];
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
                {(others.length > 0 || m.note) && (
                  <span className="row__sub">
                    {others.map((node, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        {node}
                      </span>
                    ))}
                    {m.note && `${others.length > 0 ? ' · ' : ''}${m.note}`}
                  </span>
                )}
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
      {baby.birthWeightG !== undefined &&
        !measurements.some((m) => m.date === baby.birthDate && m.weightG !== undefined) && (
          <li>
            <div className="row row--growth">
              <span className="row__icon">
                <Weight aria-hidden="true" />
              </span>
              <span className="row__body">
                <span className="row__title">{formatDateLong(baby.birthDate)}</span>
                <span className="row__sub">משקל לידה</span>
              </span>
              <EndValue
                baby={baby}
                metric="weight"
                value={baby.birthWeightG}
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
