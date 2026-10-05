import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SolidEntry } from '../../domain/types';
import { appStore } from '../../store';
import { renderInShell, seedStore } from '../../test/harness';
import { DAY, local, solid } from '../../test/helpers';
import { SolidSheet } from './SolidSheet';

const NOW = local(2026, 10, 5, 12, 30);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const foodInput = (): HTMLElement => screen.getByRole('textbox', { name: 'מזון' });
const isNewSwitch = (): HTMLElement => screen.getByRole('switch', { name: /מזון חדש/ });

describe('SolidSheet', () => {
  it('turns comma / Enter input into removable chips and suggests recent foods', () => {
    seedStore({ entries: [solid(NOW - DAY, ['בטטה', 'דלעת'])] });
    renderInShell(<SolidSheet open onClose={() => undefined} />);

    fireEvent.change(foodInput(), { target: { value: 'אבוקדו,' } });
    expect(screen.getByRole('button', { name: 'הסרת אבוקדו' })).toBeInTheDocument();
    expect(foodInput()).toHaveValue('');

    fireEvent.change(foodInput(), { target: { value: 'בננה' } });
    fireEvent.keyDown(foodInput(), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'הסרת בננה' })).toBeInTheDocument();

    const recent = screen.getByRole('group', { name: 'מזונות אחרונים' });
    fireEvent.click(within(recent).getByRole('button', { name: 'הוספת בטטה' }));
    expect(screen.getByRole('button', { name: 'הסרת בטטה' })).toBeInTheDocument();
    // Already-added foods disappear from the suggestions.
    expect(within(recent).queryByRole('button', { name: 'הוספת בטטה' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'הסרת בננה' }));
    expect(screen.queryByRole('button', { name: 'הסרת בננה' })).not.toBeInTheDocument();
  });

  it('flags new foods automatically, single-selects amount and reaction, and saves', () => {
    seedStore({ entries: [solid(NOW - DAY, ['בטטה'])] });
    const onClose = vi.fn();
    renderInShell(<SolidSheet open onClose={onClose} />);

    fireEvent.change(foodInput(), { target: { value: 'בטטה' } });
    expect(isNewSwitch()).not.toBeChecked(); // known food
    fireEvent.change(foodInput(), { target: { value: 'אבוקדו' } });
    expect(isNewSwitch()).toBeChecked(); // never logged before

    const spoon = screen.getByRole('radio', { name: 'כפית' });
    fireEvent.click(spoon);
    expect(spoon).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(spoon); // tap again clears
    expect(spoon).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('radio', { name: 'חצי קערית' }));

    expect(screen.getByRole('radio', { name: 'ללא תגובה' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'אחר' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'מה קרה?' }), {
      target: { value: 'אדמומיות סביב הפה' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    const [, saved] = appStore.getState().entries as SolidEntry[];
    expect(saved).toMatchObject({
      type: 'solid',
      foods: ['אבוקדו'],
      amount: 'חצי קערית',
      isNewFood: true,
      reaction: 'אדמומיות סביב הפה',
      at: NOW,
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('הרישום נשמר')).toBeInTheDocument();
  });

  it('accepts a free-text amount instead of a chip', () => {
    seedStore();
    renderInShell(<SolidSheet open onClose={() => undefined} />);
    fireEvent.change(foodInput(), { target: { value: 'יוגורט' } });
    fireEvent.click(screen.getByRole('radio', { name: 'כפית' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'כמות אחרת' }), {
      target: { value: '50 גר׳' },
    });
    expect(screen.getByRole('radio', { name: 'כפית' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(appStore.getState().entries[0]).toMatchObject({ amount: '50 גר׳' });
  });

  it('requires at least one food', () => {
    seedStore();
    renderInShell(<SolidSheet open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(screen.getByText('יש להזין לפחות מזון אחד')).toBeInTheDocument();
    expect(foodInput()).toHaveFocus();
    expect(appStore.getState().entries).toHaveLength(0);
  });
});
