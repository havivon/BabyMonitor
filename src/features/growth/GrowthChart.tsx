import type { ReactElement } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { DotItemDotProps } from 'recharts/types/util/types';
import { formatPercentile } from '../../domain/growth/percentiles';
import type { GrowthIndicator } from '../../domain/growth/who';
import type { WeightUnit } from '../../domain/types';
import { formatNumber, UNIT_LABELS } from '../../domain/units';
import { ageLabel, xTicks, yDomain, type ChartRange, type ChartRow } from './chartModel';
import { metricQuantity } from './metrics';
import { usePrefersReducedMotion } from './ui/usePrefersReducedMotion';

interface Props {
  metric: GrowthIndicator;
  rows: readonly ChartRow[];
  range: ChartRange;
  weightUnit: WeightUnit;
  babyName: string;
  /** Accessible description of the chart. */
  ariaLabel: string;
}

const fmt = (v: number, metric: GrowthIndicator): string =>
  formatNumber(v, metric === 'weight' ? 2 : 1);

function GrowthTooltip({
  active,
  payload,
  metric,
  weightUnit,
  babyName,
}: Partial<TooltipContentProps> & {
  metric: GrowthIndicator;
  weightUnit: WeightUnit;
  babyName: string;
}) {
  const row = payload?.[0]?.payload as ChartRow | undefined;
  if (!active || !row) return null;
  const unit = metric === 'weight' ? UNIT_LABELS[weightUnit] : UNIT_LABELS.cm;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__title">גיל {ageLabel(row.ageDays)}</span>
      {row.babyRaw !== undefined && (
        <span className="chart-tooltip__row">
          <span className="legend-swatch legend-swatch--growth" />
          {babyName}
          <strong>
            <span className="ltr num">
              {metricQuantity(metric, row.babyRaw, weightUnit).number}
            </span>{' '}
            {unit}
            {row.babyPercentile !== null &&
              row.babyPercentile !== undefined &&
              ` · אחוזון ${formatPercentile(row.babyPercentile)}`}
          </strong>
        </span>
      )}
      {row.p50 !== undefined && (
        <span className="chart-tooltip__row">
          <span className="legend-swatch legend-swatch--dashed" />
          אחוזון 50
          <strong>
            <span className="ltr num">{fmt(row.p50, metric)}</span> {unit}
          </strong>
        </span>
      )}
      {row.p15 !== undefined && row.p85 !== undefined && (
        <span className="chart-tooltip__row">
          <span className="legend-swatch legend-swatch--band" />
          אחוזונים <span className="ltr">15–85</span>
          <strong>
            <span className="ltr num">
              {fmt(row.p15, metric)}–{fmt(row.p85, metric)}
            </span>
          </strong>
        </span>
      )}
    </div>
  );
}

function BabyDot(props: DotItemDotProps): ReactElement {
  const { cx, cy } = props;
  const payload = props.payload as ChartRow;
  if (payload.baby === undefined || cx === undefined || cy === undefined) return <g />;
  return (
    <g>
      {payload.isLatest && (
        <circle cx={cx} cy={cy} r={7} fill="var(--color-growth)" fillOpacity={0.35} />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="var(--color-growth)"
        stroke="var(--color-surface)"
        strokeWidth={2}
      />
    </g>
  );
}

/** Percentile number at the right edge of each WHO line. */
function endLabel(percentile: number, lastIndex: number) {
  function EndLabel(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }): ReactElement {
    if (props.index !== lastIndex) return <g />;
    return (
      <text
        x={Number(props.x) + 4}
        y={Number(props.y) + 3}
        fontSize={10}
        fill="var(--color-chart-axis)"
      >
        {percentile}
      </text>
    );
  }
  return EndLabel;
}

/** WHO percentile chart (DESIGN §10): P3–P97 / P15–P85 bands, P50 dashed, baby line on top. */
export function GrowthChart({ metric, rows, range, weightUnit, babyName, ariaLabel }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;
  const data = rows as ChartRow[];
  const lastIndex = data.length - 1;
  const unitLabel = metric === 'weight' ? UNIT_LABELS[weightUnit] : UNIT_LABELS.cm;
  const ticks = xTicks(range);
  const domain = yDomain(rows, metric);
  const pline = {
    stroke: 'var(--color-chart-pline)',
    strokeWidth: 1,
    dot: false,
    activeDot: false,
    isAnimationActive: false,
  } as const;

  return (
    <div
      className="chart"
      dir="ltr"
      style={{ '--chart-h': '268px' } as React.CSSProperties}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 22, right: 22, bottom: 18, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, ticks[ticks.length - 1] ?? range.months]}
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            label={{
              value: range.unit === 'weeks' ? 'גיל בשבועות' : 'גיל בחודשים',
              position: 'insideBottom',
              offset: -14,
              fontSize: 11,
              fill: 'var(--color-chart-axis)',
            }}
          />
          <YAxis
            width={34}
            tickLine={false}
            axisLine={false}
            tickCount={6}
            domain={domain}
            allowDecimals={false}
            label={{
              value: unitLabel,
              position: 'top',
              offset: 10,
              fontSize: 11,
              fill: 'var(--color-chart-axis)',
            }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-border)' }}
            content={(p) => (
              <GrowthTooltip {...p} metric={metric} weightUnit={weightUnit} babyName={babyName} />
            )}
            isAnimationActive={false}
          />
          <Area
            dataKey="outerBase"
            stackId="outer"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            activeDot={false}
          />
          <Area
            dataKey="outerBand"
            stackId="outer"
            stroke="none"
            fill="var(--color-chart-band-outer)"
            fillOpacity={1}
            isAnimationActive={false}
            activeDot={false}
          />
          <Area
            dataKey="innerBase"
            stackId="inner"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            activeDot={false}
          />
          <Area
            dataKey="innerBand"
            stackId="inner"
            stroke="none"
            fill="var(--color-chart-band-inner)"
            fillOpacity={1}
            isAnimationActive={false}
            activeDot={false}
          />
          <Line dataKey="p3" {...pline} label={endLabel(3, lastIndex)} />
          <Line dataKey="p15" {...pline} label={endLabel(15, lastIndex)} />
          <Line dataKey="p85" {...pline} label={endLabel(85, lastIndex)} />
          <Line dataKey="p97" {...pline} label={endLabel(97, lastIndex)} />
          <Line
            dataKey="p50"
            stroke="var(--color-chart-median)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            label={endLabel(50, lastIndex)}
          />
          <Line
            dataKey="baby"
            name={babyName}
            type="monotone"
            connectNulls
            stroke="var(--color-growth)"
            strokeWidth={2.5}
            dot={BabyDot}
            activeDot={{
              r: 6,
              fill: 'var(--color-growth)',
              stroke: 'var(--color-surface)',
              strokeWidth: 2,
            }}
            isAnimationActive={animate}
            animationDuration={400}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
