/**
 * Pure, memoised selectors. Memoisation matters: Zustand re-renders when a selector returns a new
 * reference, so derived arrays must be cached on their inputs.
 */
import type { BackupData } from '../domain/backup';
import { compareEntriesDesc } from '../domain/feeding';
import type { ActiveTimer, Baby, FeedingEntry, Measurement, Settings } from '../domain/types';
import type { AppState } from './appStore';

/** Caches the last result per input tuple (compared by reference). */
function memoize<A extends readonly unknown[], R>(compute: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | undefined;
  let lastResult: R;
  return (...args: A): R => {
    if (!lastArgs || lastArgs.length !== args.length || args.some((a, i) => a !== lastArgs?.[i])) {
      lastResult = compute(...args);
      lastArgs = args;
    }
    return lastResult;
  };
}

export const selectSettings = (s: AppState): Settings => s.settings;
export const selectBabies = (s: AppState): Baby[] => s.babies;
export const selectActiveBabyId = (s: AppState): string | null => s.settings.activeBabyId;

export const selectActiveBaby = (s: AppState): Baby | null =>
  s.babies.find((b) => b.id === s.settings.activeBabyId) ?? null;

const entriesForBaby = memoize((entries: FeedingEntry[], babyId: string | null): FeedingEntry[] =>
  babyId === null ? [] : entries.filter((e) => e.babyId === babyId).sort(compareEntriesDesc),
);
/** Active baby's entries, newest first (stable reference until entries/active baby change). */
export const selectActiveEntries = (s: AppState): FeedingEntry[] =>
  entriesForBaby(s.entries, s.settings.activeBabyId);

const measurementsForBaby = memoize(
  (measurements: Measurement[], babyId: string | null): Measurement[] =>
    babyId === null
      ? []
      : measurements
          .filter((m) => m.babyId === babyId)
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
);
/** Active baby's measurements, oldest first by date. */
export const selectActiveMeasurements = (s: AppState): Measurement[] =>
  measurementsForBaby(s.measurements, s.settings.activeBabyId);

export const selectActiveTimer = (s: AppState): ActiveTimer | null =>
  s.settings.activeBabyId === null ? null : (s.activeTimers[s.settings.activeBabyId] ?? null);

/** Timers of all babies (e.g. for a global banner when the active baby is not the one feeding). */
export const selectAllTimers = (s: AppState): Record<string, ActiveTimer> => s.activeTimers;

/** Recently used solid foods for suggestions, most recent first, de-duplicated (case-insensitive). */
export const selectRecentFoods = memoize(
  (entries: FeedingEntry[], babyId: string | null): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of entriesForBaby(entries, babyId)) {
      if (e.type !== 'solid') continue;
      for (const food of e.foods) {
        const key = food.trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          out.push(food.trim());
        }
      }
    }
    return out;
  },
);
export const selectActiveRecentFoods = (s: AppState): string[] =>
  selectRecentFoods(s.entries, s.settings.activeBabyId);

const backupData = memoize(
  (
    babies: Baby[],
    entries: FeedingEntry[],
    measurements: Measurement[],
    activeTimers: Record<string, ActiveTimer>,
    settings: Settings,
  ): BackupData => ({ babies, entries, measurements, activeTimers, settings }),
);
/** Snapshot of all persisted data, ready for `serializeBackup`. */
export const selectBackupData = (s: AppState): BackupData =>
  backupData(s.babies, s.entries, s.measurements, s.activeTimers, s.settings);
