import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { renderInShell, seedStore } from '../../test/harness';
import { bottle, breast, HOUR, local, MIN } from '../../test/helpers';
import { HomePage } from './HomePage';

const NOW = local(2026, 10, 5, 14, 0);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('HomePage today stats', () => {
  it('"אתמול" is the previous calendar day even on the 25-hour DST day (BUG-006)', () => {
    vi.setSystemTime(local(2026, 10, 25, 23, 30)); // Israel DST ends on 2026-10-25
    seedStore({
      entries: [
        bottle(local(2026, 10, 25, 10, 0), 100),
        bottle(local(2026, 10, 24, 9, 0), 100),
        bottle(local(2026, 10, 24, 15, 0), 100),
      ],
    });
    renderInShell(<HomePage />);
    const feeds = screen.getByText('האכלות').closest('.stat')!;
    expect(feeds.querySelector('.stat__value')).toHaveTextContent('1');
    expect(feeds.querySelector('.stat__sub')).toHaveTextContent('אתמול: 2');
  });
});

describe('HomePage hero', () => {
  it('shows time since the last feed, its details and the next side', () => {
    seedStore({
      entries: [
        breast(NOW - 3 * HOUR, [['left', 12]]),
        bottle(NOW - 2 * HOUR - 40 * MIN, 120, { content: 'formula' }),
      ],
    });
    renderInShell(<HomePage />);
    expect(screen.getByText('מאז ההאכלה האחרונה')).toBeInTheDocument();
    expect(screen.getByText('הצד הבא: ימין')).toBeInTheDocument();
    const hero = screen.getByText('מאז ההאכלה האחרונה').closest('section')!;
    expect(hero).toHaveTextContent('2שע׳40ד׳');
    expect(hero).toHaveTextContent('120 מ״ל · תמ״ל · 11:20');
  });

  it('while breastfeeding: shows the live feed instead (no next-side hint) and opens the timer', () => {
    const baby = seedStore({ entries: [breast(NOW - 3 * HOUR, [['left', 12]])] });
    act(() => appStore.getState().startTimer(baby.id, 'right'));
    renderInShell(<HomePage />);
    act(() => {
      vi.advanceTimersByTime(4 * MIN + 5000);
    });
    const hero = screen.getByRole('button', { name: 'פתיחת טיימר ההנקה' });
    expect(hero).toHaveTextContent('הנקה בתהליך');
    expect(screen.getByRole('button', { name: 'הנקה פעילה, פתיחת הטיימר' })).toHaveTextContent(
      'פעילה · ימין',
    );
    expect(hero).toHaveTextContent('04:05');
    expect(hero).toHaveTextContent('צד ימין · התחילה ב-14:00');
    expect(screen.queryByText('מאז ההאכלה האחרונה')).not.toBeInTheDocument();
    expect(screen.queryByText(/הצד הבא/)).not.toBeInTheDocument();
    fireEvent.click(hero);
    expect(screen.getByRole('dialog', { name: 'הנקה' })).toBeInTheDocument();
  });

  it('paused feed reads "הנקה מושהית"', () => {
    const baby = seedStore();
    act(() => {
      appStore.getState().startTimer(baby.id, 'left');
      appStore.getState().pauseTimer(baby.id);
    });
    renderInShell(<HomePage />);
    expect(screen.getByRole('button', { name: 'פתיחת טיימר ההנקה' })).toHaveTextContent(
      'הנקה מושהית',
    );
  });
});
