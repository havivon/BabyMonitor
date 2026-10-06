/**
 * Public API of the cloud layer (accounts, family, sync). The UI imports ONLY from here.
 * Stub phase: cloud is "off" and every action rejects with `CloudError('not-configured')`.
 */
import { CloudError, type CloudActions, type CloudState } from './types';

export * from './types';
export { isCloudConfigured } from './config';

const OFF: CloudState = { ready: true, user: null, family: null, status: 'off', lastSyncedAt: null };

/** Current cloud state (re-renders on change). */
export function useCloud(): CloudState {
  return OFF;
}

const notConfigured = (): Promise<never> => Promise.reject(new CloudError('not-configured'));

export const cloud: CloudActions = {
  signInWithGoogle: notConfigured,
  signInWithEmail: notConfigured,
  signUpWithEmail: notConfigured,
  sendPasswordReset: notConfigured,
  signOut: notConfigured,
  createFamily: notConfigured,
  createInvite: notConfigured,
  previewInvite: notConfigured,
  joinFamily: notConfigured,
  leaveFamily: notConfigured,
};
