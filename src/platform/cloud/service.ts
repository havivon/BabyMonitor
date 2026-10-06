/**
 * Accounts + family + sync orchestration on Firebase (docs/ACCOUNTS.md). Independent of globals so
 * the integration tests can run two "devices" (two Firebase apps, two stores) side by side;
 * `runtime.ts` wires the production singletons.
 */
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { Connectivity } from './backend';
import { toCloudError } from './errors';
import { createFirestoreBackend } from './firestoreBackend';
import {
  generateInviteCode,
  INVITE_TTL_MS,
  isValidInviteCode,
  normalizeInviteCode,
} from './inviteCode';
import { startSync, type SyncEngine, type SyncStore } from './sync';
import {
  CloudError,
  type CloudActions,
  type CloudState,
  type CloudUser,
  type Family,
  type FamilyMember,
  type Invite,
  type InvitePreview,
  type JoinMode,
} from './types';

export interface CloudServiceDeps {
  auth: Auth;
  db: Firestore;
  store: SyncStore;
  /** Platform Google sign-in (popup on web, native + credential on Android). */
  signInWithGoogle: (auth: Auth) => Promise<void>;
  /** Extra platform sign-out (native Google session). */
  signOutNative?: () => Promise<void>;
  onState: (state: CloudState) => void;
  /** Who started each running (synced) timer: babyId → member (empty without a family). */
  onTimerStarters?: (starters: Record<string, TimerStarter>) => void;
  /** Remembers across launches that a session exists, so Firebase is only loaded when needed. */
  setSessionHint?: (signedIn: boolean) => void;
  connectivity?: Connectivity;
  now?: () => number;
}

/** The parent who started a shared running feed. */
export interface TimerStarter {
  uid: string;
  /** Member name in the family ('' if unknown). */
  name: string;
  isMe: boolean;
}

export interface CloudService extends CloudActions {
  readonly state: CloudState;
  /** Resolves when the current family's first sync pass is done (immediately without a family). */
  whenSynced(): Promise<void>;
  dispose(): void;
}

interface FamilyDoc {
  name?: unknown;
  members?: Record<string, { name?: unknown; joinedAt?: unknown }>;
}

const MAX_NAME = 60;
const OFF: CloudState = {
  ready: false,
  user: null,
  family: null,
  status: 'off',
  lastSyncedAt: null,
};

function toCloudUser(u: User): CloudUser {
  const google = u.providerData.some((p) => p.providerId === 'google.com');
  return {
    uid: u.uid,
    displayName: u.displayName,
    email: u.email,
    provider: google ? 'google' : 'password',
  };
}

function millis(v: unknown): number {
  return v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : 0;
}

function toFamily(id: string, d: FamilyDoc): Family {
  const members: FamilyMember[] = Object.entries(d.members ?? {})
    .map(([uid, m]) => ({
      uid,
      name: typeof m.name === 'string' ? m.name : '',
      joinedAt: millis(m.joinedAt),
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
  return { id, name: typeof d.name === 'string' ? d.name : '', members };
}

/** Clears the shared (family) data from this device; settings stay. */
function clearFamilyData(store: SyncStore): void {
  const s = store.getState();
  store.setState({
    babies: [],
    entries: [],
    measurements: [],
    activeTimers: {},
    settings: { ...s.settings, activeBabyId: null },
  });
}

export function createCloudService(deps: CloudServiceDeps): CloudService {
  const { auth, db, store } = deps;
  const now = deps.now ?? Date.now;
  let state: CloudState = { ...OFF };
  let currentUser: User | null = null;
  let familyId: string | null = null;
  let engine: SyncEngine | null = null;
  let unsubProfile: (() => void) | null = null;
  let unsubFamily: (() => void) | null = null;
  let disposed = false;
  let starterUids: Record<string, string> = {};

  const publishStarters = (): void => {
    if (disposed) return;
    const members = state.family?.members ?? [];
    const out: Record<string, TimerStarter> = {};
    if (familyId) {
      for (const [babyId, uid] of Object.entries(starterUids)) {
        out[babyId] = {
          uid,
          name: members.find((m) => m.uid === uid)?.name ?? '',
          isMe: uid === currentUser?.uid,
        };
      }
    }
    deps.onTimerStarters?.(out);
  };

  const set = (patch: Partial<CloudState>): void => {
    state = { ...state, ...patch };
    if (!disposed) deps.onState(state);
  };

  const stopFamily = (): void => {
    unsubFamily?.();
    unsubFamily = null;
    engine?.stop();
    engine = null;
    if (Object.keys(starterUids).length > 0) {
      starterUids = {};
      publishStarters();
    }
  };

  const memberName = (): string => {
    const u = currentUser;
    return (u?.displayName ?? u?.email?.split('@')[0] ?? 'הורה').slice(0, MAX_NAME);
  };

  /** Starts/stops the family listener + sync engine when the profile's familyId changes. */
  const setFamilyId = (next: string | null): void => {
    if (next === familyId) return;
    stopFamily();
    familyId = next;
    if (!next || !currentUser) {
      set({ family: null, status: 'off', lastSyncedAt: null });
      return;
    }
    const uid = currentUser.uid;
    set({ status: 'connecting' });
    unsubFamily = onSnapshot(
      doc(db, 'families', next),
      (snap) => {
        const data = snap.data() as FamilyDoc | undefined;
        if (!data?.members?.[uid]) {
          // Removed from the family (e.g. left on another device).
          stopFamily();
          set({ family: null, status: 'off' });
          return;
        }
        set({ family: toFamily(snap.id, data) });
        publishStarters(); // member names may have changed
      },
      () => {
        // Not readable any more (not a member): stop syncing, keep the local copy.
        stopFamily();
        set({ family: null, status: 'off' });
      },
    );
    engine = startSync({
      store,
      backend: createFirestoreBackend(db, next, uid),
      connectivity: deps.connectivity,
      now,
      uid,
      onTimerStarters: (starters) => {
        if (familyId !== next) return;
        starterUids = starters;
        publishStarters();
      },
      onStatus: ({ status, lastSyncedAt }) => {
        if (familyId === next) set({ status, lastSyncedAt });
      },
    });
  };

  const ensureProfile = async (u: User): Promise<void> => {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: u.displayName ?? null,
        email: u.email ?? null,
        familyId: null,
        createdAt: serverTimestamp(),
      });
    }
  };

  const onUser = (u: User | null): void => {
    unsubProfile?.();
    unsubProfile = null;
    stopFamily();
    familyId = null;
    currentUser = u;
    if (!u) {
      deps.setSessionHint?.(false);
      set({ ready: true, user: null, family: null, status: 'off', lastSyncedAt: null });
      return;
    }
    deps.setSessionHint?.(true);
    set({ user: toCloudUser(u) });
    ensureProfile(u)
      .catch(() => undefined) // offline first launch: the listener below still works from cache
      .finally(() => {
        if (currentUser !== u) return;
        unsubProfile = onSnapshot(
          doc(db, 'users', u.uid),
          { includeMetadataChanges: true }, // to see the pending → confirmed transition
          (snap) => {
            // Act on confirmed profile changes only: a pending local write of `familyId` (create /
            // join) may reach us before the server has the family membership, and listening to
            // the family that early would be rejected by the rules.
            if (!snap.metadata.hasPendingWrites) {
              const fid: unknown = snap.data()?.familyId;
              setFamilyId(typeof fid === 'string' ? fid : null);
            }
            if (!state.ready) set({ ready: true });
          },
          () => {
            set({ ready: true, status: 'error' });
          },
        );
      });
  };

  const unsubAuth = onAuthStateChanged(auth, onUser);

  const requireUser = (): User => {
    if (!currentUser) throw new CloudError('permission-denied', 'not signed in');
    return currentUser;
  };
  const requireFamily = (): string => {
    requireUser();
    if (!familyId) throw new CloudError('not-in-family');
    return familyId;
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw toCloudError(e);
    }
  };

  const whenSynced = async (): Promise<void> => {
    // Wait for the profile listener to pick up the new familyId and the engine's first pass.
    for (let i = 0; i < 200 && !engine; i++) await new Promise((r) => setTimeout(r, 25));
    await engine?.ready;
  };

  const readInvite = async (rawCode: string) => {
    const code = normalizeInviteCode(rawCode);
    if (!isValidInviteCode(code)) throw new CloudError('invite-not-found');
    const snap = await getDoc(doc(db, 'invites', code));
    const d = snap.data();
    if (!snap.exists() || !d || typeof d.familyId !== 'string')
      throw new CloudError('invite-not-found');
    if (millis(d.expiresAt) <= now()) throw new CloudError('invite-expired');
    return { code, familyId: d.familyId, data: d };
  };

  /** True if the current user can read the family as a member (server check). */
  const isMemberOf = async (fid: string): Promise<boolean> => {
    try {
      const snap = await getDoc(doc(db, 'families', fid));
      return Boolean((snap.data() as FamilyDoc | undefined)?.members?.[requireUser().uid]);
    } catch {
      return false;
    }
  };

  const setMyFamily = (fid: string | null): Promise<void> =>
    setDoc(doc(db, 'users', requireUser().uid), { familyId: fid }, { merge: true });

  return {
    get state() {
      return state;
    },
    whenSynced,
    dispose() {
      disposed = true;
      unsubAuth();
      unsubProfile?.();
      stopFamily();
    },

    signInWithGoogle: () => run(() => deps.signInWithGoogle(auth)),

    signInWithEmail: (email, password) =>
      run(async () => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }),

    signUpWithEmail: (name, email, password) =>
      run(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const displayName = name.trim().slice(0, MAX_NAME);
        if (displayName) {
          await updateProfile(cred.user, { displayName });
          await setDoc(
            doc(db, 'users', cred.user.uid),
            {
              displayName,
              email: cred.user.email ?? null,
              familyId: null,
              createdAt: serverTimestamp(),
            },
            { merge: true },
          );
          if (currentUser?.uid === cred.user.uid) set({ user: toCloudUser(cred.user) });
        }
      }),

    sendPasswordReset: (email) =>
      run(async () => {
        await sendPasswordResetEmail(auth, email.trim());
      }),

    signOut: () =>
      run(async () => {
        const hadFamily = familyId !== null;
        stopFamily();
        familyId = null;
        if (hadFamily) clearFamilyData(store);
        await firebaseSignOut(auth);
        await deps.signOutNative?.();
      }),

    createFamily: (name) =>
      run(async () => {
        const user = requireUser();
        if (familyId) throw new CloudError('already-in-family');
        const familyRef = doc(collection(db, 'families'));
        const batch = writeBatch(db);
        batch.set(familyRef, {
          name: name.trim().slice(0, MAX_NAME) || 'המשפחה שלנו',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          members: { [user.uid]: { name: memberName(), joinedAt: serverTimestamp() } },
        });
        batch.set(doc(db, 'users', user.uid), { familyId: familyRef.id }, { merge: true });
        await batch.commit();
        await whenSynced(); // the first pass uploads the device's data into the new family
      }),

    createInvite: () =>
      run(async (): Promise<Invite> => {
        const fid = requireFamily();
        const user = requireUser();
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = generateInviteCode();
          const ref = doc(db, 'invites', code);
          const existing = await getDoc(ref);
          if (existing.exists()) continue; // codes are never reused (rules forbid updates)
          const expiresAt = now() + INVITE_TTL_MS;
          const s = store.getState();
          await setDoc(ref, {
            familyId: fid,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            expiresAt: Timestamp.fromMillis(expiresAt),
            familyName: state.family?.name ?? '',
            memberNames: (state.family?.members ?? []).map((m) => m.name),
            hasData: s.babies.length > 0 || s.entries.length > 0,
          });
          return { code, expiresAt };
        }
        throw new CloudError('unknown', 'could not allocate an invite code');
      }),

    previewInvite: (rawCode) =>
      run(async (): Promise<InvitePreview> => {
        requireUser();
        const { data } = await readInvite(rawCode);
        return {
          familyName: typeof data.familyName === 'string' ? data.familyName : '',
          memberNames: Array.isArray(data.memberNames)
            ? data.memberNames.filter((n): n is string => typeof n === 'string')
            : [],
          familyHasData: data.hasData === true,
        };
      }),

    joinFamily: (rawCode, mode: JoinMode) =>
      run(async () => {
        const user = requireUser();
        if (familyId) throw new CloudError('already-in-family');
        const { code, familyId: fid } = await readInvite(rawCode);
        await updateDoc(doc(db, 'families', fid), {
          [`members.${user.uid}`]: {
            name: memberName(),
            joinedAt: serverTimestamp(),
            inviteCode: code,
          },
        });
        if (mode === 'replace') clearFamilyData(store);
        await setMyFamily(fid);
        await whenSynced(); // merge: the first pass uploads what this device has (union)
      }),

    retrySync: () =>
      run(async () => {
        requireUser();
        const fid = familyId;
        if (!fid) return;
        // Restart listeners + engine from scratch (e.g. after a permission/network error).
        stopFamily();
        familyId = null;
        setFamilyId(fid);
        await whenSynced();
      }),

    leaveFamily: () =>
      run(async () => {
        const fid = requireFamily();
        const user = requireUser();
        stopFamily(); // keep the local copy; never tombstone it
        familyId = null;
        set({ family: null, status: 'off', lastSyncedAt: null });
        await updateDoc(doc(db, 'families', fid), { [`members.${user.uid}`]: deleteField() }).catch(
          async (e: unknown) => {
            // Retried after it already succeeded (no longer a member → denied): we are out.
            if (await isMemberOf(fid)) throw e;
          },
        );
        await setMyFamily(null);
      }),
  };
}
