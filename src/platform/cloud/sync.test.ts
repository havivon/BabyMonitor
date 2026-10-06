import { describe, expect, it, vi } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { createAppStore, type AppStore } from '../../store/appStore';
import type { Connectivity } from './backend';
import { FakeServer, settle, type FakeClient } from './fakeBackend';
import { startSync, type SyncStatusInfo } from './sync';

const T0 = 1_790_000_000_000;

function memoryStorage(): StateStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

let ids = 0;
function newStore(): AppStore {
  return createAppStore({
    storage: memoryStorage(),
    now: () => T0,
    generateId: () => `id${++ids}`,
  });
}

function connectivity(initial = true): Connectivity & { set(online: boolean): void } {
  let online = initial;
  const listeners = new Set<(o: boolean) => void>();
  return {
    isOnline: () => online,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(v) {
      online = v;
      for (const l of listeners) l(v);
    },
  };
}

interface Device {
  store: AppStore;
  client: FakeClient;
  statuses: SyncStatusInfo[];
  net: ReturnType<typeof connectivity>;
  engine: ReturnType<typeof startSync>;
}

function device(
  server: FakeServer,
  store = newStore(),
  uid?: string,
): Device & { starters: Record<string, string> } {
  const client = server.client();
  const statuses: SyncStatusInfo[] = [];
  const net = connectivity();
  const out = { starters: {} as Record<string, string> };
  const engine = startSync({
    store,
    backend: client,
    connectivity: net,
    now: () => T0,
    uid,
    onStatus: (s) => statuses.push(s),
    onTimerStarters: (m) => {
      out.starters = m;
    },
  });
  return Object.assign(out, { store, client, statuses, net, engine });
}

/** Puts a device offline (client + connectivity). */
function offline(d: Device, value: boolean) {
  d.client.setOnline(!value);
  d.net.set(!value);
}

const shared = (s: AppStore) => {
  const { babies, entries, measurements, activeTimers } = s.getState();
  const byId = <T extends { id: string }>(a: T[]) =>
    [...a].sort((x, y) => x.id.localeCompare(y.id));
  return {
    babies: byId(babies),
    entries: byId(entries),
    measurements: byId(measurements),
    activeTimers,
  };
};

function seedLocal(store: AppStore) {
  const s = store.getState();
  const baby = s.addBaby({
    name: 'נועה',
    birthDate: '2026-06-01',
    sex: 'female',
    birthWeightG: 3200,
  });
  s.addEntry({ babyId: baby.id, type: 'bottle', at: T0, content: 'formula', amountMl: 90 });
  s.addMeasurement({ babyId: baby.id, date: '2026-07-01', weightG: 4300 });
  return baby;
}

describe('sync engine', () => {
  it('uploads local data on first sync and a second device receives it (activeBabyId repaired)', async () => {
    const server = new FakeServer();
    const aStore = newStore();
    const baby = seedLocal(aStore);
    const a = device(server, aStore);
    await a.engine.ready;
    await settle();
    expect(server.records('babies')).toHaveLength(1);
    expect(server.records('entries')).toHaveLength(1);
    expect(server.records('measurements')).toHaveLength(1);

    const b = device(server);
    await b.engine.ready;
    await settle();
    expect(shared(b.store)).toEqual(shared(a.store));
    expect(b.store.getState().settings.activeBabyId).toBe(baby.id);
  });

  it('does not echo remote changes back (no write loops)', async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await Promise.all([a.engine.ready, b.engine.ready]);
    await settle();
    const before = server.commits;
    seedLocal(a.store); // 3 store changes on A → 3 commits by A, none by B
    await settle();
    expect(server.commits - before).toBe(3);
    expect(shared(b.store)).toEqual(shared(a.store));
    await settle();
    expect(server.commits - before).toBe(3);
  });

  it('propagates edits and deletes (tombstones) both ways', async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await settle();
    seedLocal(a.store);
    await settle();
    const entry = b.store.getState().entries[0];
    if (entry?.type !== 'bottle') throw new Error('expected a bottle');
    b.store.getState().updateEntry({ ...entry, amountMl: 150 });
    await settle();
    expect(a.store.getState().entries[0]).toMatchObject({ amountMl: 150 });

    a.store.getState().deleteEntry(entry.id);
    await settle();
    expect(b.store.getState().entries).toEqual([]);
    expect(server.docs.entries.get(entry.id)).toEqual({ data: null, deleted: true });
  });

  it('keeps working offline and converges after reconnecting', async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await settle();
    const baby = seedLocal(a.store);
    await settle();

    offline(b, true);
    b.store.getState().addEntry({ babyId: baby.id, type: 'solid', at: T0 + 1, foods: ['בטטה'] });
    const m = b.store.getState().measurements[0];
    if (!m) throw new Error('missing measurement');
    b.store.getState().deleteMeasurement(m.id);
    a.store.getState().addEntry({
      babyId: baby.id,
      type: 'bottle',
      at: T0 + 2,
      content: 'breastmilk',
      amountMl: 60,
    });
    await settle();
    expect(b.engine.status.status).toBe('offline');
    expect(b.store.getState().entries).toHaveLength(2); // A's new entry not visible yet
    expect(a.store.getState().measurements).toHaveLength(1); // B's delete not visible yet

    offline(b, false);
    await settle();
    expect(shared(a.store)).toEqual(shared(b.store));
    expect(a.store.getState().entries).toHaveLength(3);
    expect(a.store.getState().measurements).toEqual([]);
  });

  it('a remote tombstone removes a stale local copy instead of resurrecting it', async () => {
    const server = new FakeServer();
    const a = device(server);
    await settle();
    seedLocal(a.store);
    await settle();
    // B synced earlier and keeps a copy on disk.
    const bStore = newStore();
    const b1 = device(server, bStore);
    await settle();
    b1.engine.stop();
    const entryId = bStore.getState().entries[0]?.id;
    a.store.getState().deleteEntry(entryId ?? '');
    await settle();
    // B starts again later (e.g. app reopened) with its stale local copy.
    const b2 = device(server, bStore);
    await b2.engine.ready;
    await settle();
    expect(bStore.getState().entries).toEqual([]);
    expect(server.docs.entries.get(entryId ?? '')?.deleted).toBe(true);
  });

  it('resolves concurrent edits last-write-wins and both devices converge', async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await settle();
    seedLocal(a.store);
    await settle();
    offline(a, true);
    offline(b, true);
    const ea = a.store.getState().entries[0];
    const eb = b.store.getState().entries[0];
    if (ea?.type !== 'bottle' || eb?.type !== 'bottle') throw new Error('expected bottles');
    a.store.getState().updateEntry({ ...ea, amountMl: 100 });
    b.store.getState().updateEntry({ ...eb, amountMl: 200 });
    offline(a, false); // A reaches the server first
    await settle();
    offline(b, false); // B's write lands last → wins
    await settle();
    expect(a.store.getState().entries[0]).toMatchObject({ amountMl: 200 });
    expect(b.store.getState().entries[0]).toMatchObject({ amountMl: 200 });
  });

  it('syncs the running breastfeeding timer so both parents see it', async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await settle();
    const baby = seedLocal(a.store);
    await settle();
    a.store.getState().startTimer(baby.id, 'left');
    await settle();
    expect(b.store.getState().activeTimers[baby.id]?.segments[0]?.side).toBe('left');
    b.store.getState().switchTimerSide(baby.id); // the other parent switches side
    await settle();
    expect(a.store.getState().activeTimers[baby.id]?.segments).toHaveLength(2);
    a.store.getState().finishTimer(baby.id, { endAt: T0 + 600_000 });
    await settle();
    expect(b.store.getState().activeTimers).toEqual({});
    expect(b.store.getState().entries.some((e) => e.type === 'breast')).toBe(true);
  });

  it('records who started a shared timer and keeps it across side switches', async () => {
    const server = new FakeServer();
    const a = device(server, newStore(), 'mom');
    const b = device(server, newStore(), 'dad');
    await settle();
    const baby = seedLocal(a.store);
    await settle();
    a.store.getState().startTimer(baby.id, 'right');
    await settle();
    expect(a.starters).toEqual({ [baby.id]: 'mom' });
    expect(b.starters).toEqual({ [baby.id]: 'mom' });
    b.store.getState().switchTimerSide(baby.id);
    await settle();
    expect(server.docs.timers.get(baby.id)?.startedBy).toBe('mom');
    expect(a.starters).toEqual({ [baby.id]: 'mom' });
    b.store.getState().finishTimer(baby.id, { endAt: T0 + 60_000 });
    await settle();
    expect(a.starters).toEqual({});
    expect(b.starters).toEqual({});
    b.store.getState().startTimer(baby.id, 'left');
    await settle();
    expect(a.starters).toEqual({ [baby.id]: 'dad' });
  });

  it('syncs the birth length / head circumference on the baby profile', async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await settle();
    const baby = seedLocal(a.store);
    a.store.getState().updateBaby(baby.id, { birthLengthMm: 498, birthHeadMm: 342 });
    await settle();
    expect(b.store.getState().babies[0]).toMatchObject({ birthLengthMm: 498, birthHeadMm: 342 });
  });

  it('never syncs device settings', async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await settle();
    const before = server.commits;
    a.store.getState().updateSettings({ volumeUnit: 'oz', theme: 'dark' });
    await settle();
    expect(server.commits).toBe(before);
    expect(b.store.getState().settings).toMatchObject({ volumeUnit: 'ml', theme: 'auto' });
  });

  it('merges a device that already has data into a family that has data (union)', async () => {
    const server = new FakeServer();
    const a = device(server);
    await settle();
    seedLocal(a.store);
    await settle();
    const bStore = newStore();
    bStore.getState().addBaby({ name: 'איתי', birthDate: '2025-01-01', sex: 'male' });
    const b = device(server, bStore);
    await b.engine.ready;
    await settle();
    expect(
      bStore
        .getState()
        .babies.map((x) => x.name)
        .sort(),
    ).toEqual(['איתי', 'נועה']);
    expect(
      a.store
        .getState()
        .babies.map((x) => x.name)
        .sort(),
    ).toEqual(['איתי', 'נועה']);
    // B's own active baby is kept.
    expect(bStore.getState().settings.activeBabyId).toBe(
      bStore.getState().babies.find((x) => x.name === 'איתי')?.id,
    );
  });

  it('ignores malformed remote documents', async () => {
    const server = new FakeServer();
    const onInvalid = vi.fn();
    const store = newStore();
    const client = server.client();
    server.commit([{ collection: 'entries', id: 'bad', data: { id: 'bad', type: 'bottle' } }]);
    startSync({ store, backend: client, connectivity: connectivity(), onInvalidDoc: onInvalid });
    await settle();
    expect(onInvalid).toHaveBeenCalledWith('entries', 'bad');
    expect(store.getState().entries).toEqual([]);
  });

  it('reports status: connecting → synced, syncing while writes are pending offline, error on failure', async () => {
    const server = new FakeServer();
    const a = device(server);
    expect(a.statuses[0]?.status).toBe('connecting');
    await settle();
    expect(a.engine.status).toEqual({ status: 'synced', lastSyncedAt: T0 });

    a.client.setOnline(false); // server unreachable but the OS thinks it is online
    a.store.getState().addBaby({ name: 'x', birthDate: '2026-01-01', sex: 'male' });
    await settle();
    expect(a.engine.status.status).toBe('syncing');
    a.client.setOnline(true);
    await settle();
    expect(a.engine.status.status).toBe('synced');

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    a.client.failNextWrite = new Error('permission-denied');
    a.store.getState().addBaby({ name: 'y', birthDate: '2026-01-01', sex: 'male' });
    await settle();
    expect(a.engine.status.status).toBe('error');
  });

  it('stops uploading after stop()', async () => {
    const server = new FakeServer();
    const a = device(server);
    await settle();
    a.engine.stop();
    const before = server.commits;
    seedLocal(a.store);
    await settle();
    expect(server.commits).toBe(before);
  });
});
