import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Clock,
  Heart,
  Pause,
  Pencil,
  Play,
  Sparkles,
  Timer as TimerIcon,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useId, useState, type SyntheticEvent, type ReactNode } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field } from '../../components/Field';
import { describedBy } from '../../components/dom';
import { DateTimePicker } from '../../components/Pickers';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { formatClock, MS_PER_MINUTE } from '../../domain/dates';
import { breastDurations, lastFeed, lastSideOf, suggestNextSide } from '../../domain/feeding';
import {
  currentSide,
  isPaused,
  isTimerStale,
  timerElapsed,
  timerStartedAt,
} from '../../domain/timer';
import type { ActiveTimer, BreastEntry, EpochMs, Side } from '../../domain/types';
import { formatDuration, formatTimer } from '../../domain/units';
import { useAnnouncer } from '../../hooks/useAnnouncer';
import { useNow } from '../../hooks/useNow';
import { roundMinutes } from '../../i18n/format';
import { he, SIDE_LABEL } from '../../i18n/he';
import { appStore, useActiveBaby, useActiveEntries, useActiveTimer } from '../../store';
import { segmentsFromMinutes } from './breastEntry';
import { BreastFields } from './BreastFields';
import { useBreastFormState, validateBreastForm } from './breastFormState';
import { TimeField } from './TimeField';
import { resolveTime, type TimeChoice } from './timeChoice';
import { useEntryActions } from './useEntryActions';

/** Show the "still running?" banner after this much suckling time. */
const LONG_FEED_MS = 90 * MS_PER_MINUTE;
const SIDES: readonly Side[] = ['right', 'left']; // DOM order: ימין first → physically right in RTL

type Mode = 'timer' | 'manual' | 'editStart';
type Confirm = null | 'cancel' | 'short';

/** "8 דקות ו-10 שניות" — for side-button labels (screen readers). */
function spokenDuration(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? 'שעה' : `${h} שעות`);
  if (m) parts.push(m === 1 ? 'דקה' : `${m} דקות`);
  if (s || parts.length === 0) parts.push(s === 1 ? 'שנייה' : `${s} שניות`);
  return parts.join(' ו-');
}

/** Latest instant recorded in a timer (the end can never be before it). */
function lastRecorded(timer: ActiveTimer): EpochMs {
  return timer.segments.reduce((t, s) => Math.max(t, s.startedAt, s.endedAt ?? s.startedAt), 0);
}

export interface TimerSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Breastfeeding timer (DESIGN §6.17 / §7.3) as a full-height sheet. All timer state lives in the
 * store as timestamps (survives reloads); this component only derives the display from `now`.
 * Includes manual entry, start-time correction, the 90-minute reminder and the forgotten-timer
 * (> 6 h) end-time prompt.
 */
export function TimerSheet({ open, onClose }: TimerSheetProps) {
  const baby = useActiveBaby();
  const timer = useActiveTimer();
  const entries = useActiveEntries();
  const toast = useToast();
  const actions = useEntryActions();
  const now = useNow(1000);
  const uid = useId();
  const [message, announce] = useAnnouncer();
  const [mode, setMode] = useState<Mode>('timer');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [submitted, setSubmitted] = useState(false);
  // A forgotten timer is detected when the sheet OPENS (not while the parent is watching it).
  const [stale] = useState(() =>
    timer ? !isPaused(timer) && isTimerStale(timer, Date.now()) : false,
  );

  const suggestion = suggestNextSide(entries);
  const previous = lastFeed(entries, ['breast']) as BreastEntry | null;
  const babyId = baby?.id ?? '';
  const store = appStore.getState;

  // ---- manual entry form
  const manual = useBreastFormState(() => ({
    time: { kind: 'ago', minutes: 30 },
    minutes: { right: 0, left: 0 },
    note: '',
  }));
  // ---- start-time correction form
  const [startChoice, setStartChoice] = useState<TimeChoice>(() => ({
    kind: 'at',
    at: timer ? (timerStartedAt(timer) ?? Date.now()) : Date.now(),
  }));
  // ---- stale timer: real end time
  const [staleEnd, setStaleEnd] = useState<EpochMs>(() =>
    timer ? Math.min(Date.now(), lastRecorded(timer) + 20 * MS_PER_MINUTE) : Date.now(),
  );

  if (!baby) return null;

  const elapsed = timer ? timerElapsed(timer, now) : null;
  const paused = timer ? isPaused(timer) : false;
  const side = timer ? currentSide(timer) : null;
  const startedAt = timer ? timerStartedAt(timer) : null;

  // ---------------------------------------------------------------- actions

  const tapSide = (target: Side): void => {
    if (!timer) {
      store().startTimer(babyId, target);
      announce(he.sr.started(SIDE_LABEL[target]));
      return;
    }
    if (paused && target === side) {
      store().resumeTimer(babyId);
      announce(he.sr.resumed);
    } else if (target !== side || paused) {
      store().switchTimerSide(babyId, target);
      announce(he.sr.switched(SIDE_LABEL[target]));
    }
  };

  const togglePause = (): void => {
    if (!timer) return;
    if (paused) {
      store().resumeTimer(babyId);
      announce(he.sr.resumed);
    } else {
      store().pauseTimer(babyId);
      announce(he.sr.paused);
    }
  };

  const saveTimer = (endAt?: EpochMs): void => {
    const before = store().activeTimers[babyId];
    if (!before) return;
    const entry = store().finishTimer(babyId, endAt === undefined ? undefined : { endAt });
    onClose();
    if (!entry) return;
    toast.show({
      text: he.timer.saved(formatDuration(breastDurations(entry).total)),
      actionLabel: he.common.undo,
      onAction: () => {
        store().deleteEntry(entry.id);
        store().restoreTimer(before);
      },
    });
  };

  const requestFinish = (): void => {
    if (!timer || !elapsed) return;
    if (timerElapsed(timer, Date.now()).total < MS_PER_MINUTE) setConfirm('short');
    else saveTimer();
  };

  const discard = (): void => {
    const before = store().activeTimers[babyId];
    store().discardTimer(babyId);
    setConfirm(null);
    onClose();
    if (before) {
      toast.show({
        text: he.timer.discarded,
        actionLabel: he.common.undo,
        onAction: () => store().restoreTimer(before),
      });
    }
  };

  const manualErrors = validateBreastForm(manual, now);
  const saveManual = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    const at = Date.now();
    const errs = validateBreastForm(manual, at);
    if (errs.minutes || errs.time) return;
    const start = resolveTime(manual.time, at);
    const segments = segmentsFromMinutes(start, manual.minutes, suggestion?.side ?? 'right');
    const first = segments[0];
    const last = segments[segments.length - 1];
    if (!first || !last) return;
    const note = manual.note.trim();
    actions.add(
      {
        babyId,
        type: 'breast',
        startedAt: first.startedAt,
        endedAt: last.endedAt,
        segments,
        ...(note ? { note } : {}),
      },
      he.timer.saved(formatDuration(last.endedAt - first.startedAt)),
    );
    onClose();
  };

  // Start-time correction: never in the future, never after the first segment ended.
  const firstSegmentEnd = timer?.segments[0]?.endedAt ?? now;
  const newStart = resolveTime(startChoice, now);
  const startError =
    newStart > Math.min(now, firstSegmentEnd) + 30_000 ? he.timer.editStartErr : null;
  const saveStart = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    if (startError) return;
    store().setTimerStart(babyId, resolveTime(startChoice, Date.now()));
    setSubmitted(false);
    setMode('timer');
  };

  const staleMin = timer ? lastRecorded(timer) : now;
  const staleError = staleEnd <= staleMin ? he.timer.stale.err : null;

  // ---------------------------------------------------------------- view

  const formId = `${uid}-form`;
  const showStale = stale && timer !== null && !paused && mode === 'timer';

  let body: ReactNode;
  let footer: ReactNode;

  if (mode === 'manual') {
    body = (
      <BreastFields
        formId={formId}
        state={manual}
        errors={manualErrors}
        showErrors={submitted}
        now={now}
        onSubmit={saveManual}
      />
    );
    footer = (
      <>
        <button type="button" className="btn btn--outline btn--lg" onClick={() => setMode('timer')}>
          {he.timer.backToTimer}
        </button>
        <button type="submit" form={formId} className="btn btn--primary btn--lg">
          <Check aria-hidden="true" />
          {he.common.save}
        </button>
      </>
    );
  } else if (mode === 'editStart' && timer) {
    body = (
      <form id={formId} className="stack stack--6" noValidate onSubmit={saveStart}>
        <TimeField
          label={he.timer.editStartTitle}
          value={startChoice}
          onChange={setStartChoice}
          now={now}
          error={submitted ? startError : null}
        />
      </form>
    );
    footer = (
      <>
        <button
          type="button"
          className="btn btn--outline btn--lg"
          onClick={() => {
            setSubmitted(false);
            setMode('timer');
          }}
        >
          {he.common.cancel}
        </button>
        <button type="submit" form={formId} className="btn btn--primary btn--lg">
          <Check aria-hidden="true" />
          {he.timer.editStartSave}
        </button>
      </>
    );
  } else if (showStale) {
    const errId = `${uid}-stale-err`;
    body = (
      <>
        <div className="banner banner--warning" role="alert">
          <TriangleAlert className="banner__icon" aria-hidden="true" />
          <div className="banner__body">
            <span className="banner__title">{he.timer.stale.title}</span>
            <span className="banner__text">
              {he.timer.stale.text} ({he.banner.meta}
              <span className="ltr num">{formatClock(startedAt ?? now)}</span>)
            </span>
          </div>
        </div>
        <Field
          label={he.timer.stale.endLabel}
          htmlFor={`${uid}-end`}
          error={staleError}
          errorId={errId}
        >
          <DateTimePicker
            id={`${uid}-end`}
            value={staleEnd}
            onChange={setStaleEnd}
            now={now}
            min={staleMin}
            invalid={Boolean(staleError)}
            ariaDescribedby={describedBy(staleError && errId)}
          />
        </Field>
      </>
    );
    footer = (
      <>
        <button
          type="button"
          className="btn btn--ghost-danger btn--lg"
          onClick={() => setConfirm('cancel')}
        >
          <Trash2 aria-hidden="true" />
          {he.timer.cancel}
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={Boolean(staleError)}
          onClick={() => saveTimer(staleEnd)}
        >
          <Check aria-hidden="true" />
          {he.common.save}
        </button>
      </>
    );
  } else {
    const longRunning = timer && !paused && elapsed && elapsed.total >= LONG_FEED_MS;
    body = (
      <>
        {longRunning && (
          <div className="banner banner--warning" role="status">
            <TriangleAlert className="banner__icon" aria-hidden="true" />
            <div className="banner__body">
              <span className="banner__title">{he.timer.long.title}</span>
              <span className="banner__text">{he.timer.long.text}</span>
            </div>
          </div>
        )}
        <div className={`timer${paused ? ' timer--paused' : ''}`}>
          <div className="timer__head">
            {!timer ? (
              <span className="badge badge--lg">{he.timer.chooseSide}</span>
            ) : paused ? (
              <span className="badge badge--lg">
                <Pause aria-hidden="true" />
                {he.timer.paused}
              </span>
            ) : (
              <span className="badge badge--breast badge--lg badge--live">
                <span className="badge__dot" />
                {he.timer.runningSince}
                <span className="ltr num">{formatClock(startedAt ?? now)}</span>
              </span>
            )}
            <div
              className="timer__display"
              role="timer"
              aria-live="off"
              style={timer ? undefined : { color: 'var(--color-text-subtle)' }}
            >
              {formatTimer(elapsed?.total ?? 0)}
            </div>
            {timer && elapsed ? (
              <div className="timer__breakdown">
                {SIDES.map((s) => (
                  <span key={s}>
                    {SIDE_LABEL[s]} <strong className="ltr num">{formatTimer(elapsed[s])}</strong>
                  </span>
                ))}
              </div>
            ) : (
              previous && (
                <div className="timer__breakdown">
                  <span>
                    {he.timer.previous}
                    {lastSideOf(previous) && (
                      <strong>{SIDE_LABEL[lastSideOf(previous) ?? 'right']}</strong>
                    )}
                    {' · '}
                    <span className="ltr num">
                      {roundMinutes(breastDurations(previous).total)}
                    </span>{' '}
                    {he.units.min}
                    {' · '}
                    <span className="ltr num">{formatClock(previous.startedAt)}</span>
                  </span>
                </div>
              )
            )}
          </div>

          <div className="timer__sides" role="group" aria-label={he.timer.sidesLabel}>
            {SIDES.map((s) => {
              const active = timer !== null && side === s;
              const isNext = !timer && suggestion?.side === s;
              const time = elapsed ? elapsed[s] : 0;
              let stateIcon = <Play aria-hidden="true" />;
              let stateText: string = he.timer.start;
              if (active && !paused) {
                stateIcon = <TimerIcon aria-hidden="true" />;
                stateText = he.timer.activeSide;
              } else if (active && paused) {
                stateIcon = <Play aria-hidden="true" />;
                stateText = he.timer.resume;
              } else if (timer) {
                stateIcon = <ArrowLeftRight aria-hidden="true" />;
                stateText = he.timer.switchHere;
              }
              const hintId = `${uid}-next`;
              return (
                <button
                  key={s}
                  type="button"
                  className={`side-btn${active ? ' side-btn--active' : ''}${isNext ? ' side-btn--next' : ''}`}
                  aria-pressed={active}
                  aria-label={he.timer.sideAria(
                    SIDE_LABEL[s],
                    timer ? spokenDuration(time) : '',
                    stateText,
                  )}
                  aria-describedby={isNext ? hintId : undefined}
                  data-autofocus={(timer ? active : s === 'right') || undefined}
                  onClick={() => tapSide(s)}
                >
                  {isNext && (
                    <span className="side-btn__hint" id={hintId}>
                      <Sparkles aria-hidden="true" />
                      {he.timer.nextHint}
                    </span>
                  )}
                  <span className="side-btn__label">{SIDE_LABEL[s]}</span>
                  {timer && <span className="side-btn__time">{formatTimer(time)}</span>}
                  <span className="side-btn__state">
                    {stateIcon}
                    {stateText}
                  </span>
                </button>
              );
            })}
          </div>

          {timer ? (
            <div className="cluster cluster--1" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setStartChoice({ kind: 'at', at: startedAt ?? Date.now() });
                  setSubmitted(false);
                  setMode('editStart');
                }}
              >
                <Clock aria-hidden="true" />
                {he.timer.editStart}
              </button>
              <button
                type="button"
                className="btn btn--ghost-danger btn--sm"
                onClick={() => setConfirm('cancel')}
              >
                <Trash2 aria-hidden="true" />
                {he.timer.cancel}
              </button>
            </div>
          ) : (
            <p className="timer__hint">{he.timer.bgHint}</p>
          )}
        </div>
      </>
    );
    footer = timer ? (
      <>
        <button type="button" className="btn btn--secondary btn--lg" onClick={togglePause}>
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {paused ? he.timer.resume : he.timer.pause}
        </button>
        <button type="button" className="btn btn--primary btn--lg" onClick={requestFinish}>
          <Check aria-hidden="true" />
          {he.timer.finish}
        </button>
      </>
    ) : (
      <button
        type="button"
        className="btn btn--outline btn--lg"
        onClick={() => {
          setSubmitted(false);
          setMode('manual');
        }}
      >
        <Pencil aria-hidden="true" />
        {he.timer.manual}
      </button>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'manual' ? `${he.timer.title} · ${he.timer.manual}` : he.timer.title}
      icon={<Heart />}
      variant="breast"
      full
      dirty={mode === 'manual' && manual.dirty}
      closeLabel={timer ? he.timer.minimize : he.common.close}
      closeIcon={timer ? <ChevronDown aria-hidden="true" /> : undefined}
      footer={footer}
    >
      {body}
      <p className="visually-hidden" aria-live="polite">
        {message}
      </p>
      <ConfirmDialog
        open={confirm === 'cancel'}
        title={he.timer.cancelDialog.title}
        text={he.timer.cancelDialog.text}
        confirmLabel={he.timer.cancelDialog.confirm}
        cancelLabel={he.timer.cancelDialog.back}
        danger
        onConfirm={discard}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'short'}
        title={he.timer.short.title}
        text={he.timer.short.text}
        confirmLabel={he.timer.short.confirm}
        cancelLabel={he.timer.short.back}
        extraAction={{ label: he.timer.short.discard, onAction: discard }}
        onConfirm={() => {
          setConfirm(null);
          saveTimer();
        }}
        onCancel={() => setConfirm(null)}
      />
    </Sheet>
  );
}
