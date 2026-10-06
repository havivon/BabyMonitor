/**
 * Persistence schema for the app store (localStorage, versioned, migrations-ready).
 */
import { validateBackupData, type BackupData } from '../domain/backup';
import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware';
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

/**
 * Saves an unreadable stored value under `${name}:corrupt` (or `${name}:corrupt:<time>` when an
 * older, different stash already exists) so it can be recovered by hand. Returns the key used, or
 * `null` if storage refused the write.
 */
export function stashCorrupt(storage: StateStorage, name: string, raw: string): string | null {
  try {
    let key = `${name}:corrupt`;
    const existing = storage.getItem(key);
    if (typeof existing === 'string' && existing !== raw) key = `${key}:${Date.now()}`;
    void storage.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

function isEnvelope(value: unknown): value is StorageValue<unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'state' in value;
}

/**
 * JSON storage for zustand `persist` that never loses unreadable data (QA BUG-008): if the stored
 * value is not valid JSON, or not a `{ state, version }` envelope, the raw string is stashed via
 * `stashCorrupt`, an error is logged, and `null` is returned so the app starts fresh — the
 * original bytes survive the first write. (Schema-invalid but parseable data is handled by the
 * store's `merge`.)
 */
export function createSafeJsonStorage<S>(
  getStorage: () => StateStorage,
): PersistStorage<S> | undefined {
  let storage: StateStorage;
  try {
    storage = getStorage();
  } catch {
    return undefined; // e.g. localStorage blocked: run in-memory only
  }
  const parse = (name: string, raw: string | null): StorageValue<S> | null => {
    if (raw === null) return null;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      value = undefined;
    }
    if (isEnvelope(value)) return value as StorageValue<S>;
    const key = stashCorrupt(storage, name, raw);
    console.error(
      `[store] stored data is unreadable; original kept in "${key ?? '(storage full)'}"`,
    );
    return null;
  };
  return {
    getItem: (name) => {
      const raw = storage.getItem(name);
      return raw instanceof Promise ? raw.then((r) => parse(name, r)) : parse(name, raw);
    },
    setItem: (name, value) => storage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => storage.removeItem(name),
  };
}
