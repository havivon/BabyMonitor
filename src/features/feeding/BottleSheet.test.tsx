import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BottleEntry } from '../../domain/types';
import { appStore } from '../../store';
import { renderInShell, seedStore } from '../../test/harness';
import { bottle, HOUR, local, MIN } from '../../test/helpers';
import { BottleSheet } from './BottleSheet';

const NOW = local(2026, 10, 5, 14, 5);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const amountInput = (): HTMLElement => screen.getByRole('textbox', { name: /כמות ב/ });
const save = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
};

describe('BottleSheet', () => {
  it('defaults to the last used content and amount', () => {
    seedStore({ entries: [bottle(NOW - 3 * HOUR, 150, { content: 'formula' })] });
    renderInShell(<BottleSheet open onClose={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'תמ״ל' })).toHaveAttribute('aria-checked', 'true');
    expect(amountInput()).toHaveValue('150');
    expect(screen.getByRole('button', { name: '150 מ״ל' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('validates amount (> 0, ≤ 500 ml) and warns above 400 ml', () => {
    seedStore();
    renderInShell(<BottleSheet open onClose={() => undefined} />);
    expect(amountInput()).toHaveValue('90'); // first-time default

    fireEvent.change(amountInput(), { target: { value: '0' } });
    save();
    expect(screen.getByText('יש להזין כמות גדולה מ-0')).toBeInTheDocument();
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(amountInput(), { target: { value: '650' } });
    fireEvent.blur(amountInput());
    expect(screen.getByText('הכמות המקסימלית היא 500 מ״ל')).toBeInTheDocument();

    fireEvent.change(amountInput(), { target: { value: '450' } });
    expect(screen.getByText('כמות גבוהה מהרגיל — לבדוק שוב?')).toBeInTheDocument();
    expect(appStore.getState().entries).toHaveLength(0);
  });

  it('rejects a time in the future', () => {
    seedStore();
    renderInShell(<BottleSheet open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('שעה'), { target: { value: '2026-10-05T15:30' } });
    expect(screen.getByText('אי אפשר לבחור שעה עתידית')).toBeInTheDocument();
    save();
    expect(appStore.getState().entries).toHaveLength(0);
  });

  it('saves content, amount (stepper + chips), quick time and note — with undo', () => {
    seedStore();
    const onClose = vi.fn();
    renderInShell(<BottleSheet open onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: 'תמ״ל' }));
    fireEvent.click(screen.getByRole('button', { name: '120 מ״ל' }));
    fireEvent.click(screen.getByRole('button', { name: 'הוספה של 10 מ״ל' }));
    fireEvent.click(screen.getByRole('button', { name: 'לפני 30 ד׳' }));
    fireEvent.change(screen.getByLabelText(/הערה/), { target: { value: ' גיהוק ' } });
    save();

    const [entry] = appStore.getState().entries as BottleEntry[];
    expect(entry).toMatchObject({
      type: 'bottle',
      content: 'formula',
      amountMl: 130,
      at: NOW - 30 * MIN,
      note: 'גיהוק',
    });
    expect(onClose).toHaveBeenCalled();
    const toast = screen.getByText('הבקבוק נשמר').closest<HTMLElement>('.toast')!;
    fireEvent.click(within(toast).getByRole('button', { name: 'בטל' }));
    expect(appStore.getState().entries).toHaveLength(0);
  });

  it('works in oz: 0.5 oz steps, oz chips, stored as ml', () => {
    seedStore();
    appStore.getState().updateSettings({ volumeUnit: 'oz' });
    renderInShell(<BottleSheet open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '4 oz' }));
    fireEvent.click(screen.getByRole('button', { name: 'הוספה של 0.5 oz' }));
    expect(amountInput()).toHaveValue('4.5');
    save();
    expect((appStore.getState().entries[0] as BottleEntry).amountMl).toBe(133);
  });

  it('in oz, the edit sheet shows the amount as the lists do and keeps the stored ml (BUG-012)', () => {
    seedStore({ entries: [bottle(NOW - HOUR, 125, { id: 'oz1' })] });
    appStore.getState().updateSettings({ volumeUnit: 'oz' });
    renderInShell(
      <BottleSheet
        open
        onClose={() => undefined}
        entry={appStore.getState().entries[0] as BottleEntry}
      />,
    );
    expect(amountInput()).toHaveValue('4.2');
    save();
    expect((appStore.getState().entries[0] as BottleEntry).amountMl).toBe(125);
  });

  it('edits and deletes an existing bottle (delete offers undo with the same id)', () => {
    const existing = bottle(NOW - HOUR, 100, { id: 'keep-me', content: 'breastmilk' });
    seedStore({ entries: [existing] });
    const onClose = vi.fn();
    renderInShell(
      <BottleSheet open onClose={onClose} entry={appStore.getState().entries[0] as BottleEntry} />,
    );
    expect(screen.getByRole('heading', { name: 'עריכת האכלה' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'מחיקה' }));
    expect(appStore.getState().entries).toHaveLength(0);
    const toast = screen.getByText('הרישום נמחק').closest<HTMLElement>('.toast')!;
    fireEvent.click(within(toast).getByRole('button', { name: 'בטל' }));
    expect(appStore.getState().entries.map((e) => e.id)).toEqual(['keep-me']);
  });
});
