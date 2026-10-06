/**
 * Contract between the cloud layer (accounts, family, sync — engineer #1) and the UI (engineer #2).
 * See docs/ACCOUNTS.md. Changing this file requires the team lead's approval.
 */

/** Sync state shown in the header / settings. `off` = not signed in or no family. */
export type SyncStatus = 'off' | 'connecting' | 'synced' | 'syncing' | 'offline' | 'error';

export interface CloudUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  provider: 'google' | 'password';
}

export interface FamilyMember {
  uid: string;
  name: string;
  joinedAt: number; // epoch ms
}

export interface Family {
  id: string;
  name: string;
  members: FamilyMember[];
}

export interface Invite {
  code: string;
  expiresAt: number; // epoch ms
}

/** What a user sees before confirming a join. */
export interface InvitePreview {
  familyName: string;
  memberNames: string[];
  /** The family already holds babies/entries — the UI must ask merge vs replace if the device has data too. */
  familyHasData: boolean;
}

/** `merge` = union of device + family data; `replace` = drop the device data, keep the family's. */
export type JoinMode = 'merge' | 'replace';

/** Stable error codes; the UI maps each to Hebrew copy. */
export type CloudErrorCode =
  | 'not-configured'
  | 'network'
  | 'cancelled' // user closed the Google sheet/popup — show nothing
  | 'invalid-email'
  | 'wrong-password' // also used for "user not found" (don't reveal which)
  | 'email-in-use'
  | 'weak-password'
  | 'too-many-requests'
  | 'invite-not-found'
  | 'invite-expired'
  | 'already-in-family'
  | 'not-in-family'
  | 'permission-denied'
  | 'unknown';

export class CloudError extends Error {
  readonly code: CloudErrorCode;

  constructor(code: CloudErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'CloudError';
    this.code = code;
  }
}

export interface CloudState {
  /** False until the first auth state is known (avoid flashing the signed-out UI). */
  ready: boolean;
  user: CloudUser | null;
  family: Family | null;
  status: SyncStatus;
  /** Last successful sync with the server (epoch ms), for "סונכרן לפני 2 דק׳". */
  lastSyncedAt: number | null;
}

/** All actions reject with `CloudError`. */
export interface CloudActions {
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(name: string, email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Removes the family's data from this device (it stays in the cloud). */
  signOut(): Promise<void>;
  /** Creates a family with the current user and uploads the device's data into it. */
  createFamily(name: string): Promise<void>;
  createInvite(): Promise<Invite>;
  previewInvite(code: string): Promise<InvitePreview>;
  joinFamily(code: string, mode: JoinMode): Promise<void>;
  /** Leaves the family; the device keeps a local copy of the data. */
  leaveFamily(): Promise<void>;
}
