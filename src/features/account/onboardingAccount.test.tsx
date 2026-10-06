import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { appStore } from '../../store';
import { FAMILY, fakeCloud, USER } from '../../test/fakeCloud';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const LAZY = { timeout: 5000 };

beforeEach(() => {
  fakeCloud.reset();
  appStore.getState().resetAll();
  window.location.hash = '#/onboarding';
});

describe('onboarding → "כבר יש לנו חשבון"', () => {
  it('signs in; once the family data syncs down, goes straight Home', async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'כבר יש לנו חשבון — התחברות' }, LAZY),
    );
    actions().signInWithGoogle.mockImplementationOnce(() => {
      fakeCloud.set({ user: USER, status: 'connecting' });
      return Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'המשך עם Google' }));
      await Promise.resolve();
    });
    // The sync layer delivers the family and its baby.
    act(() => {
      fakeCloud.set({ family: FAMILY, status: 'synced' });
      appStore.getState().addBaby({ name: 'נועה', birthDate: '2026-07-01', sex: 'female' });
    });
    expect(await screen.findByRole('button', { name: /החלפת ילד\/ה/ }, LAZY)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
    expect(screen.queryByRole('dialog', { name: 'התחברת · עוד צעד אחד' })).not.toBeInTheDocument();
  });

  it('a second parent without a family gets the setup sheet with "join" preselected', async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'כבר יש לנו חשבון — התחברות' }, LAZY),
    );
    actions().signInWithGoogle.mockImplementationOnce(() => {
      fakeCloud.set({ user: USER, status: 'off' });
      return Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'המשך עם Google' }));
      await Promise.resolve();
    });
    const sheet = screen.getByRole('dialog', { name: 'התחברת · עוד צעד אחד' });
    expect(within(sheet).getByRole('radio', { name: /הצטרפות עם קוד/ })).toBeChecked();
  });
});

const actions = (): typeof fakeCloud.actions => fakeCloud.actions;
