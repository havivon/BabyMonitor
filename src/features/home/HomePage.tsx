import {
  Apple,
  ArrowLeftRight,
  ChevronLeft,
  Clock,
  Heart,
  Milk,
  Pause,
  Repeat2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../../app/AppHeader';
import { BabySwitcher } from '../../app/BabySwitcher';
import { formatClock, MS_PER_DAY, toDateKey } from '../../domain/dates';
import {
  breastDurations,
  dailyAggregates,
  entryTime,
  lastFeed,
  suggestNextSide,
  todayTotals,
} from '../../domain/feeding';
import { currentSide, isPaused, timerElapsed, timerStartedAt } from '../../domain/timer';
import type { ActiveTimer, BottleEntry, FeedingEntry, SolidEntry } from '../../domain/types';
import { formatDuration, formatHoursMinutes, formatTimer } from '../../domain/units';
import { useNow } from '../../hooks/useNow';
import {
  dayMonth,
  relativeDayName,
  roundMinutes,
  sinceParts,
  volumeNumber,
  volumeUnitLabel,
} from '../../i18n/format';
import { CONTENT_LABEL, he, SIDE_LABEL, TYPE_LABEL } from '../../i18n/he';
import { useActiveEntries, useActiveTimer, useSettings } from '../../store';
import { Parts } from '../../components/Parts';
import { useFeedingSheets } from '../feeding/sheetsContext';
import { TimelineItem } from '../feeding/TimelineItem';
import { MilkGuideline } from './MilkGuideline';

const TYPE_ICON = { breast: Heart, bottle: Milk, solid: Apple } as const;

/** Home / dashboard (DESIGN §7.2). */
export function HomePage() {
  const entries = useActiveEntries();
  const timer = useActiveTimer();
  const { volumeUnit } = useSettings();
  const sheets = useFeedingSheets();
  const now = useNow(30_000);

  const last = lastFeed(entries);
  const suggestion = suggestNextSide(entries);
  const recent = entries.slice(0, 3); // already newest first

  return (
    <>
      <AppHeader start={<BabySwitcher />} />
      <main className="page">
        <h1 className="visually-hidden">{he.tab.home}</h1>
        {timer ? (
          <ActiveFeedCard timer={timer} onOpen={() => sheets.open({ kind: 'timer' })} />
        ) : (
          <SinceCard
            last={last}
            nextSide={suggestion ? SIDE_LABEL[suggestion.side] : null}
            now={now}
          />
        )}

        <section className="section" aria-labelledby="home-add">
          <h2 className="visually-hidden" id="home-add">
            {he.home.addHeading}
          </h2>
          <QuickAdd
            entries={entries}
            timer={timer}
            nextSide={suggestion ? SIDE_LABEL[suggestion.side] : null}
            now={now}
            onOpen={(kind) => sheets.open({ kind })}
          />
        </section>

        {entries.length > 0 && <TodaySection entries={entries} now={now} />}

        <MilkGuideline entries={entries} now={now} />

        {recent.length > 0 && (
          <section className="section" aria-labelledby="home-recent">
            <div className="section__header">
              <h2 className="section__title" id="home-recent">
                {he.home.recent}
              </h2>
              <Link className="section__action" to="/history">
                {he.home.toHistory}
                <ChevronLeft aria-hidden="true" />
              </Link>
            </div>
            <ol className="timeline__list" role="list">
              {recent.map((e) => (
                <li key={e.id}>
                  <TimelineItem
                    entry={e}
                    unit={volumeUnit}
                    onOpen={(entry) => sheets.open({ kind: 'edit', entry })}
                  />
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------------------- hero

function LastFeedMeta({ entry }: { entry: FeedingEntry }) {
  const { volumeUnit } = useSettings();
  const Icon = TYPE_ICON[entry.type];
  const items: ReactNode[] = [];
  if (entry.type === 'bottle') {
    items.push(
      <>
        <span className="ltr num">{volumeNumber(entry.amountMl, volumeUnit)}</span>{' '}
        {volumeUnitLabel(volumeUnit)}
      </>,
      CONTENT_LABEL[entry.content],
    );
  } else if (entry.type === 'breast') {
    items.push(formatDuration(breastDurations(entry).total));
  }
  items.push(<span className="ltr num">{formatClock(entryTime(entry))}</span>);
  return (
    <div className="since__meta">
      <span className={`badge badge--${entry.type}`}>
        <Icon aria-hidden="true" />
        {TYPE_LABEL[entry.type]}
      </span>
      <span>
        <Parts items={items} />
      </span>
    </div>
  );
}

/** Hero while the active baby is breastfeeding: live elapsed + side; tapping opens the timer. */
function ActiveFeedCard({ timer, onOpen }: { timer: ActiveTimer; onOpen: () => void }) {
  const now = useNow(1000);
  const paused = isPaused(timer);
  const side = SIDE_LABEL[currentSide(timer) ?? 'right'];
  const label = paused ? he.home.active.paused : he.home.active.title;
  return (
    <button
      type="button"
      className="card since card--interactive"
      aria-label={`${label} · ${side} — ${he.banner.open}`}
      onClick={onOpen}
    >
      <span className="since__top">
        <span className="since__label">{label}</span>
        {paused ? (
          <span className="badge badge--lg">
            <Pause aria-hidden="true" />
            {he.timer.paused}
          </span>
        ) : (
          <span className="badge badge--breast badge--lg badge--live">
            <span className="badge__dot" />
            {he.home.active.live}
          </span>
        )}
      </span>
      <span className="since__value">
        <span className="since__part">
          <span className="ltr num">{formatTimer(timerElapsed(timer, now).total)}</span>
        </span>
      </span>
      <span className="since__meta">
        <span className="badge badge--breast">
          <Heart aria-hidden="true" />
          {TYPE_LABEL.breast}
        </span>
        <span>
          <Parts
            items={[
              he.home.active.side(side),
              <>
                {he.banner.meta}
                <span className="ltr num">{formatClock(timerStartedAt(timer) ?? now)}</span>
              </>,
            ]}
          />
        </span>
      </span>
    </button>
  );
}

function SinceCard({
  last,
  nextSide,
  now,
}: {
  last: FeedingEntry | null;
  nextSide: string | null;
  now: number;
}) {
  if (!last) {
    return (
      <section className="card since">
        <div className="empty empty--compact">
          <span className="empty__icon" aria-hidden="true">
            <Clock />
          </span>
          <h2 className="empty__title">{he.home.empty.title}</h2>
          <p className="empty__text">{he.home.empty.text}</p>
        </div>
      </section>
    );
  }
  const parts = sinceParts(now - entryTime(last));
  return (
    <section className="card since" aria-labelledby="since-label">
      <div className="since__top">
        <h2 className="since__label" id="since-label">
          {he.home.since}
        </h2>
        {nextSide && (
          <span className="badge badge--accent badge--lg">
            <ArrowLeftRight aria-hidden="true" />
            {he.home.nextSide(nextSide)}
          </span>
        )}
      </div>
      <p className="since__value">
        {parts === 'now' ? (
          <span className="since__part">{he.common.now}</span>
        ) : (
          parts.map((p) => (
            <span key={p.unit} className="since__part">
              {p.value && <span className="num">{p.value}</span>}
              <span className="since__unit">{p.unit}</span>
            </span>
          ))
        )}
      </p>
      <LastFeedMeta entry={last} />
    </section>
  );
}

// ---------------------------------------------------------------- quick add

function ActiveTimerMeta({ timer }: { timer: ActiveTimer }) {
  const now = useNow(1000);
  return (
    <>
      {he.home.tile.breastActive}
      <span className="ltr num">{formatTimer(timerElapsed(timer, now).total)}</span>
    </>
  );
}

function lastSolidLabel(entry: SolidEntry, now: number): ReactNode {
  const key = toDateKey(entry.at);
  if (key === toDateKey(now)) return <span className="ltr num">{formatClock(entry.at)}</span>;
  return relativeDayName(key, now) ?? dayMonth(new Date(entry.at), now);
}

function QuickAdd({
  entries,
  timer,
  nextSide,
  now,
  onOpen,
}: {
  entries: FeedingEntry[];
  timer: ActiveTimer | null;
  nextSide: string | null;
  now: number;
  onOpen: (kind: 'timer' | 'bottle' | 'solid') => void;
}) {
  const { volumeUnit } = useSettings();
  const lastBottle = lastFeed(entries, ['bottle']) as BottleEntry | null;
  const lastSolid = lastFeed(entries, ['solid']) as SolidEntry | null;

  return (
    <div className="tile-grid">
      <button
        type="button"
        className={`tile tile--breast${timer ? ' tile--active' : ''}`}
        aria-label={timer ? he.home.tile.breastActiveAria : he.home.tile.breastAria}
        onClick={() => onOpen('timer')}
      >
        <span className="tile__icon" aria-hidden="true">
          <Heart />
        </span>
        <span className="tile__label">{TYPE_LABEL.breast}</span>
        <span className="tile__meta">
          {timer ? (
            <ActiveTimerMeta timer={timer} />
          ) : nextSide ? (
            he.home.tile.breastMeta(nextSide)
          ) : (
            he.home.tile.breastEmpty
          )}
        </span>
      </button>
      <button
        type="button"
        className="tile tile--bottle"
        aria-label={he.home.tile.bottleAria}
        onClick={() => onOpen('bottle')}
      >
        <span className="tile__icon" aria-hidden="true">
          <Milk />
        </span>
        <span className="tile__label">{TYPE_LABEL.bottle}</span>
        <span className="tile__meta">
          {lastBottle ? (
            <>
              {he.home.tile.last}
              <span className="nowrap">
                <span className="ltr num">{volumeNumber(lastBottle.amountMl, volumeUnit)}</span>{' '}
                {volumeUnitLabel(volumeUnit)}
              </span>
            </>
          ) : (
            he.home.tile.bottleEmpty
          )}
        </span>
      </button>
      <button
        type="button"
        className="tile tile--solid"
        aria-label={he.home.tile.solidAria}
        onClick={() => onOpen('solid')}
      >
        <span className="tile__icon" aria-hidden="true">
          <Apple />
        </span>
        <span className="tile__label">{TYPE_LABEL.solid}</span>
        <span className="tile__meta">
          {lastSolid ? (
            <>
              {he.home.tile.last}
              {lastSolidLabel(lastSolid, now)}
            </>
          ) : (
            he.home.tile.solidEmpty
          )}
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- today

function TodaySection({ entries, now }: { entries: FeedingEntry[]; now: number }) {
  const { volumeUnit } = useSettings();
  const today = todayTotals(entries, now);
  const yesterday = todayTotals(entries, now - MS_PER_DAY);
  const interval = dailyAggregates(entries, 1, now)[0]?.avgIntervalMs ?? null;
  const dash = '—';

  return (
    <section className="section" aria-labelledby="home-today">
      <div className="section__header">
        <h2 className="section__title" id="home-today">
          {he.home.today}
        </h2>
        <Link className="section__action" to="/stats">
          {he.home.toStats}
          <ChevronLeft aria-hidden="true" />
        </Link>
      </div>
      <div className="stat-grid">
        <div className="stat stat--primary">
          <span className="stat__label">
            <Clock aria-hidden="true" />
            {he.home.stat.feeds}
          </span>
          <span className="stat__value">{today.feedCount}</span>
          <span className="stat__sub">{he.home.stat.yesterday(yesterday.feedCount)}</span>
        </div>
        <div className="stat stat--bottle">
          <span className="stat__label">
            <Milk aria-hidden="true" />
            {he.home.stat.bottle}
          </span>
          <span className="stat__value">
            {today.bottleCount ? (
              <>
                {volumeNumber(today.bottleMl.total, volumeUnit)}
                <span className="stat__unit">{volumeUnitLabel(volumeUnit)}</span>
              </>
            ) : (
              dash
            )}
          </span>
          <span className="stat__sub">{he.home.stat.bottles(today.bottleCount)}</span>
        </div>
        <div className="stat stat--breast">
          <span className="stat__label">
            <Heart aria-hidden="true" />
            {he.home.stat.breast}
          </span>
          <span className="stat__value">
            {today.breastCount ? (
              <>
                {roundMinutes(today.breastMs.total)}
                <span className="stat__unit">{he.units.min}</span>
              </>
            ) : (
              dash
            )}
          </span>
          <span className="stat__sub">{he.home.stat.breastfeeds(today.breastCount)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">
            <Repeat2 aria-hidden="true" />
            {he.home.stat.interval}
          </span>
          <span className="stat__value">
            {interval !== null ? (
              <>
                <span className="ltr">{formatHoursMinutes(interval)}</span>
                <span className="stat__unit">{he.units.hour}</span>
              </>
            ) : (
              dash
            )}
          </span>
          <span className="stat__sub">{he.home.stat.betweenFeeds}</span>
        </div>
      </div>
    </section>
  );
}
