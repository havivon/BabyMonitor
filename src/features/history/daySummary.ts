import { totalsOf } from '../../domain/feeding';
import type { FeedingEntry, VolumeUnit } from '../../domain/types';
import { roundMinutes, volumeNumber, volumeUnitLabel } from '../../i18n/format';
import { he } from '../../i18n/he';

/**
 * Day header summary: "5 האכלות · 360 מ״ל · 42 ד׳ הנקה" — zero parts omitted (DESIGN §7.6).
 * A day with only solids (e.g. the solids filter) reads "מוצקים 2 פעמים".
 */
export function daySummary(entries: readonly FeedingEntry[], unit: VolumeUnit): string {
  const t = totalsOf(entries);
  const parts: string[] = [];
  if (t.feedCount) parts.push(he.history.feeds(t.feedCount));
  if (t.bottleMl.total) {
    parts.push(`${volumeNumber(t.bottleMl.total, unit)} ${volumeUnitLabel(unit)}`);
  }
  const breastMin = roundMinutes(t.breastMs.total);
  if (breastMin) parts.push(`${breastMin} ${he.units.min} ${he.history.breastMin}`);
  if (!t.feedCount && t.solidCount) parts.push(he.history.solids(t.solidCount));
  return parts.join(' · ');
}
