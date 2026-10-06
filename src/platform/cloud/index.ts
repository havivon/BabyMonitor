/**
 * Public API of the cloud layer (accounts, family, sync — docs/ACCOUNTS.md). The UI imports only
 * from here. Firebase is loaded lazily: nothing is fetched until the user starts a cloud action, or
 * the app starts on a device that was signed in before (remembered by a small local hint).
 */
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { isCloudConfigured } from './config';
import { toCloudError } from './errors';
import type { CloudService, TimerStarter } from './service';

export type { TimerStarter } from './service';
import { CloudError, type CloudActions, type CloudState } from './types';

export * from './types';
export { isCloudConfigured } from './config';
export {
  INVITE_CODE_LENGTH,
  INVITE_TTL_MS,
  normalizeInviteCode,
  isValidInviteCode,
} from './inviteCode';

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
  service ??= import('./firebaseRuntime')
    .then(({ createRuntime }) =>
      createRuntime({
        onState: (s) => {
          cloudStore.setState(s, true);
        },
        onTimerStarters: (m) => {
          timerStartersStore.setState(m, true);
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

const withService = async <R>(fn: (s: CloudService) => Promise<R>): Promise<R> =>
  fn(await loadService());

export const cloud: CloudActions = {
  signInWithGoogle: () => withService((s) => s.signInWithGoogle()),
  signInWithEmail: (email, password) => withService((s) => s.signInWithEmail(email, password)),
  signUpWithEmail: (name, email, password) =>
    withService((s) => s.signUpWithEmail(name, email, password)),
  sendPasswordReset: (email) => withService((s) => s.sendPasswordReset(email)),
  signOut: () => withService((s) => s.signOut()),
  createFamily: (name) => withService((s) => s.createFamily(name)),
  createInvite: () => withService((s) => s.createInvite()),
  previewInvite: (code) => withService((s) => s.previewInvite(code)),
  joinFamily: (code, mode) => withService((s) => s.joinFamily(code, mode)),
  leaveFamily: () => withService((s) => s.leaveFamily()),
  retrySync: () => withService((s) => s.retrySync()),
};

/** Who started each shared running feed (babyId → starter); empty without a family. */
export const timerStartersStore = createStore<Record<string, TimerStarter>>(() => ({}));

/**
 * The parent who started the running feed of `babyId`, for "התחילה ב-06:52 · נועם".
 * `null` when not in a family or unknown. `isMe` lets the UI omit the name for this parent.
 */
export function useTimerStarter(babyId: string | null | undefined): TimerStarter | null {
  return useStore(timerStartersStore, (m) => (babyId ? (m[babyId] ?? null) : null));
}

initCloud();
