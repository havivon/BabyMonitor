import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cloud, CloudError, isCloudConfigured, useCloud, useTimerStarter } from './index';

describe('cloud API without a Firebase config', () => {
  it('is not configured and reports a ready, signed-out, "off" state', () => {
    expect(isCloudConfigured).toBe(false);
    const { result } = renderHook(() => useCloud());
    expect(result.current).toEqual({
      ready: true,
      user: null,
      family: null,
      status: 'off',
      lastSyncedAt: null,
    });
    expect(renderHook(() => useTimerStarter('b1')).result.current).toBeNull();
  });

  const calls: [string, () => Promise<unknown>][] = [
    ['signInWithGoogle', () => cloud.signInWithGoogle()],
    ['signInWithEmail', () => cloud.signInWithEmail('a@b.c', 'secret')],
    ['signUpWithEmail', () => cloud.signUpWithEmail('נועם', 'a@b.c', 'secret')],
    ['sendPasswordReset', () => cloud.sendPasswordReset('a@b.c')],
    ['signOut', () => cloud.signOut()],
    ['createFamily', () => cloud.createFamily('משפחה')],
    ['createInvite', () => cloud.createInvite()],
    ['previewInvite', () => cloud.previewInvite('ABCD23')],
    ['joinFamily', () => cloud.joinFamily('ABCD23', 'merge')],
    ['leaveFamily', () => cloud.leaveFamily()],
    ['retrySync', () => cloud.retrySync()],
  ];

  it('covers every action', () => {
    expect(calls.map(([n]) => n).sort()).toEqual(Object.keys(cloud).sort());
  });

  it.each(calls)('%s rejects with not-configured', async (_name, call) => {
    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CloudError);
    expect((error as CloudError).code).toBe('not-configured');
  });
});
