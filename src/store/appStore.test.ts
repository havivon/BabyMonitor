import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { createAppStore, type AppStore } from './appStore';
import { STORAGE_KEY, STORE_VERSION, emptyData, migratePersistedState } from './persistence';
import {
  selectActiveBaby,
  selectActiveEntries,
  selectActiveMeasurements,
  selectActiveRecentFoods,
  selectActiveTimer,
  selectAllTimers,
  selectBabies,
  selectBackupData,
  selectSettings,
} from './selectors';
import { serializeBackup, parseBackup } from '../domain/backup';
import { MIN } from '../test/helpers';

function memoryStorage(
  initial: Record<string, string> = {},
): StateStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const T0 = 1_790_000_000_000;
let clock: number;
let storage: ReturnType<typeof memoryStorage>;
let store: AppStore;

function freshStore(initial?: Record<string, string>): AppStore {
  storage = memoryStorage(initial);
  let n = 0;
  return createAppStore({ storage, now: () => clock, generateId: () => `id${++n}` });
}

const newBaby = {
  name: 'נועה',
  birthDate: '2026-06-01',
  sex: 'female' as const,
  birthWeightG: 3200,
};

beforeEach(() => {
  clock = T0;
  store = freshStore();
});

describe('babies', () => {
  it('adds a baby, makes it active, and persists under babymonitor:v1', () => {
    const baby = store.getState().addBaby(newBaby);
    expect(baby).toEqual({ ...newBaby, id: 'id1', createdAt: T0 });
    expect(selectActiveBaby(store.getState())).toEqual(baby);
    const persisted = JSON.parse(storage.data.get(STORAGE_KEY) ?? '{}') as {
      version: number;
      state: Record<string, unknown>;
    };
    expect(STORAGE_KEY).toBe('babymonitor:v1');
    expect(persisted.version).toBe(STORE_VERSION);
    expect(Object.keys(persisted.state).sort()).toEqual([
      'activeTimers',
      'babies',
      'entries',
      'measurements',
      'settings',
    ]);
  });

  it('updates and switches babies; ignores unknown ids', () => {
    const a = store.getState().addBaby(newBaby);
    const b = store.getState().addBaby({ ...newBaby, name: 'איתי', sex: 'male' });
    expect(selectActiveBaby(store.getState())?.id).toBe(b.id);
    store.getState().setActiveBaby(a.id);
    expect(selectActiveBaby(store.getState())?.id).toBe(a.id);
    store.getState().setActiveBaby('ghost');
    expect(selectActiveBaby(store.getState())?.id).toBe(a.id);
    store.getState().updateBaby(a.id, { name: 'נועה ר.' });
    expect(selectBabies(store.getState()).map((x) => x.name)).toEqual(['נועה ר.', 'איתי']);
  });

  it('removeBaby cascades entries, measurements and timer; active falls back', () => {
    const a = store.getState().addBaby(newBaby);
    const b = store.getState().addBaby({ ...newBaby, name: 'איתי' });
    const s = store.getState();
    s.addEntry({ babyId: a.id, type: 'bottle', at: T0, content: 'formula', amountMl: 90 });
    s.addEntry({ babyId: b.id, type: 'bottle', at: T0, content: 'formula', amountMl: 60 });
    s.addMeasurement({ babyId: b.id, date: '2026-07-01', weightG: 4000 });
    s.startTimer(b.id, 'left');
    s.removeBaby(b.id);
    const after = store.getState();
    expect(after.babies.map((x) => x.id)).toEqual([a.id]);
    expect(after.entries.every((e) => e.babyId === a.id)).toBe(true);
    expect(after.measurements).toEqual([]);
    expect(after.activeTimers).toEqual({});
    expect(after.settings.activeBabyId).toBe(a.id);
    after.removeBaby(a.id);
    expect(store.getState().settings.activeBabyId).toBeNull();
  });
});

describe('entries', () => {
  beforeEach(() => {
    store.getState().addBaby(newBaby);
  });

  it('adds, updates, deletes and restores (undo) entries', () => {
    const s = store.getState();
    const e = s.addEntry({
      babyId: 'id1',
      type: 'bottle',
      at: T0,
      content: 'formula',
      amountMl: 90,
    });
    expect(e.id).toBe('id2');
    s.updateEntry({ ...e, amountMl: 100 } as typeof e);
    expect(store.getState().entries[0]).toMatchObject({ amountMl: 100 });
    const removed = s.deleteEntry(e.id);
    expect(removed).toMatchObject({ id: e.id, amountMl: 100 });
    expect(store.getState().entries).toEqual([]);
    expect(s.deleteEntry('nope')).toBeUndefined();
    s.restoreEntry(removed!);
    s.restoreEntry(removed!); // idempotent
    expect(store.getState().entries).toHaveLength(1);
    s.restoreEntry({ ...removed!, id: 'x', babyId: 'ghost' }); // baby gone → ignored
    expect(store.getState().entries).toHaveLength(1);
  });

  it('selectActiveEntries returns newest first, only for the active baby, with a stable reference', () => {
    const s = store.getState();
    s.addEntry({ babyId: 'id1', type: 'bottle', at: T0, content: 'formula', amountMl: 90 });
    s.addEntry({ babyId: 'id1', type: 'solid', at: T0 + 60 * MIN, foods: ['Banana', 'אורז'] });
    s.addEntry({ babyId: 'id1', type: 'solid', at: T0 + 90 * MIN, foods: ['banana '] });
    s.addEntry({ babyId: 'other', type: 'bottle', at: T0 + 5, content: 'formula', amountMl: 1 });
    const first = selectActiveEntries(store.getState());
    expect(first.map((e) => e.type)).toEqual(['solid', 'solid', 'bottle']);
    expect(selectActiveEntries(store.getState())).toBe(first);
    expect(selectActiveRecentFoods(store.getState())).toEqual(['banana', 'אורז']);
    s.updateSettings({ volumeUnit: 'oz' }); // unrelated change keeps the reference
    expect(selectActiveEntries(store.getState())).toBe(first);
  });
});

describe('measurements', () => {
  it('adds/updates/deletes/restores and sorts by date', () => {
    store.getState().addBaby(newBaby);
    const s = store.getState();
    const m1 = s.addMeasurement({ babyId: 'id1', date: '2026-07-01', weightG: 4300 });
    s.addMeasurement({ babyId: 'id1', date: '2026-06-15', weightG: 3600 });
    expect(selectActiveMeasurements(store.getState()).map((m) => m.date)).toEqual([
      '2026-06-15',
      '2026-07-01',
    ]);
    s.updateMeasurement({ ...m1, weightG: 4350 });
    expect(store.getState().measurements.find((m) => m.id === m1.id)?.weightG).toBe(4350);
    const removed = s.deleteMeasurement(m1.id);
    expect(removed?.weightG).toBe(4350);
    expect(s.deleteMeasurement('nope')).toBeUndefined();
    s.restoreMeasurement(removed!);
    s.restoreMeasurement(removed!);
    expect(store.getState().measurements).toHaveLength(2);
  });

  it('selectors return empty arrays without an active baby', () => {
    expect(selectActiveEntries(store.getState())).toEqual([]);
    expect(selectActiveMeasurements(store.getState())).toEqual([]);
    expect(selectActiveTimer(store.getState())).toBeNull();
    expect(selectActiveBaby(store.getState())).toBeNull();
  });
});

describe('timer actions', () => {
  beforeEach(() => {
    store.getState().addBaby(newBaby);
  });

  it('runs the full start → switch → pause → resume → finish flow', () => {
    const s = store.getState();
    s.startTimer('id1', 'left');
    clock += 10 * MIN;
    s.switchTimerSide('id1');
    clock += 5 * MIN;
    s.pauseTimer('id1');
    clock += 3 * MIN;
    s.resumeTimer('id1');
    clock += 2 * MIN;
    expect(selectActiveTimer(store.getState())?.segments.map((x) => x.side)).toEqual([
      'left',
      'right',
      'right',
    ]);
    const entry = s.finishTimer('id1', { note: 'ok' });
    expect(entry).toMatchObject({
      type: 'breast',
      babyId: 'id1',
      startedAt: T0,
      endedAt: T0 + 20 * MIN,
      note: 'ok',
    });
    expect(entry?.segments).toHaveLength(3);
    expect(store.getState().activeTimers).toEqual({});
    expect(store.getState().entries).toEqual([entry]);
  });

  it('startTimer on a running timer switches side instead of restarting', () => {
    const s = store.getState();
    s.startTimer('id1', 'left');
    clock += MIN;
    s.startTimer('id1', 'right');
    expect(selectAllTimers(store.getState()).id1?.segments).toHaveLength(2);
    s.startTimer('ghost', 'left');
    expect(store.getState().activeTimers.ghost).toBeUndefined();
  });

  it('finishTimer with endAt fixes a stale timer; empty timers are discarded', () => {
    const s = store.getState();
    s.startTimer('id1', 'left');
    clock += 8 * 60 * MIN;
    expect(s.finishTimer('id1', { endAt: T0 + 25 * MIN })?.endedAt).toBe(T0 + 25 * MIN);
    s.startTimer('id1', 'right');
    expect(s.finishTimer('id1')).toBeNull();
    expect(store.getState().activeTimers).toEqual({});
    expect(s.finishTimer('nobody')).toBeNull();
  });

  it('ignores actions for babies without a timer and supports discard', () => {
    const s = store.getState();
    const before = store.getState().activeTimers;
    s.pauseTimer('id1');
    s.resumeTimer('id1');
    s.switchTimerSide('id1');
    expect(store.getState().activeTimers).toBe(before);
    s.startTimer('id1', 'left');
    s.resumeTimer('id1'); // no-op on running timer → same reference
    s.discardTimer('id1');
    expect(store.getState().activeTimers).toEqual({});
  });
});

describe('settings, import & reset', () => {
  it('updates settings', () => {
    store.getState().updateSettings({ theme: 'dark', weightUnit: 'lb' });
    expect(selectSettings(store.getState())).toMatchObject({
      theme: 'dark',
      weightUnit: 'lb',
      volumeUnit: 'ml',
    });
  });

  it('exports and re-imports a backup into a fresh store', () => {
    const s = store.getState();
    s.addBaby(newBaby);
    s.addEntry({ babyId: 'id1', type: 'bottle', at: T0, content: 'breastmilk', amountMl: 80 });
    s.startTimer('id1', 'left');
    const json = serializeBackup(selectBackupData(store.getState()), T0);
    expect(selectBackupData(store.getState())).toBe(selectBackupData(store.getState()));

    const other = freshStore();
    const parsed = parseBackup(json);
    if (!parsed.ok) throw new Error('backup should parse');
    other.getState().importBackup(parsed.data);
    expect(selectBackupData(other.getState())).toEqual(selectBackupData(store.getState()));
  });

  it('resetAll wipes everything', () => {
    store.getState().addBaby(newBaby);
    store.getState().resetAll();
    expect(selectBackupData(store.getState())).toEqual(emptyData());
  });
});

describe('persistence', () => {
  it('rehydrates a previous session (timer survives reload)', () => {
    store.getState().addBaby(newBaby);
    store.getState().startTimer('id1', 'right');
    const saved = Object.fromEntries(storage.data);
    const reloaded = freshStore(saved);
    expect(reloaded.persist.hasHydrated()).toBe(true);
    expect(selectActiveBaby(reloaded.getState())?.name).toBe('נועה');
    expect(selectActiveTimer(reloaded.getState())?.segments[0]).toEqual({
      side: 'right',
      startedAt: T0,
    });
  });

  it('stashes corrupt persisted state instead of silently destroying it', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const corrupt = JSON.stringify({ state: { babies: 'nope' }, version: STORE_VERSION });
    const s = freshStore({ [STORAGE_KEY]: corrupt });
    expect(s.getState().babies).toEqual([]);
    expect(storage.data.get(`${STORAGE_KEY}:corrupt`)).toBe(JSON.stringify({ babies: 'nope' }));
    expect(errSpy).toHaveBeenCalledOnce();
  });

  it('runs migrate for older versions (stub passes data through)', () => {
    const old = JSON.stringify({ state: { ...emptyData(), babies: [] }, version: 0 });
    const s = freshStore({ [STORAGE_KEY]: old });
    expect(s.getState().babies).toEqual([]);
    expect(migratePersistedState({ a: 1 }, 0)).toEqual({ a: 1 });
  });
});
