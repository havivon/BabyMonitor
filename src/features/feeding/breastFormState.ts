import { useState } from 'react';
import { MS_PER_MINUTE } from '../../domain/dates';
import type { EpochMs } from '../../domain/types';
import { he } from '../../i18n/he';
import type { SideMinutes } from './breastEntry';
import { FUTURE_SKEW_MS, isFuture, resolveTime, type TimeChoice } from './timeChoice';

export interface BreastFormInit {
  time: TimeChoice;
  minutes: SideMinutes;
  note: string;
}

export interface BreastFormState {
  time: TimeChoice;
  setTime: (t: TimeChoice) => void;
  minutes: SideMinutes;
  setMinutes: (m: SideMinutes) => void;
  note: string;
  setNote: (n: string) => void;
  dirty: boolean;
}

/** State for the manual / edit breastfeed form (start time, minutes per side, note). */
export function useBreastFormState(init: () => BreastFormInit): BreastFormState {
  const [initial] = useState(init);
  const [time, setTime] = useState(initial.time);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [note, setNote] = useState(initial.note);
  const dirty =
    note !== initial.note ||
    minutes.right !== initial.minutes.right ||
    minutes.left !== initial.minutes.left ||
    JSON.stringify(time) !== JSON.stringify(initial.time);
  return { time, setTime, minutes, setMinutes, note, setNote, dirty };
}

export interface BreastFormErrors {
  minutes: string | null;
  time: string | null;
}

/** Validation: at least one side; start not in the future; the feed must not end in the future. */
export function validateBreastForm(state: BreastFormState, now: EpochMs): BreastFormErrors {
  const right = Number.isFinite(state.minutes.right) ? state.minutes.right : 0;
  const left = Number.isFinite(state.minutes.left) ? state.minutes.left : 0;
  const total = Math.max(0, right) + Math.max(0, left);
  const start = resolveTime(state.time, now);
  let time: string | null = null;
  if (isFuture(start, now)) time = he.time.errFuture;
  else if (start + total * MS_PER_MINUTE > now + FUTURE_SKEW_MS) time = he.timer.manualEndFuture;
  return { minutes: total > 0 ? null : he.timer.manualErr, time };
}
