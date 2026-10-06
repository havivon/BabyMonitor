import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerBanner } from '../../app/TimerBanner';
import { appStore, selectActiveTimer } from '../../store';
import { fakeCloud } from '../../test/fakeCloud';
import { renderInShell, seedStore } from '../../test/harness';
import { local } from '../../test/helpers';
import { TimerSheet } from '../feeding/TimerSheet';
import { HomePage } from '../home/HomePage';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

beforeEach(() => {
  vi.useFakeTimers({ now: local(2026, 10, 6, 6, 52), toFake: ['Date'] });
  fakeCloud.reset();
});
afterEach(() => {
  vi.useRealTimers();
});

function startShared(isMe: boolean) {
  const baby = seedStore();
  act(() => appStore.getState().startTimer(baby.id, 'right'));
  fakeCloud.setStarter(baby.id, { uid: isMe ? 'u1' : 'u2', name: 'נועם', isMe });
  return selectActiveTimer(appStore.getState())!;
}

describe('shared family timer (§15.9)', () => {
  it('names the other parent on the banner, the Home card and the timer sheet', () => {
    const timer = startShared(false);
    renderInShell(
      <>
        <TimerBanner timer={timer} onOpen={() => undefined} />
        <HomePage />
        <TimerSheet open onClose={() => undefined} />
      </>,
    );
    expect(document.querySelector('.timer-banner__meta')).toHaveTextContent(
      'התחילה ב-06:52 · נועם',
    );
    expect(document.querySelector('.since__meta')).toHaveTextContent(/06:52.*· נועם/);
    expect(screen.getByText('הופעל אצל נועם')).toBeInTheDocument();
  });

  it('says nothing extra when this phone started it', () => {
    const timer = startShared(true);
    renderInShell(<TimerBanner timer={timer} onOpen={() => undefined} />);
    expect(screen.queryByText(/נועם/)).not.toBeInTheDocument();
  });
});
