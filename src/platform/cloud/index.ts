/**
 * Public API of the cloud layer (accounts, family, sync — docs/ACCOUNTS.md). The UI imports only
 * from here. Firebase is loaded lazily: nothing is fetched until the user starts a cloud action, or
 * the app starts on a device that was signed in before (remembered by a small local hint).
 */
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { isCloudConfigured } from './config';
import { toCloudError } from './errors';
import type { CloudService } from './service';
import { CloudError, type CloudActions, type CloudState } from './types';

export * from './types';
export { isCloudConfigured } from './config';
export { INVITE_CODE_LENGTH, INVITE_TTL_MS, normalizeInviteCode, isValidInviteCode } from './inviteCode';

/** localStorage flag: "a Firebase session exists on this device" (no tokens, just a hint). */
export const SESSION_HINT_KEY = 'babymonitor:cloud-session';

function readHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}
function writeHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* storage unavailable: Firebase still keeps its own session */
  }
}

const restoring = isCloudConfigured && readHint();

/** Cloud state for the UI. `ready` is false only while a remembered session is being restored. */
export const cloudStore = createStore<CloudState>(() => ({
  ready: !restoring,
  user: null,
  family: null,
  status: 'off',
  lastSyncedAt: null,
}));

let service: Promise<CloudService> | null = null;

/** Loads Firebase and starts the service (once). */
function loadService(): Promise<CloudService> {
  if (!isCloudConfigured) return Promise.reject(new CloudError('not-configured'));
  service ??= import('./runtime')
    .then(({ createRuntime }) =>
      createRuntime({
        onState: (s) => {
          cloudStore.setState(s, true);
        },
        setSessionHint: writeHint,
      }),
    )
    .catch((e: unknown) => {
      service = null;
      cloudStore.setState({ ready: true });
      throw toCloudError(e);
    });
  return service;
}

/** Restores a remembered session at startup (no-op otherwise). Safe to call more than once. */
export function initCloud(): void {
  if (restoring) void loadService().catch(() => undefined);
}

/** Current cloud state (re-renders on change). */
export function useCloud(): CloudState {
  return useStore(cloudStore);
}

const call =
  <A extends unknown[], R>(pick: (s: CloudService) => (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    const s = await loadService();
    return pick(s)(...args);
  };

export const cloud: CloudActions = {
  signInWithGoogle: call((s) => s.signInWithGoogle),
  signInWithEmail: call((s) => s.signInWithEmail),
  signUpWithEmail: call((s) => s.signUpWithEmail),
  sendPasswordReset: call((s) => s.sendPasswordReset),
  signOut: call((s) => s.signOut),
  createFamily: call((s) => s.createFamily),
  createInvite: call((s) => s.createInvite),
  previewInvite: call((s) => s.previewInvite),
  joinFamily: call((s) => s.joinFamily),
  leaveFamily: call((s) => s.leaveFamily),
};

initCloud();
