/**
 * Security rules tests (docs/ACCOUNTS.md §5) against the Firestore emulator.
 * Run with `npm run test:rules` (starts the emulators via `firebase emulators:exec`).
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-babymonitor';
const FID = 'fam1';
const DAY = 86_400_000;

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  // Seed: family with member "mom", one entry, a valid invite and an expired invite.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'families', FID), {
      name: 'משפחה',
      createdBy: 'mom',
      createdAt: Timestamp.now(),
      members: { mom: { name: 'אמא', joinedAt: Timestamp.now() } },
    });
    await setDoc(doc(db, 'families', FID, 'entries', 'e1'), {
      v: 1,
      data: { id: 'e1' },
      deleted: false,
      updatedAt: Timestamp.now(),
      updatedBy: 'mom',
    });
    await setDoc(doc(db, 'invites', 'ABCD23'), {
      familyId: FID,
      createdBy: 'mom',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * DAY),
      familyName: 'משפחה',
      memberNames: ['אמא'],
      hasData: true,
    });
    await setDoc(doc(db, 'invites', 'QLDCDE'), {
      familyId: FID,
      createdBy: 'mom',
      createdAt: Timestamp.fromMillis(Date.now() - 9 * DAY),
      expiresAt: Timestamp.fromMillis(Date.now() - 2 * DAY),
      familyName: 'משפחה',
      memberNames: ['אמא'],
      hasData: true,
    });
    await setDoc(doc(db, 'families', 'other'), {
      name: 'אחרת',
      createdBy: 'stranger',
      createdAt: Timestamp.now(),
      members: { stranger: { name: 'זר', joinedAt: Timestamp.now() } },
    });
  });
});

const as = (uid: string | null): Firestore => {
  const ctx: RulesTestContext = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return ctx.firestore() as unknown as Firestore;
};

const syncDoc = (uid: string, data: Record<string, unknown> | null) => ({
  v: 1,
  data,
  deleted: data === null,
  updatedAt: serverTimestamp(),
  updatedBy: uid,
});

describe('users/{uid}', () => {
  it('only the owner can read and write their profile', async () => {
    await assertSucceeds(
      setDoc(doc(as('dad'), 'users', 'dad'), {
        displayName: 'אבא',
        email: 'd@x.y',
        familyId: null,
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(as('dad'), 'users', 'dad')));
    await assertFails(getDoc(doc(as('mom'), 'users', 'dad')));
    await assertFails(setDoc(doc(as('mom'), 'users', 'dad'), { displayName: 'x' }));
    await assertFails(getDoc(doc(as(null), 'users', 'dad')));
    await assertFails(getDocs(collection(as('dad'), 'users')));
  });

  it('rejects unknown fields', async () => {
    await assertFails(
      setDoc(doc(as('dad'), 'users', 'dad'), { displayName: 'אבא', isAdmin: true }),
    );
  });
});

describe('families and their data', () => {
  it('a non-member cannot read or write the family or its data', async () => {
    const db = as('dad');
    await assertFails(getDoc(doc(db, 'families', FID)));
    await assertFails(getDocs(collection(db, 'families', FID, 'entries')));
    await assertFails(getDoc(doc(db, 'families', FID, 'entries', 'e1')));
    await assertFails(
      setDoc(doc(db, 'families', FID, 'entries', 'e2'), syncDoc('dad', { id: 'e2' })),
    );
    await assertFails(getDocs(collection(db, 'families')));
    await assertFails(getDoc(doc(as(null), 'families', FID)));
  });

  it('a member can read and write synced records with valid meta', async () => {
    const db = as('mom');
    await assertSucceeds(getDoc(doc(db, 'families', FID)));
    await assertSucceeds(getDocs(collection(db, 'families', FID, 'entries')));
    await assertSucceeds(
      setDoc(
        doc(db, 'families', FID, 'entries', 'e2'),
        syncDoc('mom', { id: 'e2', type: 'bottle' }),
      ),
    );
    await assertSucceeds(setDoc(doc(db, 'families', FID, 'entries', 'e2'), syncDoc('mom', null))); // tombstone
    await assertSucceeds(
      setDoc(doc(db, 'families', FID, 'timers', 'b1'), {
        ...syncDoc('mom', { babyId: 'b1', segments: [] }),
        startedBy: 'mom',
      }),
    );
  });

  it('rejects malformed synced records', async () => {
    const db = as('mom');
    const ref = doc(db, 'families', FID, 'entries', 'e3');
    await assertFails(setDoc(ref, syncDoc('dad', { id: 'e3' }))); // updatedBy must be the caller
    await assertFails(setDoc(ref, syncDoc('mom', { id: 'other' }))); // id must match the doc id
    await assertFails(
      setDoc(ref, { ...syncDoc('mom', { id: 'e3' }), updatedAt: Timestamp.fromMillis(0) }),
    );
    await assertFails(setDoc(ref, { ...syncDoc('mom', { id: 'e3' }), extra: 1 }));
    await assertFails(setDoc(ref, { ...syncDoc('mom', { id: 'e3' }), deleted: true })); // tombstone with data
    await assertFails(setDoc(ref, { ...syncDoc('mom', { id: 'e3' }), startedBy: 'mom' })); // startedBy only on timers
    await assertFails(
      setDoc(doc(db, 'families', FID, 'secrets', 'x'), syncDoc('mom', { id: 'x' })),
    );
    await assertFails(
      setDoc(doc(db, 'families', FID, 'timers', 'b1'), syncDoc('mom', { babyId: 'b2' })),
    );
  });

  it('only tombstones may be hard-deleted', async () => {
    const db = as('mom');
    await assertFails(deleteDoc(doc(as('mom'), 'families', FID, 'entries', 'e1')));
    await setDoc(doc(db, 'families', FID, 'entries', 'e1'), syncDoc('mom', null));
    await assertSucceeds(deleteDoc(doc(as('mom'), 'families', FID, 'entries', 'e1')));
  });

  it('create: the creator must be the only member', async () => {
    const db = as('dad');
    const fam = (members: Record<string, unknown>) => ({
      name: 'שלנו',
      createdBy: 'dad',
      createdAt: serverTimestamp(),
      members,
    });
    await assertSucceeds(
      setDoc(doc(db, 'families', 'f2'), fam({ dad: { name: 'אבא', joinedAt: serverTimestamp() } })),
    );
    await assertFails(
      setDoc(
        doc(db, 'families', 'f3'),
        fam({
          dad: { name: 'אבא', joinedAt: serverTimestamp() },
          mom: { name: 'אמא', joinedAt: serverTimestamp() },
        }),
      ),
    );
    await assertFails(
      setDoc(doc(db, 'families', 'f4'), {
        ...fam({ dad: { name: 'אבא', joinedAt: serverTimestamp() } }),
        createdBy: 'mom',
      }),
    );
  });
});

describe('joining with an invite', () => {
  const join = (uid: string, code: string, fid = FID) =>
    updateDoc(doc(as(uid), 'families', fid), {
      [`members.${uid}`]: { name: 'אבא', joinedAt: serverTimestamp(), inviteCode: code },
    });

  it('succeeds only with a valid, unexpired invite of this family, adding only the caller', async () => {
    await assertFails(join('dad', 'QLDCDE')); // expired
    await assertFails(join('dad', 'ZZZZZ2')); // missing
    await assertFails(join('dad', 'ABCD23', 'other')); // invite of another family
    await assertFails(
      updateDoc(doc(as('dad'), 'families', FID), {
        'members.dad': { name: 'אבא', joinedAt: serverTimestamp(), inviteCode: 'ABCD23' },
        'members.eve': { name: 'איב', joinedAt: serverTimestamp(), inviteCode: 'ABCD23' },
      }),
    );
    await assertFails(
      updateDoc(doc(as('dad'), 'families', FID), {
        'members.dad': { name: 'אבא', joinedAt: serverTimestamp(), inviteCode: 'ABCD23' },
        name: 'נחטף',
      }),
    );
    await assertSucceeds(join('dad', 'ABCD23'));
    await assertSucceeds(getDocs(collection(as('dad'), 'families', FID, 'entries')));
  });

  it('a member cannot remove or edit another member', async () => {
    await assertSucceeds(join('dad', 'ABCD23'));
    await assertFails(updateDoc(doc(as('dad'), 'families', FID), { 'members.mom': deleteField() }));
    await assertFails(updateDoc(doc(as('dad'), 'families', FID), { 'members.mom.name': 'x' }));
  });
});

describe('leaving', () => {
  it('a member may remove only themself', async () => {
    await assertSucceeds(
      updateDoc(doc(as('mom'), 'families', FID), { 'members.mom': deleteField() }),
    );
    await assertFails(getDoc(doc(as('mom'), 'families', FID, 'entries', 'e1')));
  });

  it('a member who joined with an invite can leave', async () => {
    await assertSucceeds(
      updateDoc(doc(as('dad'), 'families', FID), {
        'members.dad': { name: 'אבא', joinedAt: serverTimestamp(), inviteCode: 'ABCD23' },
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as('dad'), 'families', FID), { 'members.dad': deleteField() }),
    );
  });

  it('a non-member cannot "leave" (or remove) anyone', async () => {
    await assertFails(updateDoc(doc(as('dad'), 'families', FID), { 'members.mom': deleteField() }));
  });
});

describe('invites', () => {
  const invite = (uid: string, fid: string, expiresInMs = 7 * DAY) => ({
    familyId: fid,
    createdBy: uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + expiresInMs),
    familyName: 'משפחה',
    memberNames: ['אמא'],
    hasData: false,
  });

  it('exact-code get by any signed-in user; never listable; not anonymous', async () => {
    await assertSucceeds(getDoc(doc(as('dad'), 'invites', 'ABCD23')));
    await assertFails(getDocs(collection(as('dad'), 'invites')));
    await assertFails(getDocs(collection(as('mom'), 'invites')));
    await assertFails(getDoc(doc(as(null), 'invites', 'ABCD23')));
  });

  it('only family members create invites, with a valid code and ≤ 7-day expiry', async () => {
    await assertSucceeds(setDoc(doc(as('mom'), 'invites', 'EFGH45'), invite('mom', FID)));
    await assertFails(setDoc(doc(as('dad'), 'invites', 'EFGH46'), invite('dad', FID))); // not a member
    await assertFails(setDoc(doc(as('mom'), 'invites', 'EFGH4O'), invite('mom', FID))); // look-alike char
    await assertFails(setDoc(doc(as('mom'), 'invites', 'EFGH47'), invite('mom', FID, 30 * DAY))); // too long
    await assertFails(setDoc(doc(as('mom'), 'invites', 'ABCD23'), invite('mom', FID))); // no overwrite
  });

  it('only members delete invites', async () => {
    await assertFails(deleteDoc(doc(as('dad'), 'invites', 'ABCD23')));
    await assertSucceeds(deleteDoc(doc(as('mom'), 'invites', 'ABCD23')));
  });
});
