# Accounts & family sync — architecture decision (Team Lead)

Status: approved for build · Owner decisions confirmed by the product owner:
**shared family** (each parent has their own login, joins with an invite code) · sign-in with
**Google or email+password** · **sign-in is optional**, with a clear note explaining its benefits.

## 1. Goals

- Data is never lost: backed up in the cloud, restored on a new phone.
- Both parents see and add to the same data, live, from their own phones.
- Works offline exactly as today; changes sync when back online.
- Without signing in, the app behaves exactly as v1 (local only) — no regressions.

## 2. Platform

**Firebase** (free Spark plan): Authentication (Email/Password + Google) and Cloud Firestore with
offline persistence (`persistentLocalCache` / IndexedDB). JS SDK `firebase@12` (modular, tree-shaken,
lazy-loaded so the local-only app pays nothing until the user opens the account screen or is signed in).

- **Config**: `src/platform/cloud/config.ts` exports the public web config (apiKey, authDomain,
  projectId, appId…). Firebase web config is public by design; security comes from the rules.
  Until the product owner supplies it, `isCloudConfigured === false` and all account UI is hidden.
- **Google sign-in**: web/PWA → `signInWithPopup`. Android APK (Capacitor WebView, where Google blocks
  OAuth popups) → native Google sign-in via `@capacitor-firebase/authentication`
  (`skipNativeAuth: true`), then `signInWithCredential(GoogleAuthProvider.credential(idToken))` in the
  JS SDK, so a single JS auth state drives everything. Needs `android/app/google-services.json` and the
  APK signing SHA-1 registered in Firebase (product owner action).
- **Local dev & tests** use the Firebase Emulator Suite (`firebase-tools`, project id
  `demo-babymonitor`, no real project needed): `npm run emulators`. Unit tests of the sync engine use
  an in-memory fake of the `CloudBackend` interface; integration + rules tests run against the
  emulators.

## 3. Data model (Firestore)

```
users/{uid}                     { displayName, email, familyId: string|null, createdAt }
families/{familyId}             { name, createdBy, createdAt, members: { [uid]: { name, joinedAt } } }
families/{familyId}/babies/{id}        Baby        + meta
families/{familyId}/entries/{id}       FeedingEntry + meta
families/{familyId}/measurements/{id}  Measurement + meta
families/{familyId}/timers/{babyId}    ActiveTimer  + meta   (a running feed is visible to both parents)
invites/{code}                  { familyId, createdBy, createdAt, expiresAt }   (code: 6 chars, A–Z2–9 without look-alikes, 7-day expiry)
```

`meta = { updatedAt: serverTimestamp, updatedBy: uid, deleted?: true }`. Deletes are **tombstones**
(`deleted: true`) so a delete made offline on one phone can't be resurrected by the other phone's
stale copy; tombstones older than 30 days may be purged.

Device-local only (never synced): `settings` (units, theme), `activeBabyId`, dismissed hints.

## 4. Sync engine (`src/platform/cloud/sync.ts`)

- The Zustand store stays the single source of truth for the UI; all screens keep working unchanged.
- **Down**: `onSnapshot` listeners on the 4 family collections → apply remote docs into the store
  (upsert / remove on tombstone) without echoing them back up.
- **Up**: a store subscription diffs babies/entries/measurements/timers by id against the last
  synced state and writes changed docs (`setDoc` with meta) / tombstones for removed ids.
  Firestore's offline queue handles retries.
- **Conflicts**: last-write-wins per document (by server `updatedAt`). Entries are append-mostly, so
  real conflicts are rare; the running timer doc is the one hot spot and LWW is correct for it.
- **Status** exposed for the UI: `'off' | 'connecting' | 'synced' | 'syncing' | 'offline' | 'error'`.
- **First sign-in / joining**: the device may already hold local data.
  - Creating a family → upload all local data into it.
  - Joining a family that has data while the device has local data → ask: "מיזוג הנתונים מהמכשיר
    למשפחה" (merge, ids are unique so it's a union) or "שימוש בנתוני המשפחה בלבד" (discard local,
    after offering a JSON backup download).
- **Sign-out**: confirm; the family's data is removed from this device (it stays in the cloud).
- The existing local backup/export features keep working regardless of sign-in.

## 5. Security rules (`firestore.rules`, tested with `@firebase/rules-unit-testing`)

- `users/{uid}`: read/write only by `uid`.
- `families/{fid}` and subcollections: read/write only if `request.auth.uid in resource.data.members`
  (subcollections via `get(families/fid)`).
- Create family: creator must be the only member. Join: an update that **only adds the caller** to
  `members`, and the written member entry carries `inviteCode` whose `invites/{code}` doc points to
  this family and is not expired. Leave: a member may remove only themselves.
- `invites/{code}`: create by a family member; `get` by any signed-in user (exact code only, no
  `list`); delete by a family member.
- Field validation on writes (types, sizes) to keep the data well-formed.

## 6. UX (designer to finalize copy & visuals in DESIGN.md)

- **Not signed in** (product owner, 6 Oct): the user must be told plainly that **the data is not
  backed up** — e.g. "הנתונים שמורים רק בטלפון הזה ואינם מגובים. התחברות שומרת גיבוי בענן, מאפשרת
  לשני ההורים לעדכן יחד, ומשחזרת הכול בטלפון חדש." A calm, dismissible note on Home (after the first
  logged feed; re-shown after ~2 weeks if still signed out) and a persistent card at the top of
  Settings. CTA "התחברות".
- **Security posture** (product owner asked): the app never handles Google passwords (OAuth via
  Google's own screen); email/password credentials are held only by Firebase Auth (hashed). The app
  stores no secrets; the device keeps only Firebase's session token. Family data is protected by the
  Firestore rules (§5), which must be covered by automated tests.
- **Onboarding**: secondary action "כבר יש לנו חשבון — התחברות" (new phone / second parent).
- **Sign-in sheet**: "המשך עם Google" + email/password (sign in / create account / forgot password),
  Hebrew error messages for every Firebase error code.
- **Settings → "חשבון ומשפחה"**: account (name, email, sign out), family (members list, invite:
  code + share via Web Share / copy, join with code, leave family), sync status line.
- **Header**: a small sync-status indicator (only when signed in; offline/error visible, synced subtle).
