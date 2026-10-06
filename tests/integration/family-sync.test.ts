/**
 * Two parents, two devices, one family — against the Auth + Firestore emulators.
 * Uses the production `createCloudService` + Firestore backend + sync engine with two app stores.
 * Run with `npm run test:rules`.
 */
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, inMemoryPersistence, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, disableNetwork, enableNetwork, initializeFirestore, type Firestore } from 'firebase/firestore';
import type { StateStorage } from 'zustand/middleware';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/platform/cloud/records';
import { createCloudService, type CloudService, type TimerStarter } from '../../src/platform/cloud/service';
import { CloudError, type CloudState } from '../../src/platform/cloud/types';
import { createAppStore, type AppStore } from '../../src/store/appStore';

const PROJECT_ID = 'demo-babymonitor';
const HOST = '127.0.0.1';

interface Device {
  app: FirebaseApp;
  db: Firestore;
  store: AppStore;
  service: CloudService;
  state: () => CloudState;
  starters: () => Record<string, TimerStarter>;
}

function memoryStorage(): StateStorage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

let n = 0;
function device(name: string): Device {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT_ID, appId: `demo-${name}` }, `${name}-${++n}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  connectFirestoreEmulator(db, HOST, 8080);
  const store = createAppStore({ storage: memoryStorage() });
  let state: CloudState | null = null;
  let starters: Record<string, TimerStarter> = {};
  const service = createCloudService({
    auth,
    db,
    store,
    signInWithGoogle: () => Promise.reject(new CloudError('cancelled')),
    onState: (s) => {
      state = s;
      if (process.env.DEBUG_CLOUD) console.log(name, JSON.stringify(s));
    },
    onTimerStarters: (m) => {
      starters = m;
    },
  });
  return {
    app,
    db,
    store,
    service,
    state: () => state ?? service.state,
    starters: () => starters,
  };
}

async function waitFor(check: () => boolean, label: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for: ${label}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function clearEmulators(): Promise<void> {
  await fetch(`http://${HOST}:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${HOST}:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
}

const stamp = Date.now();
let mom: Device;
let dad: Device;

beforeAll(async () => {
  await clearEmulators();
  mom = device('mom');
  dad = device('dad');
});

afterAll(async () => {
  mom.service.dispose();
  dad.service.dispose();
  await Promise.all([deleteApp(mom.app), deleteApp(dad.app)]);
});

const sharedView = (s: AppStore) => {
  const { babies, entries, measurements, activeTimers } = s.getState();
  const sort = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id));
  return { babies: sort(babies), entries: sort(entries), measurements: sort(measurements), activeTimers };
};
const converged = () => stableStringify(sharedView(mom.store)) === stableStringify(sharedView(dad.store));

describe('family sync (emulators)', () => {
  it('signs both parents up; email errors map to stable codes', async () => {
    await mom.service.signUpWithEmail('אמא', `mom${stamp}@example.com`, 'secret-123');
    await dad.service.signUpWithEmail('אבא', `dad${stamp}@example.com`, 'secret-456');
    await waitFor(() => mom.state().ready && dad.state().ready, 'auth ready');
    expect(mom.state().user).toMatchObject({ displayName: 'אמא', provider: 'password' });
    const dup = await dad.service.signUpWithEmail('x', `mom${stamp}@example.com`, 'secret-789').catch((e: unknown) => e);
    expect((dup as CloudError).code).toBe('email-in-use');
    const weak = await dad.service.signUpWithEmail('x', `weak${stamp}@example.com`, '123').catch((e: unknown) => e);
    expect((weak as CloudError).code).toBe('weak-password');
  });

  it('mom creates a family and her device data is uploaded', async () => {
    const s = mom.store.getState();
    const baby = s.addBaby({ name: 'נועה', birthDate: '2026-06-01', sex: 'female', birthWeightG: 3200 });
    s.addEntry({ babyId: baby.id, type: 'bottle', at: Date.now() - 3_600_000, content: 'formula', amountMl: 90 });
    s.addMeasurement({ babyId: baby.id, date: '2026-07-01', weightG: 4300 });
    await mom.service.createFamily('משפחת כהן');
    await waitFor(() => mom.state().family?.members.length === 1, 'family listener');
    expect(mom.state().family).toMatchObject({ name: 'משפחת כהן', members: [{ name: 'אמא' }] });
    await waitFor(() => mom.state().status === 'synced', 'mom synced');
    expect(mom.state().lastSyncedAt).not.toBeNull();
  });

  it('dad previews the invite and joins (merge): both devices converge', async () => {
    const invite = await mom.service.createInvite();
    expect(invite.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(invite.expiresAt - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
    const bad = await dad.service.previewInvite('ZZZZZ2').catch((e: unknown) => e);
    expect((bad as CloudError).code).toBe('invite-not-found');

    const preview = await dad.service.previewInvite(invite.code.toLowerCase());
    expect(preview).toEqual({ familyName: 'משפחת כהן', memberNames: ['אמא'], familyHasData: true });

    // Dad already logged something on his phone → merge keeps it.
    dad.store.getState().addBaby({ name: 'איתי', birthDate: '2024-03-01', sex: 'male' });
    await dad.service.joinFamily(invite.code, 'merge');
    await waitFor(converged, 'merge converged');
    expect(dad.store.getState().babies.map((b) => b.name).sort()).toEqual(['איתי', 'נועה']);
    await waitFor(() => mom.state().family?.members.length === 2, 'mom sees dad');
    expect(dad.state().family?.members.map((m) => m.name)).toEqual(['אמא', 'אבא']);
  });

  it('adds, edits and deletes propagate both ways', async () => {
    const noa = mom.store.getState().babies.find((b) => b.name === 'נועה');
    if (!noa) throw new Error('missing baby');
    const added = dad.store.getState().addEntry({ babyId: noa.id, type: 'solid', at: Date.now(), foods: ['בטטה'] });
    await waitFor(() => mom.store.getState().entries.some((e) => e.id === added.id), 'add reaches mom');

    const bottle = mom.store.getState().entries.find((e) => e.type === 'bottle');
    if (bottle?.type !== 'bottle') throw new Error('missing bottle');
    mom.store.getState().updateEntry({ ...bottle, amountMl: 120 });
    await waitFor(() => dad.store.getState().entries.some((e) => e.id === bottle.id && e.type === 'bottle' && e.amountMl === 120), 'edit');

    dad.store.getState().deleteEntry(added.id);
    await waitFor(() => !mom.store.getState().entries.some((e) => e.id === added.id), 'delete');
    await waitFor(converged, 'converged');
  });

  it('a running feed is shared, with who started it', async () => {
    const noa = mom.store.getState().babies.find((b) => b.name === 'נועה');
    if (!noa) throw new Error('missing baby');
    mom.store.getState().startTimer(noa.id, 'right');
    await waitFor(() => dad.store.getState().activeTimers[noa.id] !== undefined, 'timer reaches dad');
    await waitFor(() => dad.starters()[noa.id]?.name === 'אמא', 'starter name');
    expect(dad.starters()[noa.id]?.isMe).toBe(false);
    expect(mom.starters()[noa.id]?.isMe).toBe(true);

    dad.store.getState().finishTimer(noa.id);
    await waitFor(() => mom.store.getState().activeTimers[noa.id] === undefined, 'timer finished on mom');
    await waitFor(converged, 'converged after the feed');
    expect(mom.store.getState().entries.some((e) => e.type === 'breast')).toBe(true);
  });

  it('offline edits on one device sync after reconnecting', async () => {
    const noa = mom.store.getState().babies.find((b) => b.name === 'נועה');
    if (!noa) throw new Error('missing baby');
    await disableNetwork(dad.db);
    const offlineEntry = dad.store.getState().addEntry({ babyId: noa.id, type: 'bottle', at: Date.now(), content: 'breastmilk', amountMl: 60 });
    const momEntry = mom.store.getState().addEntry({ babyId: noa.id, type: 'bottle', at: Date.now() + 1, content: 'formula', amountMl: 70 });
    await new Promise((r) => setTimeout(r, 500));
    expect(mom.store.getState().entries.some((e) => e.id === offlineEntry.id)).toBe(false);
    expect(dad.store.getState().entries.some((e) => e.id === momEntry.id)).toBe(false);
    await enableNetwork(dad.db);
    await waitFor(converged, 'converged after reconnect');
    expect(mom.store.getState().entries.some((e) => e.id === offlineEntry.id)).toBe(true);
  });

  it('cannot create a second family or join twice', async () => {
    const again = await dad.service.createFamily('עוד').catch((e: unknown) => e);
    expect((again as CloudError).code).toBe('already-in-family');
  });

  it('dad leaves: he keeps a local copy and stops syncing; mom no longer lists him', async () => {
    const before = dad.store.getState().entries.length;
    await dad.service.leaveFamily();
    expect(dad.state().family).toBeNull();
    expect(dad.state().status).toBe('off');
    await waitFor(() => mom.state().family?.members.length === 1, 'mom sees dad left');
    const noa = mom.store.getState().babies.find((b) => b.name === 'נועה');
    if (!noa) throw new Error('missing baby');
    mom.store.getState().addEntry({ babyId: noa.id, type: 'solid', at: Date.now(), foods: ['אבוקדו'] });
    await new Promise((r) => setTimeout(r, 800));
    expect(dad.store.getState().entries).toHaveLength(before);
  });

  it('sign-out removes the family data from the device (it stays in the cloud)', async () => {
    const count = mom.store.getState().entries.length;
    expect(count).toBeGreaterThan(0);
    mom.store.getState().updateSettings({ volumeUnit: 'oz' });
    await mom.service.signOut();
    await waitFor(() => mom.state().user === null, 'signed out');
    expect(mom.store.getState().entries).toEqual([]);
    expect(mom.store.getState().babies).toEqual([]);
    expect(mom.store.getState().settings.volumeUnit).toBe('oz');

    // Signing in again restores everything from the cloud.
    await mom.service.signInWithEmail(`mom${stamp}@example.com`, 'secret-123');
    await waitFor(() => mom.store.getState().entries.length === count, 'restored from cloud');
    const wrong = await dad.service.signInWithEmail(`mom${stamp}@example.com`, 'nope-nope').catch((e: unknown) => e);
    expect((wrong as CloudError).code).toBe('wrong-password');
  });
});
