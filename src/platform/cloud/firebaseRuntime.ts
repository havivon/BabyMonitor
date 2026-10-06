/**
 * Production wiring of the cloud layer — loaded lazily (dynamic import) by `index.ts`, so the
 * Firebase SDK never weighs on the local-only app's main bundle.
 */
import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithCredential,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { appStore } from '../../store/hooks';
import { emulatorHost, firebaseConfig } from './config';
import { createCloudService, type CloudService, type TimerStarter } from './service';
import { CloudError, type CloudState } from './types';

/** Google sign-in: native account picker on Android (WebViews block OAuth popups), popup on web. */
async function signInWithGoogle(auth: Auth): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = result.credential?.idToken;
    if (!idToken) throw new CloudError('unknown', 'Google did not return an ID token');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return;
  }
  await signInWithPopup(auth, new GoogleAuthProvider());
}

async function signOutNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  await FirebaseAuthentication.signOut().catch(() => undefined);
}

export interface RuntimeHooks {
  onState: (state: CloudState) => void;
  onTimerStarters: (starters: Record<string, TimerStarter>) => void;
  setSessionHint: (signedIn: boolean) => void;
}

/** Creates the singleton service (Firebase app, auth with persistence, Firestore offline cache). */
export function createRuntime(hooks: RuntimeHooks): CloudService {
  const config = emulatorHost
    ? {
        ...firebaseConfig,
        apiKey: firebaseConfig.apiKey || 'demo-key',
        projectId: firebaseConfig.projectId || 'demo-babymonitor',
      }
    : firebaseConfig;
  const app = initializeApp(config);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  if (emulatorHost) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
  }
  return createCloudService({
    auth,
    db,
    store: appStore,
    signInWithGoogle,
    signOutNative,
    onState: hooks.onState,
    onTimerStarters: hooks.onTimerStarters,
    setSessionHint: hooks.setSessionHint,
  });
}
