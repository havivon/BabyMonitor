/**
 * Unit tests of the cloud service against minimal in-memory fakes of `firebase/auth` and
 * `firebase/firestore` (the emulator suites in tests/ cover the real SDK + rules).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { SyncStore } from './sync';
import { CloudError, type CloudState } from './types';

// ------------------------------------------------------------------ fakes
type Data = Record<string, unknown>;
interface Listener {
  path: string;
  next: (snap: unknown) => void;
  error?: (e: unknown) => void;
  active: boolean;
}
const fake = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  listeners: [] as Listener[],
  writes: [] as { op: string; path: string; data: unknown }[],
  failUpdate: null as null | ((path: string, data: unknown) => Error | null),
  authCb: null as null | ((u: unknown) => void),
  profiles: [] as unknown[],
  syncStarts: [] as string[],
  syncStops: 0,
}));
const DELETE = Symbol('deleteField');

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    fake.authCb = cb;
    return () => undefined;
  },
  updateProfile: (_u: unknown, p: unknown) => {
    fake.profiles.push(p);
    return Promise.resolve();
  },
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: () => Promise.resolve(),
}));

function snap(path: string, fromCache = false) {
  const data = fake.docs.get(path);
  return {
    id: path.split('/').pop(),
    exists: () => data !== undefined,
    data: () => (data ? structuredClone(data) : undefined),
    metadata: { hasPendingWrites: false, fromCache },
  };
}
function setPath(target: Data, dotted: string, value: unknown): void {
  const keys = dotted.split('.');
  const last = keys.pop() ?? '';
  let obj = target;
  for (const k of keys) {
    obj[k] ??= {};
    obj = obj[k] as Data;
  }
  if (value === DELETE) Reflect.deleteProperty(obj, last);
  else obj[last] = value;
}
function emit(path: string): void {
  for (const l of fake.listeners) if (l.active && l.path === path) l.next(snap(path));
}

vi.mock('firebase/firestore', () => {
  class Timestamp {
    private readonly ms: number;
    constructor(ms: number) {
      this.ms = ms;
    }
    static fromMillis(ms: number) {
      return new Timestamp(ms);
    }
    toMillis() {
      return this.ms;
    }
  }
  return {
    Timestamp,
    doc: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
    collection: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
    deleteField: () => DELETE,
    serverTimestamp: () => Timestamp.fromMillis(1000),
    getDoc: (ref: { path: string }) => Promise.resolve(snap(ref.path)),
    setDoc: (ref: { path: string }, data: Data) => {
      fake.writes.push({ op: 'set', path: ref.path, data });
      fake.docs.set(ref.path, { ...(fake.docs.get(ref.path) ?? {}), ...data });
      emit(ref.path);
      return Promise.resolve();
    },
    updateDoc: (ref: { path: string }, data: Data) => {
      fake.writes.push({ op: 'update', path: ref.path, data });
      const err = fake.failUpdate?.(ref.path, data);
      if (err) return Promise.reject(err);
      const d = structuredClone(fake.docs.get(ref.path) ?? {});
      for (const [k, v] of Object.entries(data)) setPath(d, k, v);
      fake.docs.set(ref.path, d);
      emit(ref.path);
      return Promise.resolve();
    },
    writeBatch: vi.fn(),
    onSnapshot: (ref: { path: string }, ...args: unknown[]) => {
      const fns = args.filter((a) => typeof a === 'function') as [
        (s: unknown) => void,
        ((e: unknown) => void)?,
      ];
      const l: Listener = { path: ref.path, next: fns[0], error: fns[1], active: true };
      fake.listeners.push(l);
      queueMicrotask(() => {
        if (l.active) l.next(snap(ref.path));
      });
      return () => {
        l.active = false;
      };
    },
  };
});

vi.mock('./firestoreBackend', () => ({ createFirestoreBackend: () => ({}) }));
vi.mock('./sync', () => ({
  startSync: (opts: { backend: unknown; uid: string }) => {
    fake.syncStarts.push(opts.uid);
    return {
      ready: Promise.resolve(),
      status: { status: 'synced', lastSyncedAt: 1 },
      stop: () => {
        fake.syncStops++;
      },
    };
  },
}));

const { createCloudService, cleanName, toFamily } = await import('./service');

// ------------------------------------------------------------------ helpers
const FID = 'fam1';
const user = (uid: string, displayName = 'אמא') =>
  ({ uid, displayName, email: `${uid}@x.y`, providerData: [] }) as unknown as User;

function family(members: string[], createdBy = 'mom'): Data {
  return {
    name: 'משפחה',
    createdBy,
    members: Object.fromEntries(
      members.map((m, i) => [m, { name: m === 'mom' ? 'אמא' : 'אבא', joinedAt: i }]),
    ),
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

const storeState = { babies: [{ id: 'b1' }], entries: [{ id: 'e1' }] };
const setState = vi.fn();
const store = {
  getState: () => storeState,
  setState,
  subscribe: () => () => undefined,
} as unknown as SyncStore;

async function start(uid = 'mom', familyId: string | null = FID) {
  fake.docs.set(`users/${uid}`, { displayName: 'x', familyId });
  let state: CloudState | null = null;
  const service = createCloudService({
    auth: {} as Auth,
    db: {} as Firestore,
    store,
    signInWithGoogle: () => Promise.resolve(),
    onState: (s) => {
      state = s;
    },
  });
  fake.authCb?.(user(uid));
  await flush();
  return { service, state: () => state ?? service.state };
}

beforeEach(() => {
  fake.docs.clear();
  fake.listeners.length = 0;
  fake.writes.length = 0;
  fake.profiles.length = 0;
  fake.syncStarts.length = 0;
  fake.syncStops = 0;
  fake.failUpdate = null;
  fake.authCb = null;
  setState.mockClear();
});

// ------------------------------------------------------------------ tests
describe('helpers', () => {
  it('cleanName trims, collapses spaces, caps at 60 and rejects empty', () => {
    expect(cleanName('  בית   כהן ')).toBe('בית כהן');
    expect(cleanName('x'.repeat(80))).toHaveLength(60);
    expect(() => cleanName('   ')).toThrow(CloudError);
  });

  it('toFamily exposes createdBy (empty when missing)', () => {
    expect(toFamily('f', family(['mom', 'dad'])).createdBy).toBe('mom');
    expect(toFamily('f', { name: 'x' })).toEqual({
      id: 'f',
      name: 'x',
      createdBy: '',
      members: [],
    });
  });
});

describe('family editing', () => {
  it('renameFamily writes the cleaned name; rejects empty names and no family', async () => {
    fake.docs.set(`families/${FID}`, family(['mom']));
    const { service, state } = await start();
    expect(state().family?.createdBy).toBe('mom');
    await service.renameFamily('  בית  כהן ');
    expect(fake.writes.at(-1)).toEqual({
      op: 'update',
      path: `families/${FID}`,
      data: { name: 'בית כהן' },
    });
    await flush();
    expect(state().family?.name).toBe('בית כהן');
    await expect(service.renameFamily('  ')).rejects.toBeInstanceOf(CloudError);

    const solo = await start('dad', null);
    await expect(solo.service.renameFamily('x')).rejects.toMatchObject({ code: 'not-in-family' });
  });

  it('updateMyName updates only my member name + profile + auth display name', async () => {
    fake.docs.set(`families/${FID}`, family(['mom', 'dad']));
    const { service, state } = await start('dad');
    await service.updateMyName(' אבי ');
    expect(fake.writes).toContainEqual({
      op: 'update',
      path: `families/${FID}`,
      data: { 'members.dad.name': 'אבי' },
    });
    expect(fake.writes).toContainEqual({
      op: 'set',
      path: 'users/dad',
      data: { displayName: 'אבי' },
    });
    expect(fake.profiles).toEqual([{ displayName: 'אבי' }]);
    expect(state().user?.displayName).toBe('אבי');
    expect(fake.docs.get(`families/${FID}`)).toMatchObject({
      members: { dad: { name: 'אבי', joinedAt: 1 }, mom: { name: 'אמא' } },
    });
  });

  it('updateMyName without a family only updates the profile', async () => {
    const { service } = await start('dad', null);
    await service.updateMyName('אבי');
    expect(fake.writes.filter((w) => w.path.startsWith('families/'))).toEqual([]);
    expect(fake.profiles).toEqual([{ displayName: 'אבי' }]);
  });

  it('removeMember: creator only, never self, only existing members', async () => {
    fake.docs.set(`families/${FID}`, family(['mom', 'dad']));
    const dad = await start('dad');
    await expect(dad.service.removeMember('mom')).rejects.toMatchObject({
      code: 'permission-denied',
    });

    const mom = await start('mom');
    await expect(mom.service.removeMember('mom')).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(mom.service.removeMember('eve')).rejects.toMatchObject({
      code: 'not-in-family',
    });
    await mom.service.removeMember('dad');
    expect(fake.docs.get(`families/${FID}`)?.members).not.toHaveProperty('dad');
  });

  it('removeMember tolerates a retried write that already removed the member', async () => {
    fake.docs.set(`families/${FID}`, family(['mom', 'dad']));
    const { service } = await start('mom');
    fake.failUpdate = (path) => {
      // The first attempt landed, then the client reports a failure.
      const d = fake.docs.get(path) as { members: Data };
      Reflect.deleteProperty(d.members, 'dad');
      return Object.assign(new Error('denied'), { code: 'permission-denied' });
    };
    await expect(service.removeMember('dad')).resolves.toBeUndefined();
  });
});

describe('losing the family', () => {
  it('removed by the creator (uid missing): local-only, data kept, profile cleared, no retry', async () => {
    fake.docs.set(`families/${FID}`, family(['mom', 'dad']));
    const { state } = await start('dad');
    expect(state().family?.members).toHaveLength(2);
    expect(fake.syncStarts).toEqual(['dad']);

    fake.docs.set(`families/${FID}`, family(['mom']));
    emit(`families/${FID}`);
    await flush();
    expect(state()).toMatchObject({ family: null, status: 'off', lastSyncedAt: null });
    expect(fake.syncStops).toBe(1);
    expect(setState).not.toHaveBeenCalled(); // local copy untouched
    expect(fake.docs.get('users/dad')?.familyId).toBeNull();
    // The profile write echoes back; nothing re-attaches.
    await flush();
    expect(fake.syncStarts).toEqual(['dad']);
    expect(fake.listeners.filter((l) => l.active && l.path.startsWith('families/'))).toEqual([]);
  });

  it('permission-denied on the family listener is treated like leaving', async () => {
    fake.docs.set(`families/${FID}`, family(['mom', 'dad']));
    const { state } = await start('dad');
    const l = fake.listeners.find((x) => x.active && x.path === `families/${FID}`);
    l?.error?.(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    await flush();
    expect(state()).toMatchObject({ family: null, status: 'off' });
    expect(fake.docs.get('users/dad')?.familyId).toBeNull();
  });

  it('a stale profile from an earlier session recovers the same way on startup', async () => {
    fake.docs.set(`families/${FID}`, family(['mom'])); // dad is no longer a member
    const { state } = await start('dad');
    expect(state()).toMatchObject({ ready: true, family: null, status: 'off' });
    expect(fake.docs.get('users/dad')?.familyId).toBeNull();
  });

  it('a profile that still points at the lost family (cleanup failed) never re-attaches', async () => {
    fake.docs.set(`families/${FID}`, family(['mom']));
    const { state } = await start('dad');
    fake.docs.set('users/dad', { familyId: FID });
    emit('users/dad');
    await flush();
    expect(state().family).toBeNull();
    expect(fake.syncStarts).toEqual(['dad']); // only the initial attempt
    expect(fake.listeners.filter((l) => l.active && l.path.startsWith('families/'))).toEqual([]);
  });

  it('a cache-only snapshot without the family does not count as removal', async () => {
    fake.docs.set(`families/${FID}`, family(['mom', 'dad']));
    const { state } = await start('dad');
    const l = fake.listeners.find((x) => x.active && x.path === `families/${FID}`);
    l?.next({ id: FID, data: () => undefined, metadata: { fromCache: true } });
    await flush();
    expect(state().family).not.toBeNull();
    expect(fake.docs.get('users/dad')?.familyId).toBe(FID);
  });

  it('other listener errors show an error status but keep the family', async () => {
    fake.docs.set(`families/${FID}`, family(['mom', 'dad']));
    const { state } = await start('dad');
    const l = fake.listeners.find((x) => x.active && x.path === `families/${FID}`);
    l?.error?.(Object.assign(new Error('boom'), { code: 'internal' }));
    await flush();
    expect(state().status).toBe('error');
    expect(fake.docs.get('users/dad')?.familyId).toBe(FID);
  });
});
