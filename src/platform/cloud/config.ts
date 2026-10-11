/**
 * Public Firebase web config (DESIGN: docs/ACCOUNTS.md §2). Firebase web config is public by design —
 * security comes from `firestore.rules`. Values can be set here or via `VITE_FIREBASE_*` env vars
 * (env wins). Until `apiKey`, `projectId` and `appId` are present, `isCloudConfigured` is false and
 * the app stays local-only (all account UI hidden).
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/** Production project `babymonitor-917c8` (public web config, supplied by the product owner). */
const STATIC_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyBTdiNIjxyhW8cKhgxdJePuekQN6dFkJFo',
  authDomain: 'babymonitor-917c8.firebaseapp.com',
  projectId: 'babymonitor-917c8',
  storageBucket: 'babymonitor-917c8.firebasestorage.app',
  messagingSenderId: '784263944815',
  appId: '1:784263944815:web:e32c7b14fa1056592a8b9a',
};

const env = import.meta.env as Record<string, string | undefined>;
const pick = (key: string, fallback: string): string => env[key]?.trim() || fallback;

export const firebaseConfig: FirebaseWebConfig = {
  apiKey: pick('VITE_FIREBASE_API_KEY', STATIC_CONFIG.apiKey),
  authDomain: pick('VITE_FIREBASE_AUTH_DOMAIN', STATIC_CONFIG.authDomain),
  projectId: pick('VITE_FIREBASE_PROJECT_ID', STATIC_CONFIG.projectId),
  storageBucket: pick('VITE_FIREBASE_STORAGE_BUCKET', STATIC_CONFIG.storageBucket),
  messagingSenderId: pick('VITE_FIREBASE_MESSAGING_SENDER_ID', STATIC_CONFIG.messagingSenderId),
  appId: pick('VITE_FIREBASE_APP_ID', STATIC_CONFIG.appId),
};

/**
 * Local development against the Firebase Emulator Suite: set `VITE_FIREBASE_EMULATORS=1`
 * (host defaults to 127.0.0.1). The project id then defaults to `demo-babymonitor`.
 */
export const emulatorHost: string | null =
  env.VITE_FIREBASE_EMULATORS === '1'
    ? env.VITE_FIREBASE_EMULATOR_HOST?.trim() || '127.0.0.1'
    : null;

export function isConfigComplete(config: FirebaseWebConfig): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

/**
 * `VITE_FIREBASE_DISABLED=1` forces local-only mode (unit tests of the local app, offline builds).
 * The emulator switch still wins so emulator-backed development keeps working.
 */
const forcedOff = env.VITE_FIREBASE_DISABLED === '1';

export const isCloudConfigured: boolean =
  emulatorHost !== null || (!forcedOff && isConfigComplete(firebaseConfig));
