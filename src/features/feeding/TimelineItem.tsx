import { Apple, Droplet, Heart, Milk } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { formatClock } from '../../domain/dates';
import { breastDurations, entryTime } from '../../domain/feeding';
import type { FeedingEntry, VolumeUnit } from '../../domain/types';
import { formatDuration } from '../../domain/units';
import { volumeNumber, volumeUnitLabel } from '../../i18n/format';
import { CONTENT_LABEL, he, TYPE_LABEL } from '../../i18n/he';
import { breastMeta } from './breastEntry';

export interface TimelineItemProps {
  entry: FeedingEntry;
  unit: VolumeUnit;
  onOpen: (entry: FeedingEntry) => void;
}

/** One `.timeline-item` button (opens the entry's edit sheet) — DESIGN §6.14. */
export const TimelineItem = memo(function TimelineItem({ entry, unit, onOpen }: TimelineItemProps) {
  let icon = <Heart aria-hidden="true" />;
  let meta: ReactNode = null;
  let value: ReactNode = null;
  const notes: string[] = [];
  let isNew = false;

  switch (entry.type) {
    case 'breast':
      meta = breastMeta(entry);
      value = formatDuration(breastDurations(entry).total);
      break;
    case 'bottle':
      icon =
        entry.content === 'breastmilk' ? (
          <Droplet aria-hidden="true" />
        ) : (
          <Milk aria-hidden="true" />
        );
      meta = CONTENT_LABEL[entry.content];
      value = (
        <>
          <span className="num">{volumeNumber(entry.amountMl, unit)}</span> {volumeUnitLabel(unit)}
        </>
      );
      break;
    case 'solid': {
      icon = <Apple aria-hidden="true" />;
      isNew = Boolean(entry.isNewFood);
      meta = [entry.foods.join(', '), entry.amount].filter(Boolean).join(' · ');
      const reaction = entry.reaction?.trim();
      if (reaction && reaction !== he.solid.reactionNone) notes.push(reaction);
      break;
    }
  }
  if (entry.note) notes.push(entry.note);

  return (
    <button
      type="button"
      className={`timeline-item timeline-item--${entry.type}`}
      onClick={() => onOpen(entry)}
    >
      <span className="timeline-item__time">{formatClock(entryTime(entry))}</span>
      <span className="timeline-item__icon">{icon}</span>
      <span className="timeline-item__body">
        <span className="timeline-item__title">
          {TYPE_LABEL[entry.type]}
          {isNew && <span className="badge badge--accent">{he.solid.newBadge}</span>}
        </span>
        {meta && <span className="timeline-item__meta">{meta}</span>}
        {notes.map((n, i) => (
          <span key={i} className="timeline-item__note">
            {n}
          </span>
        ))}
      </span>
      <span className="timeline-item__value">{value}</span>
    </button>
  );
});
