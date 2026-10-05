/**
 * Persistence schema for the app store (localStorage, versioned, migrations-ready).
 */
import { validateBackupData, type BackupData } from '../domain/backup';
import { DEFAULT_SETTINGS } from '../domain/types';

export const STORAGE_KEY = 'babymonitor:v1';
/** Bump when the persisted shape changes, and add a step to `MIGRATIONS`. */
export const STORE_VERSION = 1;

export type PersistedData = BackupData;

export function emptyData(): PersistedData {
  return {
    babies: [],
    entries: [],
    measurements: [],
    activeTimers: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Migration steps keyed by the version they upgrade FROM. Each receives the raw persisted object of
 * that version and returns the shape of the next version. (None yet — v1 is the first schema.)
 */
const MIGRATIONS: Record<number, (state: unknown) => unknown> = {
  // 1: (s) => ({ ...s as object, newField: [] }),  // example for v1 → v2
};

/** Runs all migrations from `fromVersion` up to `STORE_VERSION`. Unknown versions pass through for validation. */
export function migratePersistedState(persisted: unknown, fromVersion: number): unknown {
  let state = persisted;
  for (let v = fromVersion; v < STORE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) state = step(state);
  }
  return state;
}

export type HydrationResult = { ok: true; data: PersistedData } | { ok: false; reason: string };

/** Validates persisted data with the same strict rules as backup import. */
export function validatePersisted(persisted: unknown): HydrationResult {
  if (persisted === undefined || persisted === null) return { ok: true, data: emptyData() };
  const result = validateBackupData(persisted);
  return result.ok
    ? { ok: true, data: result.data }
    : {
        ok: false,
        reason: `${result.error.code} at ${result.error.path ?? '?'}: ${result.error.message}`,
      };
}
