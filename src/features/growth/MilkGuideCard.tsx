import { Info } from 'lucide-react';
import type { VolumeUnit } from '../../domain/types';
import type { MilkGuide } from './milkModel';
import { volumeQuantity } from './ui/format';
import { Qty } from './ui/Qty';

/** Expected daily bottle volume (0–6 months) — labelled as a general guideline. */
export function MilkGuideCard({ guide, volumeUnit }: { guide: MilkGuide; volumeUnit: VolumeUnit }) {
  const min = volumeQuantity(guide.range.minMl, volumeUnit);
  const max = volumeQuantity(guide.range.maxMl, volumeUnit);
  return (
    <section className="card" aria-labelledby="milk-guide-title">
      <div className="card__header">
        <div>
          <h2 className="card__title" id="milk-guide-title">
            כמות חלב יומית משוערת
          </h2>
          <p className="card__subtitle">לתינוקות הניזונים מבקבוק, לפי המשקל האחרון</p>
        </div>
        <span className="badge">הנחיה כללית</span>
      </div>
      <div className="kv" style={{ '--kv-cols': 2 } as React.CSSProperties}>
        <div className="kv__item">
          <span className="kv__label">טווח ליום</span>
          <span className="kv__value">
            <span className="ltr num">
              {min.number}–{max.number}
            </span>{' '}
            {max.unit}
          </span>
        </div>
        <div className="kv__item">
          <span className="kv__label">להאכלה</span>
          <span className="kv__value">
            כ-
            <Qty q={volumeQuantity(guide.perFeedMl, volumeUnit)} />
          </span>
        </div>
      </div>
      <p className="text-sm text-muted">
        לפי <span className="num">{guide.feedsPerDay}</span> האכלות ביום
        {guide.feedsSource === 'history' ? ' (ממוצע השבוע האחרון)' : ' (מקובל בגיל הזה)'}
        {guide.range.capped && ' · בדרך כלל לא יותר מכ-1,000 מ״ל ביום'}
      </p>
      <p className="disclaimer">
        <Info aria-hidden="true" />
        <span>
          לפי כ-150 מ״ל לק״ג ליום (טווח <span className="ltr">120–180</span>). אינו תחליף לייעוץ
          רפואי.
        </span>
      </p>
    </section>
  );
}
