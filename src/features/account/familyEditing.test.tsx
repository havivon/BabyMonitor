import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FAMILY, fakeCloud, USER } from '../../test/fakeCloud';
import { renderInShell, seedStore } from '../../test/harness';
import { AccountSection } from './AccountSection';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const LAST_FAMILY_KEY = 'babymonitor:hints.lastFamily';
const REMOVED = 'הוסרת מהמשפחה. הנתונים נשארו בטלפון הזה.';
const { actions } = fakeCloud;

const press = async (el: HTMLElement): Promise<void> => {
  await act(async () => {
    fireEvent.click(el);
    await Promise.resolve();
  });
};
const button = (name: string | RegExp): HTMLElement => screen.getByRole('button', { name });
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  fakeCloud.reset();
  localStorage.removeItem(LAST_FAMILY_KEY);
  seedStore();
  fakeCloud.set({ user: USER, family: FAMILY, status: 'synced', lastSyncedAt: Date.now() });
});

describe('family name', () => {
  it('pencil → prefilled sheet → renameFamily(trimmed) → toast; the sheet closes', async () => {
    renderInShell(<AccountSection />);
    fireEvent.click(button('עריכת שם המשפחה'));
    const sheet = screen.getByRole('dialog', { name: 'שם המשפחה' });
    const input = within(sheet).getByLabelText('שם המשפחה');
    expect(input).toHaveValue(FAMILY.name);
    expect(input).toHaveAccessibleDescription('השם מוצג לכל חברי המשפחה.');
    fireEvent.change(input, { target: { value: '  משפחת כהן ' } });
    await press(within(sheet).getByRole('button', { name: 'שמירה' }));
    expect(actions.renameFamily).toHaveBeenCalledWith('משפחת כהן');
    expect(screen.getByText('שם המשפחה עודכן')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'שם המשפחה' })).not.toBeInTheDocument();
  });

  it('validates empty and too long names in Hebrew, without calling the cloud', async () => {
    renderInShell(<AccountSection />);
    fireEvent.click(button('עריכת שם המשפחה'));
    const sheet = screen.getByRole('dialog', { name: 'שם המשפחה' });
    const input = within(sheet).getByLabelText('שם המשפחה');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(input).toHaveAccessibleDescription('יש להזין שם');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: 'א'.repeat(61) } });
    await press(within(sheet).getByRole('button', { name: 'שמירה' }));
    expect(input).toHaveAccessibleDescription('השם יכול להכיל עד 60 תווים');
    expect(input).toHaveFocus();
    expect(actions.renameFamily).not.toHaveBeenCalled();
  });

  it('an unchanged name just closes the sheet', async () => {
    renderInShell(<AccountSection />);
    fireEvent.click(button('עריכת שם המשפחה'));
    await press(button('שמירה'));
    expect(actions.renameFamily).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'שם המשפחה' })).not.toBeInTheDocument();
  });

  it('busy while saving; a server error shows a focused banner and keeps the sheet open', async () => {
    const pending = deferred();
    actions.renameFamily.mockImplementationOnce(() => pending.promise);
    renderInShell(<AccountSection />);
    fireEvent.click(button('עריכת שם המשפחה'));
    const sheet = screen.getByRole('dialog', { name: 'שם המשפחה' });
    const input = within(sheet).getByLabelText('שם המשפחה');
    fireEvent.change(input, { target: { value: 'משפחת כהן' } });
    await press(within(sheet).getByRole('button', { name: 'שמירה' }));
    const busy = within(sheet).getByRole('button', { name: 'שומרים…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(input).toBeDisabled();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    actions.renameFamily.mockImplementationOnce(() => fakeCloud.fail('network'));
    fireEvent.click(button('עריכת שם המשפחה'));
    const again = screen.getByRole('dialog', { name: 'שם המשפחה' });
    fireEvent.change(within(again).getByLabelText('שם המשפחה'), { target: { value: 'כהן' } });
    await press(within(again).getByRole('button', { name: 'שמירה' }));
    const banner = within(again).getByRole('alert');
    expect(banner).toHaveTextContent('אין חיבור לאינטרנט');
    expect(banner).toHaveFocus();
    // Editing the name clears the stale error.
    fireEvent.change(within(again).getByLabelText('שם המשפחה'), { target: { value: 'כהן2' } });
    expect(within(again).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes on the dialog "cancel" event (Esc / Android back)', () => {
    renderInShell(<AccountSection />);
    fireEvent.click(button('עריכת שם המשפחה'));
    const sheet = screen.getByRole('dialog', { name: 'שם המשפחה' });
    fireEvent(sheet, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'שם המשפחה' })).not.toBeInTheDocument();
  });
});

describe('my name', () => {
  it('pencil on my row ("אני") → explained field → updateMyName → toast', async () => {
    renderInShell(<AccountSection />);
    const myRow = screen.getByText('אני').closest('.row') as HTMLElement;
    fireEvent.click(within(myRow).getByRole('button', { name: 'עריכת השם שלי' }));
    const sheet = screen.getByRole('dialog', { name: 'השם שלי במשפחה' });
    const input = within(sheet).getByLabelText('השם שלי');
    expect(input).toHaveValue('דנה');
    expect(input).toHaveAccessibleDescription('כך יופיע השם שלך לבני המשפחה, למשל בהנקה שהתחלת');
    fireEvent.change(input, { target: { value: 'דנה כהן' } });
    await press(within(sheet).getByRole('button', { name: 'שמירה' }));
    expect(actions.updateMyName).toHaveBeenCalledWith('דנה כהן');
    expect(screen.getByText('השם עודכן')).toBeInTheDocument();
  });

  it('only my own row has the edit-name action', () => {
    renderInShell(<AccountSection />);
    expect(screen.getAllByRole('button', { name: 'עריכת השם שלי' })).toHaveLength(1);
    const other = screen.getByText('יואב').closest('.row') as HTMLElement;
    expect(within(other).queryByRole('button', { name: 'עריכת השם שלי' })).not.toBeInTheDocument();
  });
});

describe('remove member', () => {
  it('the creator can remove others (never self), after a danger confirmation', async () => {
    renderInShell(<AccountSection />);
    const myRow = screen.getByText('אני').closest('.row') as HTMLElement;
    expect(within(myRow).queryByRole('button', { name: /^הסרה/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^הסרה של/ })).toHaveLength(1);

    const remove = button('הסרה של יואב מהמשפחה');
    expect(remove).toHaveClass('btn--ghost-danger');
    expect(remove).toHaveTextContent('הסרה');
    fireEvent.click(remove);
    const dialog = screen.getByRole('alertdialog', { name: 'להסיר את יואב מהמשפחה?' });
    expect(dialog).toHaveTextContent(
      'יואב לא יראה יותר את הנתונים ולא יוכל לעדכן. הנתונים שכבר נמצאים בטלפון שלו יישארו אצלו. אפשר להזמין שוב בכל עת.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    expect(actions.removeMember).not.toHaveBeenCalled();

    fireEvent.click(remove);
    await press(
      within(screen.getByRole('alertdialog', { name: 'להסיר את יואב מהמשפחה?' })).getByRole(
        'button',
        { name: 'הסרה מהמשפחה' },
      ),
    );
    expect(actions.removeMember).toHaveBeenCalledExactlyOnceWith('u2');
    expect(screen.getByText('יואב הוסר/ה מהמשפחה')).toBeInTheDocument();
  });

  it('is disabled while removing; a failure becomes an error toast', async () => {
    const pending = deferred();
    actions.removeMember.mockImplementationOnce(() => pending.promise);
    renderInShell(<AccountSection />);
    fireEvent.click(button('הסרה של יואב מהמשפחה'));
    await press(button('הסרה מהמשפחה'));
    expect(button('הסרה של יואב מהמשפחה')).toBeDisabled();
    expect(button('הסרה של יואב מהמשפחה')).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    actions.removeMember.mockImplementationOnce(() => fakeCloud.fail('permission-denied'));
    fireEvent.click(button('הסרה של יואב מהמשפחה'));
    await press(button('הסרה מהמשפחה'));
    expect(screen.getByRole('alert')).toHaveTextContent('אין הרשאה לפעולה הזו.');
  });

  it('a member who did not create the family sees no remove action', () => {
    fakeCloud.set({ family: { ...FAMILY, createdBy: 'u2' } });
    renderInShell(<AccountSection />);
    expect(screen.queryByRole('button', { name: /^הסרה/ })).not.toBeInTheDocument();
    // …but can still rename the family and themself.
    expect(button('עריכת שם המשפחה')).toBeInTheDocument();
    expect(button('עריכת השם שלי')).toBeInTheDocument();
  });
});

describe('removed by another member', () => {
  it('family → null without leaving: one-time notice', () => {
    renderInShell(<div />);
    act(() => fakeCloud.set({ family: null, status: 'off' }));
    expect(screen.getAllByText(REMOVED)).toHaveLength(1);
    act(() => fakeCloud.set({ status: 'off', lastSyncedAt: 1 }));
    expect(screen.getAllByText(REMOVED)).toHaveLength(1);
    expect(localStorage.getItem(LAST_FAMILY_KEY)).toBeNull();
  });

  it('is noticed on the next start when it happened while the app was closed', () => {
    localStorage.setItem(LAST_FAMILY_KEY, JSON.stringify({ uid: 'u1', familyId: 'f1' }));
    fakeCloud.set({ family: null, status: 'off' });
    renderInShell(<div />);
    expect(screen.getByText(REMOVED)).toBeInTheDocument();
  });

  it('nothing while membership is unknown, for another account, or never in a family', () => {
    localStorage.setItem(LAST_FAMILY_KEY, JSON.stringify({ uid: 'other', familyId: 'f9' }));
    fakeCloud.set({ family: null, status: 'connecting' });
    renderInShell(<div />);
    act(() => fakeCloud.set({ status: 'off' }));
    expect(screen.queryByText(REMOVED)).not.toBeInTheDocument();
  });

  it('leaving the family myself is not "removed"', async () => {
    actions.leaveFamily.mockImplementationOnce(() => {
      fakeCloud.set({ family: null, status: 'off' });
      return Promise.resolve();
    });
    renderInShell(<AccountSection />);
    fireEvent.click(button('עזיבת המשפחה'));
    await press(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'עזיבת המשפחה' }),
    );
    expect(screen.getByText('עזבת את המשפחה. הנתונים נשארו בטלפון.')).toBeInTheDocument();
    expect(screen.queryByText(REMOVED)).not.toBeInTheDocument();
  });

  it('signing out (family cleared before the user) is not "removed" either', async () => {
    actions.signOut.mockImplementationOnce(() => {
      fakeCloud.set({ family: null, status: 'off' });
      fakeCloud.set({ user: null });
      return Promise.resolve();
    });
    renderInShell(<AccountSection />);
    fireEvent.click(button('התנתקות'));
    await press(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'התנתקות' }));
    expect(screen.queryByText(REMOVED)).not.toBeInTheDocument();
  });

  it('a failed leave does not hide a later real removal', async () => {
    actions.leaveFamily.mockImplementationOnce(() => fakeCloud.fail('network'));
    renderInShell(<AccountSection />);
    fireEvent.click(button('עזיבת המשפחה'));
    await press(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'עזיבת המשפחה' }),
    );
    act(() => fakeCloud.set({ family: null, status: 'off' }));
    expect(screen.getByText(REMOVED)).toBeInTheDocument();
  });
});
