import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../App';
import { isCloudConfigured } from '../../platform/cloud';
import { appStore } from '../../store';
import { seedStore } from '../../test/harness';
import { bottle, local } from '../../test/helpers';

// No vi.mock: the real (unconfigured) cloud module — today's app must be unchanged.
const LAZY = { timeout: 5000 };

beforeEach(() => {
  appStore.getState().resetAll();
});

describe('cloud not configured', () => {
  it('is the default in tests', () => {
    expect(isCloudConfigured).toBe(false);
  });

  it('onboarding has no account entry', async () => {
    window.location.hash = '#/onboarding';
    render(<App />);
    await screen.findByLabelText('שם', undefined, LAZY);
    expect(screen.queryByRole('button', { name: /כבר יש לנו חשבון/ })).not.toBeInTheDocument();
  });

  it('Home and Settings show no account UI or sync indicator', async () => {
    seedStore({ entries: [bottle(local(2026, 10, 5, 9), 120)] });
    window.location.hash = '#/';
    const { unmount } = render(<App />);
    await screen.findByRole('button', { name: /החלפת ילד\/ה/ }, LAZY);
    expect(screen.queryByText('הנתונים שמורים רק בטלפון הזה')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /מצב הסנכרון/ })).not.toBeInTheDocument();
    unmount();
    window.location.hash = '#/settings';
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'הגדרות' }, LAZY);
    expect(screen.queryByText('חשבון ומשפחה')).not.toBeInTheDocument();
    expect(screen.queryByText('הנתונים שמורים רק בטלפון הזה')).not.toBeInTheDocument();
  });
});
