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

/** Placeholders — the product owner supplies the real values. */
const STATIC_CONFIG: FirebaseWebConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
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

export const isCloudConfigured: boolean = isConfigComplete(firebaseConfig) || emulatorHost !== null;
