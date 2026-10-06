/**
 * Controllable fake of `src/platform/cloud` for component tests. Usage in a test file:
 *
 *   vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);
 *   import { fakeCloud } from '../../test/fakeCloud';
 *
 * `fakeCloud.set({...})` changes the state seen by `useCloud()` (re-renders subscribers);
 * `fakeCloud.actions.*` are `vi.fn`s whose behaviour each test sets.
 */
import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';
import {
  CloudError,
  type CloudActions,
  type CloudErrorCode,
  type CloudState,
  type CloudUser,
  type Family,
} from '../platform/cloud/types';

export const SIGNED_OUT: CloudState = {
  ready: true,
  user: null,
  family: null,
  status: 'off',
  lastSyncedAt: null,
};

export const USER: CloudUser = {
  uid: 'u1',
  displayName: 'דנה',
  email: 'dana@example.com',
  provider: 'password',
};

export const FAMILY: Family = {
  id: 'f1',
  name: 'המשפחה של נועה',
  members: [
    { uid: 'u1', name: 'דנה', joinedAt: 1 },
    { uid: 'u2', name: 'יואב', joinedAt: 2 },
  ],
};

let state: CloudState = SIGNED_OUT;
const listeners = new Set<() => void>();

function useCloud(): CloudState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

const ok = (): Promise<void> => Promise.resolve();

function makeActions(): { [K in keyof CloudActions]: ReturnType<typeof vi.fn<CloudActions[K]>> } {
  return {
    signInWithGoogle: vi.fn<CloudActions['signInWithGoogle']>(ok),
    signInWithEmail: vi.fn<CloudActions['signInWithEmail']>(ok),
    signUpWithEmail: vi.fn<CloudActions['signUpWithEmail']>(ok),
    sendPasswordReset: vi.fn<CloudActions['sendPasswordReset']>(ok),
    signOut: vi.fn<CloudActions['signOut']>(ok),
    createFamily: vi.fn<CloudActions['createFamily']>(ok),
    createInvite: vi.fn<CloudActions['createInvite']>(() =>
      Promise.resolve({ code: 'K7Q2MZ', expiresAt: Date.UTC(2026, 9, 12, 10, 0) }),
    ),
    previewInvite: vi.fn<CloudActions['previewInvite']>(() =>
      Promise.resolve({ familyName: FAMILY.name, memberNames: ['דנה'], familyHasData: true }),
    ),
    joinFamily: vi.fn<CloudActions['joinFamily']>(ok),
    leaveFamily: vi.fn<CloudActions['leaveFamily']>(ok),
  };
}

const actions = makeActions();

export const fakeCloud = {
  actions,
  get state(): CloudState {
    return state;
  },
  /** Patches the cloud state and notifies `useCloud()` subscribers. */
  set(patch: Partial<CloudState>): void {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  },
  /** Signed-out state and default (successful) action implementations. */
  reset(): void {
    state = SIGNED_OUT;
    const fresh = makeActions();
    for (const key of Object.keys(actions) as (keyof CloudActions)[]) {
      actions[key].mockReset();
      // Re-install the default implementation (vi.fn type differs per key; same runtime shape).
      (actions[key] as ReturnType<typeof vi.fn>).mockImplementation(
        fresh[key].getMockImplementation() as (...args: unknown[]) => unknown,
      );
    }
    for (const l of listeners) l();
  },
  /** A rejection with a `CloudError` of `code`. */
  fail(code: CloudErrorCode): Promise<never> {
    return Promise.reject(new CloudError(code));
  },
};

/** Module replacement for `vi.mock('…/platform/cloud', …)`. */
export const cloudModule = {
  isCloudConfigured: true,
  useCloud,
  cloud: actions as CloudActions,
  CloudError,
};
