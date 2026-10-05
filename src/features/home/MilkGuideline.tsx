import { Info } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { EpochMs, FeedingEntry } from '../../domain/types';
import { volumeNumber, volumeUnitLabel } from '../../i18n/format';
import { he } from '../../i18n/he';
import { useActiveBaby, useActiveMeasurements, useActiveTimer, useSettings } from '../../store';
import { milkGuide } from './milkGuide';

const pct = (v: number): string => `${Math.max(0, Math.min(100, v)).toFixed(1)}%`;

/** Daily bottle amount vs the 120–180 ml/kg/day guideline (conditional — see `milkGuide`). */
export function MilkGuideline({ entries, now }: { entries: FeedingEntry[]; now: EpochMs }) {
  const baby = useActiveBaby();
  const measurements = useActiveMeasurements();
  const timer = useActiveTimer();
  const { volumeUnit } = useSettings();
  if (!baby) return null;
  const guide = milkGuide({ baby, entries, measurements, hasActiveTimer: Boolean(timer), now });
  if (!guide) return null;

  const { range, todayMl } = guide;
  const scale = Math.max(range.maxMl * 1.2, todayMl * 1.05);
  const unit = volumeUnitLabel(volumeUnit);
  const v = (ml: number): string => volumeNumber(ml, volumeUnit);
  const rangeText = `${v(range.minMl)}–${v(range.maxMl)}`;

  return (
    <section className="card" aria-labelledby="milk-guide-title">
      <div className="card__header">
        <h2 className="card__title" id="milk-guide-title">
          {he.home.guide.title}
        </h2>
        <span className="badge">{he.common.guideline}</span>
      </div>
      <div className="meter">
        <div className="meter__head">
          <span className="meter__value">
            <span className="ltr num">{v(todayMl)}</span> {unit} {he.home.guide.today}
          </span>
          <span className="text-sm text-muted">
            {he.home.guide.recommended} <span className="ltr num">{rangeText}</span> {unit}
          </span>
        </div>
        <div
          className="meter__track"
          role="meter"
          aria-label={he.home.guide.ariaMeter}
          aria-valuemin={0}
          aria-valuemax={Math.round(scale)}
          aria-valuenow={Math.round(todayMl)}
          aria-valuetext={`${v(todayMl)} ${unit}; ${he.home.guide.recommended} ${rangeText} ${unit}`}
        >
          <span
            className="meter__range"
            style={
              {
                '--from': pct((range.minMl / scale) * 100),
                '--to': pct((range.maxMl / scale) * 100),
              } as CSSProperties
            }
          />
          <span
            className="meter__fill"
            style={{ '--value': pct((todayMl / scale) * 100) } as CSSProperties}
          />
        </div>
      </div>
      <p className="text-sm">
        {he.home.guide.perFeed(`${v(guide.perFeedMl)} ${unit}`, guide.feedsPerDay)}
      </p>
      <p className="disclaimer">
        <Info aria-hidden="true" />
        <span>{he.home.guide.disclaimer}</span>
      </p>
    </section>
  );
}
