import { Apple, Calendar, Heart, History as HistoryIcon, Milk } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { AppHeader } from '../../app/AppHeader';
import { useToast } from '../../components/toast';
import { RadioGroup, type RadioOption } from '../../components/RadioGroup';
import { toDateKey } from '../../domain/dates';
import { groupByDay, type DayGroup } from '../../domain/feeding';
import type { EpochMs, FeedingEntry, FeedingType, VolumeUnit } from '../../domain/types';
import { useNow } from '../../hooks/useNow';
import { Parts } from '../../components/Parts';
import { dayTitleParts } from '../../i18n/format';
import { he, TYPE_LABEL } from '../../i18n/he';
import { useActiveEntries, useSettings } from '../../store';
import { useFeedingSheets } from '../feeding/sheetsContext';
import { TimelineItem } from '../feeding/TimelineItem';
import { daySummary } from './daySummary';

/** Days rendered per batch; a year of data (~4000 entries) never renders all at once. */
const DAYS_PER_PAGE = 14;

type Filter = 'all' | FeedingType;

const FILTER_OPTIONS: readonly RadioOption<Filter>[] = [
  { value: 'all', label: he.history.all },
  ...(['breast', 'bottle', 'solid'] as const).map((type) => ({
    value: type,
    className: `chip--${type}`,
    ariaLabel: TYPE_LABEL[type],
    label: (
      <>
        <span className="chip__dot" aria-hidden="true" />
        {TYPE_LABEL[type]}
      </>
    ),
  })),
];

const TYPE_ICONS = { breast: Heart, bottle: Milk, solid: Apple } as const;
function FilterIcon({ type }: { type: FeedingType }) {
  const Icon = TYPE_ICONS[type];
  return <Icon />;
}

const Day = memo(function Day({
  group,
  now,
  unit,
  onOpen,
}: {
  group: DayGroup;
  now: EpochMs;
  unit: VolumeUnit;
  onOpen: (entry: FeedingEntry) => void;
}) {
  const headingId = `day-${group.date}-title`;
  const { relative, date } = dayTitleParts(group.date, now);
  const title = <Parts items={relative ? [relative, date] : [date]} />;
  return (
    <li className="timeline__day" id={`day-${group.date}`} aria-labelledby={headingId}>
      <h2 className="day-header" id={headingId}>
        <span className="day-header__title">{title}</span>
        <span className="day-header__summary">
          <Parts items={daySummary(group.entries, unit)} />
        </span>
      </h2>
      <ol className="timeline__list" role="list">
        {group.entries.map((e) => (
          <li key={e.id}>
            <TimelineItem entry={e} unit={unit} onOpen={onOpen} />
          </li>
        ))}
      </ol>
    </li>
  );
});

/** History / timeline (DESIGN §7.6): grouped by day, filterable, rendered incrementally. */
export function HistoryPage() {
  const entries = useActiveEntries();
  const { volumeUnit } = useSettings();
  const sheets = useFeedingSheets();
  const toast = useToast();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>('all');
  const [dayCount, setDayCount] = useState(DAYS_PER_PAGE);
  const moreRef = useRef<HTMLButtonElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.type === filter)),
    [entries, filter],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const visible = groups.slice(0, dayCount);
  const hasMore = groups.length > dayCount;

  const onOpen = useCallback(
    (entry: FeedingEntry) => sheets.open({ kind: 'edit', entry }),
    [sheets],
  );
  const showMore = useCallback(() => setDayCount((c) => c + DAYS_PER_PAGE), []);
  // Infinite scroll: load the next batch when the "more" button approaches the viewport.
  useEffect(() => {
    const el = moreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) showMore();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, dayCount, showMore]);

  const jumpTo = (key: string): void => {
    // Newest first: the first day on or before the chosen date (else the oldest day).
    const index = groups.findIndex((g) => g.date <= key);
    const target = index >= 0 ? index : groups.length - 1;
    const group = groups[target];
    if (!group) return;
    if (group.date !== key) toast.show({ text: he.history.jumpNone });
    // Render up to the target day synchronously, then scroll to it.
    flushSync(() => setDayCount((c) => Math.max(c, target + 1)));
    const el = document.getElementById(`day-${group.date}`);
    el?.scrollIntoView({ block: 'start' });
    el?.querySelector<HTMLElement>('.timeline-item')?.focus({ preventScroll: true });
  };

  const filterName = filter === 'all' ? '' : TYPE_LABEL[filter];

  return (
    <>
      <AppHeader
        title={he.history.title}
        actions={
          entries.length > 0 && (
            <>
              <button
                type="button"
                className="icon-btn"
                aria-label={he.history.jump}
                onClick={() => {
                  const input = dateInput.current;
                  if (!input) return;
                  try {
                    input.showPicker();
                  } catch {
                    input.focus();
                  }
                }}
              >
                <Calendar aria-hidden="true" />
              </button>
              <input
                ref={dateInput}
                type="date"
                className="visually-hidden"
                tabIndex={-1}
                aria-label={he.history.jump}
                max={toDateKey(now)}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  if (v) jumpTo(v);
                }}
              />
            </>
          )
        }
      />
      <main className="page" style={{ gap: 'var(--space-2)' }}>
        {entries.length === 0 ? (
          <div className="empty">
            <span className="empty__icon" aria-hidden="true">
              <HistoryIcon />
            </span>
            <h2 className="empty__title">{he.history.emptyTitle}</h2>
            <p className="empty__text">{he.history.emptyText}</p>
          </div>
        ) : (
          <>
            <RadioGroup
              className="chip-row"
              optionClassName="chip"
              options={FILTER_OPTIONS}
              value={filter}
              selectOnFocus={false}
              ariaLabel={he.history.filter}
              onChange={(v) => {
                setFilter(v ?? 'all');
                setDayCount(DAYS_PER_PAGE);
              }}
            />
            {groups.length === 0 ? (
              <div
                className="empty"
                style={
                  filter === 'all'
                    ? undefined
                    : ({
                        '--empty-color': `var(--color-${filter})`,
                        '--empty-soft': `var(--color-${filter}-soft)`,
                      } as CSSProperties)
                }
              >
                <span className="empty__icon" aria-hidden="true">
                  {filter === 'all' ? <HistoryIcon /> : <FilterIcon type={filter} />}
                </span>
                <h2 className="empty__title">{he.history.emptyFilter(filterName)}</h2>
                <p className="empty__text">{he.history.emptyFilterText}</p>
                <button
                  type="button"
                  className="btn btn--ghost empty__action"
                  onClick={() => setFilter('all')}
                >
                  {he.history.showAll}
                </button>
              </div>
            ) : (
              <ol className="timeline" role="list">
                {visible.map((g) => (
                  <Day key={g.date} group={g} now={now} unit={volumeUnit} onOpen={onOpen} />
                ))}
              </ol>
            )}
            {hasMore && (
              <button
                ref={moreRef}
                type="button"
                className="btn btn--outline btn--block"
                onClick={showMore}
              >
                {he.history.more}
              </button>
            )}
          </>
        )}
      </main>
    </>
  );
}
