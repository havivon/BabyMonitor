import { Heart, Pause, Play } from 'lucide-react';
import { formatClock } from '../domain/dates';
import { currentSide, isPaused, timerElapsed, timerStartedAt } from '../domain/timer';
import type { ActiveTimer } from '../domain/types';
import { formatTimer } from '../domain/units';
import { useOtherStarter } from '../features/account/useOtherStarter';
import { useNow } from '../hooks/useNow';
import { he, SIDE_LABEL } from '../i18n/he';
import { appStore } from '../store';

export interface TimerBannerProps {
  timer: ActiveTimer;
  onOpen: () => void;
  /** Set when the timer belongs to a baby other than the active one (shown in the title). */
  babyName?: string;
}

/**
 * Persistent active-timer banner above the tab bar (DESIGN §6.18). `role="status"` announces
 * state changes (side / paused); the ticking time itself is hidden from the live region.
 */
export function TimerBanner({ timer, onOpen, babyName }: TimerBannerProps) {
  const now = useNow(1000);
  const starter = useOtherStarter(timer.babyId);
  const paused = isPaused(timer);
  const side = SIDE_LABEL[currentSide(timer) ?? 'right'];
  const startedAt = timerStartedAt(timer) ?? now;
  const { total } = timerElapsed(timer, now);
  const toggle = (): void => {
    const s = appStore.getState();
    if (paused) s.resumeTimer(timer.babyId);
    else s.pauseTimer(timer.babyId);
  };

  return (
    <div className={`timer-banner${paused ? ' timer-banner--paused' : ''}`} role="status">
      <button
        type="button"
        className="timer-banner__main"
        aria-label={he.banner.open}
        onClick={onOpen}
      >
        <span className="timer-banner__icon" aria-hidden="true">
          <Heart />
        </span>
        <span className="timer-banner__text">
          <span className="timer-banner__title">
            {babyName && `${babyName} · `}
            {paused ? he.banner.titlePaused(side) : he.banner.title(side)}
          </span>
          <span className="timer-banner__meta nowrap">
            {he.banner.meta}
            <span className="ltr num">{formatClock(startedAt)}</span>
            {starter && ` · ${starter}`}
          </span>
        </span>
        <span className="timer-banner__time" aria-hidden="true">
          {formatTimer(total)}
        </span>
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={paused ? he.banner.resume : he.banner.pause}
        onClick={toggle}
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>
    </div>
  );
}
