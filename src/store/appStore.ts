/**
 * Global app store: Zustand + persist (localStorage key `babymonitor:v1`).
 *
 * `createAppStore()` is a factory so tests (and stories) get an isolated store with injectable
 * storage, clock and id generator. The app uses the singleton `appStore` (see hooks.ts).
 */
import { nanoid } from 'nanoid';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BackupData } from '../domain/backup';
import * as timer from '../domain/timer';
import type {
  ActiveTimer,
  Baby,
  BreastEntry,
  EpochMs,
  FeedingEntry,
  Measurement,
  NewFeedingEntry,
  Settings,
  Side,
} from '../domain/types';
import {
  emptyData,
  migratePersistedState,
  STORAGE_KEY,
  STORE_VERSION,
  validatePersisted,
  type PersistedData,
} from './persistence';

export type NewBaby = Omit<Baby, 'id' | 'createdAt'>;
export type NewMeasurement = Omit<Measurement, 'id'>;

export interface AppActions {
  // babies
  /** Adds a baby and makes it the active one. */
  addBaby: (input: NewBaby) => Baby;
  updateBaby: (id: string, patch: Partial<NewBaby>) => void;
  /** Removes a baby with ALL its entries, measurements and timer. Active baby falls back to the first remaining. */
  removeBaby: (id: string) => void;
  /** Ignored for unknown ids. */
  setActiveBaby: (id: string) => void;

  // feeding entries
  addEntry: (input: NewFeedingEntry) => FeedingEntry;
  /** Replaces the entry with the same id (no-op if missing). */
  updateEntry: (entry: FeedingEntry) => void;
  /** Returns the removed entry so the UI can offer undo via `restoreEntry`. */
  deleteEntry: (id: string) => FeedingEntry | undefined;
  /** Re-inserts a deleted entry (no-op if the id exists or its baby is gone). */
  restoreEntry: (entry: FeedingEntry) => void;

  // measurements
  addMeasurement: (input: NewMeasurement) => Measurement;
  updateMeasurement: (measurement: Measurement) => void;
  deleteMeasurement: (id: string) => Measurement | undefined;
  restoreMeasurement: (measurement: Measurement) => void;

  // breastfeeding timer (one per baby)
  /** Starts a timer on `side`; if one is already running for the baby, switches it to `side`. */
  startTimer: (babyId: string, side: Side) => void;
  /** Switches to the other side (or `side`); resumes if paused. */
  switchTimerSide: (babyId: string, side?: Side) => void;
  pauseTimer: (babyId: string) => void;
  resumeTimer: (babyId: string) => void;
  /**
   * Saves the timer as a breast entry and clears it. `endAt` lets the UI fix a forgotten (stale)
   * timer. Returns the new entry, or `null` if there was nothing to save (timer is discarded).
   */
  finishTimer: (babyId: string, options?: { endAt?: EpochMs; note?: string }) => BreastEntry | null;
  discardTimer: (babyId: string) => void;
  /** Corrects the start time of the running/paused timer (see `setTimerStart`). */
  setTimerStart: (babyId: string, startedAt: EpochMs) => void;
  /**
   * Puts a timer back (undo of "finish" / "discard"). No-op if the baby is gone or already has a
   * timer, so it can never clobber a newer one.
   */
  restoreTimer: (timer: ActiveTimer) => void;

  // settings & data
  updateSettings: (patch: Partial<Settings>) => void;
  /** Replaces ALL data with a validated backup (see `parseBackup`). */
  importBackup: (data: BackupData) => void;
  /** Wipes all data back to the empty initial state. */
  resetAll: () => void;
}

export type AppState = PersistedData & AppActions;
export type AppStore = StoreApi<AppState> & {
  persist: {
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    clearStorage: () => void;
  };
};

export interface CreateAppStoreOptions {
  /** Raw storage (default `localStorage`). Pass an in-memory one in tests. */
  storage?: StateStorage;
  /** Storage key (default `babymonitor:v1`). */
  name?: string;
  now?: () => EpochMs;
  generateId?: () => string;
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

export function createAppStore(options: CreateAppStoreOptions = {}): AppStore {
  // Resolve Date.now lazily on every call (not captured once) so a replaced/mocked clock — e.g.
  // fake timers installed after this module was imported — is honoured by the singleton store.
  const now = options.now ?? (() => Date.now());
  const id = options.generateId ?? (() => nanoid());
  const name = options.name ?? STORAGE_KEY;
  const rawStorage = options.storage;

  return createStore<AppState>()(
    persist(
      (set, get) => {
        const updateTimer = (babyId: string, fn: (t: ActiveTimer) => ActiveTimer): void => {
          const current = get().activeTimers[babyId];
          if (!current) return;
          const next = fn(current);
          if (next !== current) set({ activeTimers: { ...get().activeTimers, [babyId]: next } });
        };
        const babyExists = (babyId: string): boolean => get().babies.some((b) => b.id === babyId);

        return {
          ...emptyData(),

          addBaby: (input) => {
            const baby: Baby = { ...input, id: id(), createdAt: now() };
            set((s) => ({
              babies: [...s.babies, baby],
              settings: { ...s.settings, activeBabyId: baby.id },
            }));
            return baby;
          },
          updateBaby: (babyId, patch) =>
            set((s) => ({
              babies: s.babies.map((b) => (b.id === babyId ? { ...b, ...patch } : b)),
            })),
          removeBaby: (babyId) =>
            set((s) => {
              const babies = s.babies.filter((b) => b.id !== babyId);
              const activeBabyId =
                s.settings.activeBabyId === babyId
                  ? (babies[0]?.id ?? null)
                  : s.settings.activeBabyId;
              return {
                babies,
                entries: s.entries.filter((e) => e.babyId !== babyId),
                measurements: s.measurements.filter((m) => m.babyId !== babyId),
                activeTimers: withoutKey(s.activeTimers, babyId),
                settings: { ...s.settings, activeBabyId },
              };
            }),
          setActiveBaby: (babyId) => {
            if (babyExists(babyId))
              set((s) => ({ settings: { ...s.settings, activeBabyId: babyId } }));
          },

          addEntry: (input) => {
            const entry: FeedingEntry = { ...input, id: id() };
            set((s) => ({ entries: [...s.entries, entry] }));
            return entry;
          },
          updateEntry: (entry) =>
            set((s) => ({ entries: s.entries.map((e) => (e.id === entry.id ? entry : e)) })),
          deleteEntry: (entryId) => {
            const entry = get().entries.find((e) => e.id === entryId);
            if (entry) set((s) => ({ entries: s.entries.filter((e) => e.id !== entryId) }));
            return entry;
          },
          restoreEntry: (entry) => {
            const s = get();
            if (s.entries.some((e) => e.id === entry.id) || !babyExists(entry.babyId)) return;
            set({ entries: [...s.entries, entry] });
          },

          addMeasurement: (input) => {
            const measurement: Measurement = { ...input, id: id() };
            set((s) => ({ measurements: [...s.measurements, measurement] }));
            return measurement;
          },
          updateMeasurement: (measurement) =>
            set((s) => ({
              measurements: s.measurements.map((m) => (m.id === measurement.id ? measurement : m)),
            })),
          deleteMeasurement: (measurementId) => {
            const measurement = get().measurements.find((m) => m.id === measurementId);
            if (measurement) {
              set((s) => ({ measurements: s.measurements.filter((m) => m.id !== measurementId) }));
            }
            return measurement;
          },
          restoreMeasurement: (measurement) => {
            const s = get();
            if (
              s.measurements.some((m) => m.id === measurement.id) ||
              !babyExists(measurement.babyId)
            )
              return;
            set({ measurements: [...s.measurements, measurement] });
          },

          startTimer: (babyId, side) => {
            if (!babyExists(babyId)) return;
            const existing = get().activeTimers[babyId];
            const next = existing
              ? timer.switchSide(existing, now(), side)
              : timer.startTimer(babyId, side, now());
            set((s) => ({ activeTimers: { ...s.activeTimers, [babyId]: next } }));
          },
          switchTimerSide: (babyId, side) =>
            updateTimer(babyId, (t) => timer.switchSide(t, now(), side)),
          pauseTimer: (babyId) => updateTimer(babyId, (t) => timer.pauseTimer(t, now())),
          resumeTimer: (babyId) => updateTimer(babyId, (t) => timer.resumeTimer(t, now())),
          finishTimer: (babyId, opts = {}) => {
            const current = get().activeTimers[babyId];
            if (!current) return null;
            const finished = timer.finishTimer(current, opts.endAt ?? now(), id());
            const entry = finished && opts.note ? { ...finished, note: opts.note } : finished;
            set((s) => ({
              activeTimers: withoutKey(s.activeTimers, babyId),
              entries: entry ? [...s.entries, entry] : s.entries,
            }));
            return entry;
          },
          discardTimer: (babyId) =>
            set((s) => ({ activeTimers: withoutKey(s.activeTimers, babyId) })),
          setTimerStart: (babyId, startedAt) =>
            updateTimer(babyId, (t) => timer.setTimerStart(t, startedAt, now())),
          restoreTimer: (restored) => {
            const s = get();
            if (!babyExists(restored.babyId) || s.activeTimers[restored.babyId]) return;
            set({ activeTimers: { ...s.activeTimers, [restored.babyId]: restored } });
          },

          updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
          importBackup: (data) =>
            set({
              babies: data.babies,
              entries: data.entries,
              measurements: data.measurements,
              activeTimers: data.activeTimers,
              settings: data.settings,
            }),
          resetAll: () => set(emptyData()),
        };
      },
      {
        name,
        version: STORE_VERSION,
        storage: createJSONStorage(() => rawStorage ?? localStorage),
        partialize: (s): PersistedData => ({
          babies: s.babies,
          entries: s.entries,
          measurements: s.measurements,
          activeTimers: s.activeTimers,
          settings: s.settings,
        }),
        migrate: (persisted, version) => migratePersistedState(persisted, version) as PersistedData,
        merge: (persisted, current) => {
          const result = validatePersisted(persisted);
          if (result.ok) return { ...current, ...result.data };
          // Never silently destroy user data: stash the unreadable state before starting fresh.
          console.error(
            `[store] persisted state rejected (${result.reason}); saved to "${name}:corrupt"`,
          );
          try {
            (rawStorage ?? localStorage).setItem(`${name}:corrupt`, JSON.stringify(persisted));
          } catch {
            /* storage unavailable — nothing more we can do */
          }
          return current;
        },
      },
    ),
  );
}
