import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { GrowthInsight } from '../../domain/growth/insights';
import { insightCopy, type BannerTone } from './insightCopy';
import { IsolatedText } from './ui/IsolatedText';

const ICON: Record<BannerTone, typeof Info> = {
  danger: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
};

/**
 * Growth flags as `.banner`s (most severe first, as returned by `growthInsights`). Numbers and
 * ranges are bidi-isolated so "100–150" never renders reversed in RTL (QA BUG-009).
 */
export function InsightBanners({ insights }: { insights: readonly GrowthInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="stack stack--3" aria-label="התראות גדילה" role="region">
      {insights.map((insight) => {
        const copy = insightCopy(insight);
        const Icon = ICON[copy.tone];
        return (
          <div
            key={`${insight.kind}-${'indicator' in insight ? insight.indicator : ''}`}
            className={`banner banner--${copy.tone}`}
          >
            <span className="banner__icon">
              <Icon aria-hidden />
            </span>
            <div className="banner__body">
              <p className="banner__title">
                <IsolatedText text={copy.title} />
              </p>
              <p className="banner__text">
                <IsolatedText text={copy.text} />
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
