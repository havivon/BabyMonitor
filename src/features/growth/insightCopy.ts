/**
 * Hebrew copy for `growthInsights()` flags. Tone is warm and non-alarming; every flag that may need
 * attention ends with a suggestion to consult (DESIGN §7.7, §8.2 flag.* strings).
 */
import type { GrowthInsight, InsightSeverity } from '../../domain/growth/insights';
import { formatPercentile } from '../../domain/growth/percentiles';
import type { GrowthIndicator } from '../../domain/growth/who';
import { formatNumber } from '../../domain/units';
import { formatDateMedium } from './ui/format';

export type BannerTone = 'danger' | 'warning' | 'info' | 'success';

export interface InsightCopy {
  tone: BannerTone;
  title: string;
  text: string;
}

const SEE_DOCTOR = 'כדאי להתייעץ עם רופא/ת הילדים.';
const SEE_NURSE_OR_DOCTOR = 'כדאי להתייעץ עם אחות טיפת חלב או עם רופא/ת הילדים.';

const TONE: Record<InsightSeverity, BannerTone> = {
  alert: 'danger',
  warn: 'warning',
  info: 'info',
};

/** Subject phrase per metric ("המשקל", "האורך", "היקף הראש") — all grammatically masculine. */
const SUBJECT: Record<GrowthIndicator, string> = {
  weight: 'המשקל',
  length: 'האורך',
  head: 'היקף הראש',
};

const pct = (value: number): string => `${formatNumber(Math.abs(value), 0, 1)}%`;

function linesPhrase(n: number): string {
  return n === 2 ? 'בשני קווי אחוזון' : `ב-${n} קווי אחוזון`;
}

export function insightCopy(insight: GrowthInsight): InsightCopy {
  const tone = TONE[insight.severity];
  switch (insight.kind) {
    case 'birthWeightLoss':
      return {
        tone,
        title: `ירידה של ${pct(insight.pct)} ממשקל הלידה`,
        text:
          insight.severity === 'alert'
            ? `ירידה של יותר מ-10% בימים הראשונים מצדיקה בדיקה. ${SEE_DOCTOR}`
            : insight.severity === 'warn'
              ? `ירידה של 7%–10% בימים הראשונים כדאי לעקוב אחריה מקרוב. ${SEE_NURSE_OR_DOCTOR}`
              : 'ירידה של עד כ-7% בימים הראשונים נפוצה ותקינה. רוב התינוקות חוזרים למשקל הלידה עד גיל שבועיים.',
      };
    case 'birthWeightRegained':
      return insight.onTime
        ? {
            tone: 'success',
            title: 'משקל הלידה חזר',
            text: `המשקל חזר למשקל הלידה בגיל ${insight.ageDays} ימים — כצפוי בשבועיים הראשונים.`,
          }
        : {
            tone: 'info',
            title: 'משקל הלידה חזר',
            text: `המשקל חזר למשקל הלידה בגיל ${insight.ageDays} ימים, מעט אחרי השבועיים הראשונים. אפשר לשתף בביקור הבא בטיפת חלב.`,
          };
    case 'birthWeightNotRegained':
      return {
        tone,
        title: 'משקל הלידה עוד לא חזר',
        text: `המשקל האחרון נמוך ב-${pct(insight.pct)} ממשקל הלידה, ובדרך כלל הוא חוזר עד גיל שבועיים. ${SEE_DOCTOR}`,
      };
    case 'lowPercentile':
      return {
        tone,
        title: `${SUBJECT[insight.indicator]} מתחת לאחוזון 3`,
        text: `לפי המדידה האחרונה (אחוזון ${formatPercentile(insight.percentile)}). יש תינוקות שפשוט קטנים יותר, ובכל זאת ${SEE_DOCTOR}`,
      };
    case 'highPercentile':
      return {
        tone,
        title: `${SUBJECT[insight.indicator]} מעל אחוזון 97`,
        text: `לפי המדידה האחרונה (אחוזון ${formatPercentile(insight.percentile)}). יש תינוקות שפשוט גדולים יותר, ובכל זאת ${SEE_DOCTOR}`,
      };
    case 'percentileCrossingDown':
      return {
        tone,
        title: `${SUBJECT[insight.indicator]} ירד ${linesPhrase(insight.linesCrossed)}`,
        text: `מאחוזון ${formatPercentile(insight.fromPercentile)} ב-${formatDateMedium(insight.fromDate)} לאחוזון ${formatPercentile(insight.toPercentile)} כעת. ${SEE_DOCTOR}`,
      };
    case 'lowWeightGain':
      return {
        tone,
        title: 'עלייה איטית במשקל',
        text: `בתקופה האחרונה כ-${formatNumber(Math.max(0, Math.round(insight.gPerWeek)))} גר׳ לשבוע, והטווח הנפוץ בגיל הזה הוא ${insight.minGPerWeek}–${insight.maxGPerWeek} גר׳ לשבוע. ${SEE_NURSE_OR_DOCTOR}`,
      };
  }
}
