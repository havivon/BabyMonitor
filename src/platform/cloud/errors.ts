/**
 * Maps Firebase / Capacitor errors to the stable `CloudErrorCode`s of the UI contract.
 */
import { CloudError, type CloudErrorCode } from './types';

const BY_CODE: Record<string, CloudErrorCode> = {
  // Auth
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/user-not-found': 'wrong-password', // never reveal whether an account exists
  'auth/wrong-password': 'wrong-password',
  'auth/invalid-credential': 'wrong-password',
  'auth/invalid-login-credentials': 'wrong-password',
  'auth/missing-password': 'wrong-password',
  'auth/user-disabled': 'wrong-password',
  'auth/email-already-in-use': 'email-in-use',
  'auth/credential-already-in-use': 'email-in-use',
  'auth/account-exists-with-different-credential': 'email-in-use',
  'auth/weak-password': 'weak-password',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network',
  'auth/timeout': 'network',
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  'auth/redirect-cancelled-by-user': 'cancelled',
  // Firestore
  'permission-denied': 'permission-denied',
  unavailable: 'network',
  'deadline-exceeded': 'network',
  unauthenticated: 'permission-denied',
};

function codeOf(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const c = e.code;
    if (typeof c === 'string') return c;
    if (typeof c === 'number') return String(c);
  }
  return undefined;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'string' ? e : '';
}

/** Normalises any thrown value into a `CloudError` (CloudErrors pass through unchanged). */
export function toCloudError(e: unknown): CloudError {
  if (e instanceof CloudError) return e;
  const code = codeOf(e);
  const mapped = code ? BY_CODE[code] ?? BY_CODE[code.replace(/^firestore\//, '')] : undefined;
  if (mapped) return new CloudError(mapped, messageOf(e) || code);
  const msg = messageOf(e);
  // Native Google sign-in (Capacitor): user closed the account picker.
  if (code === '12501' || /cancel+ed|SIGN_IN_CANCELLED/i.test(msg)) return new CloudError('cancelled', msg);
  if (/network|offline|failed to fetch/i.test(msg)) return new CloudError('network', msg);
  return new CloudError('unknown', msg || code || 'unknown error');
}
