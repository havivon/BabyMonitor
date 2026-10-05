import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BreastEntry } from '../../domain/types';
import { appStore, selectActiveTimer } from '../../store';
import { renderInShell, seedStore } from '../../test/harness';
import { breast, HOUR, local, MIN } from '../../test/helpers';
import { TimerSheet } from './TimerSheet';

const T0 = local(2026, 10, 5, 9, 0);

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const side = (name: 'ימין' | 'שמאל'): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^${name}`) });

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('TimerSheet', () => {
  it('start → switch → pause → finish saves the right breastfeed, with undo', () => {
    seedStore();
    const onClose = vi.fn();
    renderInShell(<TimerSheet open onClose={onClose} />);

    expect(screen.getByText('בחירת צד להתחלה')).toBeInTheDocument();
    fireEvent.click(side('ימין'));
    expect(side('ימין')).toHaveAttribute('aria-pressed', 'true');

    advance(5 * MIN);
    expect(screen.getByRole('timer')).toHaveTextContent('05:00');

    fireEvent.click(side('שמאל'));
    expect(side('שמאל')).toHaveAttribute('aria-pressed', 'true');
    expect(side('ימין')).toHaveAttribute('aria-pressed', 'false');
    advance(3 * MIN);

    fireEvent.click(screen.getByRole('button', { name: 'השהיה' }));
    expect(screen.getByText('מושהה')).toBeInTheDocument();
    advance(2 * MIN); // paused time is not counted
    expect(screen.getByRole('timer')).toHaveTextContent('08:00');

    fireEvent.click(screen.getByRole('button', { name: 'סיום ושמירה' }));
    expect(onClose).toHaveBeenCalled();

    const entries = appStore.getState().entries as BreastEntry[];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: 'breast',
      startedAt: T0,
      endedAt: T0 + 8 * MIN,
      segments: [
        { side: 'right', startedAt: T0, endedAt: T0 + 5 * MIN },
        { side: 'left', startedAt: T0 + 5 * MIN, endedAt: T0 + 8 * MIN },
      ],
    });
    expect(selectActiveTimer(appStore.getState())).toBeNull();

    // Undo puts the timer back exactly as it was and removes the entry.
    const toast = screen.getByText('ההנקה נשמרה · 8 ד׳').closest<HTMLElement>('.toast')!;
    fireEvent.click(within(toast).getByRole('button', { name: 'בטל' }));
    expect(appStore.getState().entries).toHaveLength(0);
    expect(selectActiveTimer(appStore.getState())?.segments).toHaveLength(2);
  });

  it('suggests the next side and remembers the timer across a remount (reload)', () => {
    seedStore({ entries: [breast(T0 - 3 * HOUR, [['right', 12]])] });
    const { unmount } = renderInShell(<TimerSheet open onClose={() => undefined} />);
    expect(side('שמאל')).toHaveClass('side-btn--next');
    expect(screen.getByText('הבא בתור')).toBeInTheDocument();
    fireEvent.click(side('שמאל'));
    unmount();

    advance(10 * MIN);
    renderInShell(<TimerSheet open onClose={() => undefined} />);
    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
    expect(side('שמאל')).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks before saving a feed shorter than a minute, and can discard it', () => {
    seedStore();
    renderInShell(<TimerSheet open onClose={() => undefined} />);
    fireEvent.click(side('ימין'));
    advance(20_000);
    fireEvent.click(screen.getByRole('button', { name: 'סיום ושמירה' }));
    const dialog = screen.getByRole('alertdialog', { name: 'ההנקה קצרה מדקה. לשמור בכל זאת?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'מחיקה' }));
    expect(appStore.getState().entries).toHaveLength(0);
    expect(selectActiveTimer(appStore.getState())).toBeNull();
  });

  it('cancelling the feed needs confirmation', () => {
    seedStore();
    renderInShell(<TimerSheet open onClose={() => undefined} />);
    fireEvent.click(side('ימין'));
    advance(4 * MIN);
    fireEvent.click(screen.getByRole('button', { name: 'ביטול הנקה' }));
    const dialog = screen.getByRole('alertdialog', { name: 'לבטל את ההנקה?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'חזרה לטיימר' }));
    expect(selectActiveTimer(appStore.getState())).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול הנקה' }));
    fireEvent.click(screen.getByRole('button', { name: 'ביטול ההנקה' }));
    expect(selectActiveTimer(appStore.getState())).toBeNull();
    expect(appStore.getState().entries).toHaveLength(0);
  });

  it('shows the 90-minute reminder while running', () => {
    seedStore();
    renderInShell(<TimerSheet open onClose={() => undefined} />);
    fireEvent.click(side('ימין'));
    advance(89 * MIN);
    expect(screen.queryByText('הטיימר פועל כבר שעה וחצי — לסיים?')).not.toBeInTheDocument();
    advance(MIN);
    expect(screen.getByText('הטיימר פועל כבר שעה וחצי — לסיים?')).toBeInTheDocument();
  });

  it('a forgotten (> 6 h) timer opens on the end-time prompt and saves at that time', () => {
    const baby = seedStore();
    appStore.getState().startTimer(baby.id, 'left');
    advance(7 * HOUR);
    renderInShell(<TimerSheet open onClose={() => undefined} />);
    expect(screen.getByText('הטיימר פועל כבר יותר מ-6 שעות')).toBeInTheDocument();
    const end = screen.getByLabelText('שעת סיום');
    fireEvent.change(end, { target: { value: '2026-10-05T09:25' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    const [entry] = appStore.getState().entries as BreastEntry[];
    expect(entry).toMatchObject({ startedAt: T0, endedAt: T0 + 25 * MIN });
  });

  it('corrects the start time of a running timer', () => {
    seedStore();
    renderInShell(<TimerSheet open onClose={() => undefined} />);
    fireEvent.click(side('ימין'));
    advance(2 * MIN);
    fireEvent.click(screen.getByRole('button', { name: 'עריכת שעת התחלה' }));
    fireEvent.click(screen.getByRole('button', { name: 'לפני 15 ד׳' }));
    fireEvent.click(screen.getByRole('button', { name: 'עדכון' }));
    expect(selectActiveTimer(appStore.getState())?.segments[0]?.startedAt).toBe(T0 - 13 * MIN);
    expect(screen.getByRole('timer')).toHaveTextContent('15:00');
  });

  it('manual entry requires at least one side and saves sequential segments', () => {
    seedStore();
    const onClose = vi.fn();
    renderInShell(<TimerSheet open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'רישום ידני' }));
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(screen.getByText('יש להזין לפחות צד אחד')).toBeInTheDocument();
    expect(appStore.getState().entries).toHaveLength(0);

    const [rightQuick] = screen.getAllByRole('group', { name: /דקות מהירות \(ימין\)/ });
    fireEvent.click(within(rightQuick!).getByRole('button', { name: '10 ד׳' }));
    fireEvent.click(screen.getByRole('button', { name: 'הוספה של דקה (שמאל)' }));
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    const [entry] = appStore.getState().entries as BreastEntry[];
    // Default start is "30 minutes ago".
    expect(entry?.startedAt).toBe(T0 - 30 * MIN);
    expect(entry?.endedAt).toBe(T0 - 19 * MIN);
    expect(entry?.segments.map((s) => s.side)).toEqual(['right', 'left']);
    expect(onClose).toHaveBeenCalled();
  });
});
