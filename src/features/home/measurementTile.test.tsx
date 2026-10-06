import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { renderInShell, seedStore } from '../../test/harness';
import { local } from '../../test/helpers';
import { HomePage } from './HomePage';

const NOW = local(2026, 10, 6, 12, 0);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const tile = (): HTMLElement => screen.getByRole('button', { name: 'הוספת מדידה' });

describe('Home "מדידה" quick-add tile', () => {
  it('is the 4th tile of a 2×2 grid; meta says what can be measured when no weight is known', () => {
    seedStore({ baby: { birthWeightG: undefined } });
    renderInShell(<HomePage />);
    const grid = tile().closest('.tile-grid')!;
    expect(grid).toHaveClass('tile-grid--4');
    expect(grid.querySelectorAll('.tile')).toHaveLength(4);
    expect(grid.lastElementChild).toBe(tile());
    expect(tile()).toHaveClass('tile', 'tile--growth');
    expect(tile()).toHaveTextContent('מדידה');
    expect(tile().querySelector('.tile__meta')).toHaveTextContent('משקל, אורך, ראש');
  });

  it('meta shows the latest weight (birth weight, then the newest measurement)', () => {
    seedStore({ baby: { birthWeightG: 3300 } });
    renderInShell(<HomePage />);
    expect(tile().querySelector('.tile__meta')).toHaveTextContent('אחרון: 3.30 ק״ג');
    act(() => {
      const babyId = appStore.getState().settings.activeBabyId!;
      appStore.getState().addMeasurement({ babyId, date: '2026-10-01', weightG: 5820 });
    });
    expect(tile().querySelector('.tile__meta')).toHaveTextContent('אחרון: 5.82 ק״ג');
  });

  it('opens the add-measurement sheet and saves to the active baby with a toast', () => {
    const baby = seedStore();
    renderInShell(<HomePage />);
    fireEvent.click(tile());
    const sheet = screen.getByRole('dialog', { name: 'מדידה חדשה' });
    fireEvent.change(within(sheet).getByLabelText(/^אורך/), { target: { value: '58' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'שמירה' }));
    expect(appStore.getState().measurements).toEqual([
      expect.objectContaining({ babyId: baby.id, date: '2026-10-06', lengthMm: 580 }),
    ]);
    expect(screen.getByText('המדידה נשמרה')).toBeInTheDocument();
  });
});
