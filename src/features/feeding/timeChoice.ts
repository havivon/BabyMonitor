import { MS_PER_MINUTE } from '../../domain/dates';
import type { EpochMs } from '../../domain/types';

/**
 * What the user picked in a time field. Quick chips are RELATIVE ("before 15 minutes"), resolved at
 * save time, so a sheet left open for a while still saves the moment the parent meant.
 */
export type TimeChoice = { kind: 'ago'; minutes: number } | { kind: 'at'; at: EpochMs };

export const QUICK_AGO_MINUTES = [0, 15, 30, 60] as const;

/** Clock skew tolerated before a time counts as "in the future". */
export const FUTURE_SKEW_MS = MS_PER_MINUTE;

export const nowChoice = (): TimeChoice => ({ kind: 'ago', minutes: 0 });

export function resolveTime(choice: TimeChoice, now: EpochMs): EpochMs {
  return choice.kind === 'ago' ? now - choice.minutes * MS_PER_MINUTE : choice.at;
}

export function isFuture(at: EpochMs, now: EpochMs): boolean {
  return at > now + FUTURE_SKEW_MS;
}
