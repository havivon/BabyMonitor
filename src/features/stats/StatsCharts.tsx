import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from 'recharts';
import { formatNumber } from '../../domain/units';
import { formatDateMedium } from '../growth/ui/format';
import { usePrefersReducedMotion } from '../growth/ui/usePrefersReducedMotion';
import type { ChartDay } from './statsModel';

const TODAY_OPACITY = 0.45;

interface TickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
}

/** X tick; "היום" is semibold (DESIGN §10). */
function DayTick({ x, y, payload }: TickProps): ReactElement {
  const value = String(payload?.value ?? '');
  return (
    <text
      x={Number(x)}
      y={Number(y) + 12}
      textAnchor="middle"
      className="recharts-text"
      fontWeight={value === 'היום' ? 600 : undefined}
    >
      {value}
    </text>
  );
}

interface Series {
  key: keyof ChartDay;
  label: string;
  color: string;
}

function DayTooltip({
  active,
  payload,
  series,
  unit,
  convert,
}: Partial<TooltipContentProps> & {
  series: Series[];
  unit?: string;
  convert?: (v: number) => string;
}) {
  const day = payload?.[0]?.payload as ChartDay | undefined;
  if (!active || !day) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__title">
        {day.isToday ? 'היום' : formatDateMedium(day.date)}
      </span>
      {series.map((s) => {
        const raw = Number(day[s.key]);
        return (
          <span key={s.key} className="chart-tooltip__row">
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.label}
            <strong>
              <span className="ltr num">{convert ? convert(raw) : formatNumber(raw)}</span>
              {unit ? ` ${unit}` : ''}
            </strong>
          </span>
        );
      })}
    </div>
  );
}

interface BarsProps {
  days: readonly ChartDay[];
  series: Series[];
  ariaLabel: string;
  height: number;
  unit?: string;
  convert?: (v: number) => number;
  formatValue?: (v: number) => string;
  /** Optional guideline band (already in display units). */
  band?: { min: number; max: number } | null;
}

/** Bars per day; several series stack. Today's bar is drawn at reduced opacity. */
export function DayBars({
  days,
  series,
  ariaLabel,
  height,
  unit,
  convert,
  formatValue,
  band,
}: BarsProps) {
  const animate = !usePrefersReducedMotion();
  const data = days.map((d) => {
    const row: Record<string, number | string | boolean> = { ...d };
    if (convert) for (const s of series) row[s.key] = convert(Number(d[s.key]));
    return row;
  });
  const barSize = days.length > 14 ? 8 : days.length > 7 ? 14 : 24;
  const cell = (d: ChartDay, s: Series): string => {
    const raw = Number(d[s.key]);
    const v = convert ? convert(raw) : raw;
    return `${formatValue ? formatValue(v) : formatNumber(v)}${unit ? ` ${unit}` : ''}`;
  };
  return (
    <>
      <div
        className="chart"
        dir="ltr"
        role="img"
        aria-label={ariaLabel}
        style={{ '--chart-h': `${height}px` } as React.CSSProperties}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              interval="preserveStartEnd"
              tick={DayTick}
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              tickCount={5}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-2)' }}
              isAnimationActive={false}
              content={(p) => (
                <DayTooltip {...p} series={series} unit={unit} convert={formatValue} />
              )}
            />
            {band && (
              <>
                <ReferenceArea
                  y1={band.min}
                  y2={band.max}
                  fill="var(--color-chart-target)"
                  fillOpacity={1}
                  ifOverflow="extendDomain"
                />
                <ReferenceLine
                  y={band.min}
                  stroke="var(--color-primary)"
                  strokeOpacity={0.7}
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  y={band.max}
                  stroke="var(--color-primary)"
                  strokeOpacity={0.7}
                  strokeDasharray="3 3"
                />
              </>
            )}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={series.length > 1 ? 'stack' : undefined}
                fill={s.color}
                stroke={series.length > 1 ? 'var(--color-surface)' : undefined}
                strokeWidth={series.length > 1 ? 2 : 0}
                barSize={barSize}
                radius={i === series.length - 1 ? [5, 5, 0, 0] : undefined}
                isAnimationActive={animate}
                animationDuration={400}
                shape={(props: BarShapeProps) => (
                  <Rectangle
                    {...props}
                    fillOpacity={days[props.index]?.isToday ? TODAY_OPACITY : 1}
                  />
                )}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Text alternative for the chart (same data, same series names). A wrapper div carries
        .visually-hidden: tables ignore width/overflow and would widen the page. */}
      <div className="visually-hidden">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">יום</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{d.isToday ? 'היום' : formatDateMedium(d.date)}</th>
                {series.map((s) => (
                  <td key={s.key}>{cell(d, s)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
