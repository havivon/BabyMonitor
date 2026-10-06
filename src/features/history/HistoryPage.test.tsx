import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { renderInShell, seedStore } from '../../test/harness';
import { bottle, breast, DAY, HOUR, local, solid } from '../../test/helpers';
import { daySummary } from './daySummary';
import { HistoryPage } from './HistoryPage';

const NOW = local(2026, 10, 5, 14, 0); // Monday

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

function seedThreeDays() {
  return seedStore({
    entries: [
      bottle(local(2026, 10, 5, 11, 20), 120, { id: 'today-bottle' }),
      breast(local(2026, 10, 5, 9, 5), [
        ['right', 12],
        ['left', 9],
      ]),
      solid(local(2026, 10, 4, 12, 0), ['בטטה'], { amount: '2–3 כפיות', isNewFood: true }),
      bottle(local(2026, 10, 4, 20, 10), 150),
      bottle(local(2026, 10, 1, 8, 0), 90, { content: 'breastmilk' }),
    ],
  });
}

const dayHeadings = (): string[] =>
  screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

describe('HistoryPage', () => {
  it('groups by day, newest first, with relative titles and summaries', () => {
    seedThreeDays();
    renderInShell(<HistoryPage />);
    expect(dayHeadings()).toEqual([
      'היום · יום ב׳, 5 באוקטובר2 האכלות · 120 מ״ל · 21 ד׳ הנקה',
      'אתמול · יום א׳, 4 באוקטוברהאכלה אחת · 150 מ״ל',
      'יום ה׳, 1 באוקטוברהאכלה אחת · 90 מ״ל',
    ]);
    const today = screen.getByRole('heading', { name: /היום/ }).closest('li')!;
    const items = within(today).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual([
      '11:20בקבוקתמ״ל120 מ״ל',
      '09:05הנקהימין 12 ד׳ · שמאל 9 ד׳21 ד׳',
    ]);
  });

  it('filters by type and shows a filter empty state with "show all"', () => {
    seedStore({ entries: [bottle(NOW - HOUR, 120), bottle(NOW - DAY, 90)] });
    renderInShell(<HistoryPage />);
    fireEvent.click(screen.getByRole('radio', { name: 'מוצקים' }));
    expect(screen.getByText('אין רישומי מוצקים להצגה')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הצגת הכול' }));
    expect(screen.getByRole('radio', { name: 'הכול' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'בקבוק' }));
    expect(screen.getAllByRole('button', { name: /בקבוק/ })).toHaveLength(2);
  });

  it('shows the no-data empty state', () => {
    seedStore();
    renderInShell(<HistoryPage />);
    expect(screen.getByText('אין עדיין רישומים')).toBeInTheDocument();
  });

  it('renders a year of data incrementally (14 days, then more)', () => {
    const entries = Array.from({ length: 365 * 10 }, (_, i) =>
      bottle(NOW - Math.floor(i / 10) * DAY - (i % 10) * HOUR, 100),
    );
    seedStore({ entries });
    renderInShell(<HistoryPage />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(14);
    fireEvent.click(screen.getByRole('button', { name: 'הצגת ימים נוספים' }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(28);
  });

  it('opens an entry for editing; delete removes it and "בטל" restores it (same id)', () => {
    seedThreeDays();
    renderInShell(<HistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: /^11:20בקבוק/ }));
    const sheet = screen.getByRole('dialog', { name: 'עריכת האכלה' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'מחיקה' }));
    expect(appStore.getState().entries.some((e) => e.id === 'today-bottle')).toBe(false);
    expect(screen.queryByRole('button', { name: /^11:20בקבוק/ })).not.toBeInTheDocument();

    const toast = screen.getByText('הרישום נמחק').closest<HTMLElement>('.toast')!;
    fireEvent.click(within(toast).getByRole('button', { name: 'בטל' }));
    expect(appStore.getState().entries.some((e) => e.id === 'today-bottle')).toBe(true);
    expect(screen.getByRole('button', { name: /^11:20בקבוק/ })).toBeInTheDocument();
  });
});

describe('daySummary', () => {
  it('omits zero parts and reads solids-only days', () => {
    expect(daySummary([solid(NOW, ['תפוח']), solid(NOW, ['אגס'])], 'ml')).toEqual([
      'מוצקים 2 פעמים',
    ]);
    expect(daySummary([bottle(NOW, 120), bottle(NOW, 30)], 'oz')).toEqual(['2 האכלות', '5.1 oz']);
  });
});
