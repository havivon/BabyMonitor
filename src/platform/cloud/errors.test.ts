import { describe, expect, it } from 'vitest';
import { toCloudError } from './errors';
import { CloudError } from './types';

const fb = (code: string) => Object.assign(new Error(`Firebase: (${code})`), { code });

describe('toCloudError', () => {
  it.each([
    ['auth/invalid-email', 'invalid-email'],
    ['auth/user-not-found', 'wrong-password'],
    ['auth/wrong-password', 'wrong-password'],
    ['auth/invalid-credential', 'wrong-password'],
    ['auth/email-already-in-use', 'email-in-use'],
    ['auth/weak-password', 'weak-password'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/network-request-failed', 'network'],
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/cancelled-popup-request', 'cancelled'],
    ['permission-denied', 'permission-denied'],
    ['firestore/permission-denied', 'permission-denied'],
    ['unavailable', 'network'],
    ['auth/something-new', 'unknown'],
  ])('%s → %s', (code, expected) => {
    expect(toCloudError(fb(code)).code).toBe(expected);
  });

  it('handles native cancellations, plain errors and CloudErrors', () => {
    expect(toCloudError({ code: '12501', message: 'x' }).code).toBe('cancelled');
    expect(toCloudError(new Error('The user canceled the sign-in flow.')).code).toBe('cancelled');
    expect(toCloudError(new Error('Failed to fetch')).code).toBe('network');
    expect(toCloudError('weird').code).toBe('unknown');
    const e = new CloudError('invite-expired');
    expect(toCloudError(e)).toBe(e);
  });
});
