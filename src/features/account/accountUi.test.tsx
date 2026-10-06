import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInShell, seedStore } from '../../test/harness';
import { FAMILY, fakeCloud, USER } from '../../test/fakeCloud';
import { bottle, local, MIN } from '../../test/helpers';
import { AccountSection } from './AccountSection';
import { BackupNote } from './BackupNote';
import { NOTE_DISMISSED_KEY } from './backupNote';
import { SyncIndicator } from './SyncIndicator';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const NOW = local(2026, 10, 6, 12, 0);
const { actions } = fakeCloud;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  fakeCloud.reset();
  localStorage.removeItem(NOTE_DISMISSED_KEY);
  seedStore({ entries: [bottle(NOW - 60 * MIN, 120)] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('BackupNote (home)', () => {
  it('says plainly the data is not backed up, and opens sign-in', () => {
    renderInShell(<BackupNote variant="home" />);
    const note = screen.getByRole('region', { name: 'הנתונים אינם מגובים' });
    expect(note).toHaveTextContent('הנתונים שמורים רק בטלפון הזה ואינם מגובים.');
    fireEvent.click(within(note).getByRole('button', { name: 'התחברות' }));
    expect(screen.getByRole('dialog', { name: 'התחברות' })).toBeInTheDocument();
  });

  it('is hidden before the first feed, while auth is unknown, and when signed in', () => {
    seedStore();
    const { unmount } = renderInShell(<BackupNote variant="home" />);
    expect(screen.queryByText('הנתונים אינם מגובים')).not.toBeInTheDocument();
    unmount();
    seedStore({ entries: [bottle(NOW - MIN, 90)] });
    fakeCloud.set({ ready: false });
    renderInShell(<BackupNote variant="home" />);
    expect(screen.queryByText('הנתונים אינם מגובים')).not.toBeInTheDocument();
    act(() => fakeCloud.set({ ready: true }));
    expect(screen.getByText('הנתונים אינם מגובים')).toBeInTheDocument();
    act(() => fakeCloud.set({ user: USER }));
    expect(screen.queryByText('הנתונים אינם מגובים')).not.toBeInTheDocument();
  });

  it('dismissal is remembered on the device and the note returns after 2 weeks', () => {
    const { unmount } = renderInShell(<BackupNote variant="home" />);
    fireEvent.click(screen.getByRole('button', { name: 'סגירת ההודעה' }));
    expect(screen.queryByText('הנתונים אינם מגובים')).not.toBeInTheDocument();
    expect(localStorage.getItem(NOTE_DISMISSED_KEY)).toBe(String(NOW));
    unmount();
    vi.setSystemTime(NOW + 13 * 24 * 60 * MIN);
    const second = renderInShell(<BackupNote variant="home" />);
    expect(screen.queryByText('הנתונים אינם מגובים')).not.toBeInTheDocument();
    second.unmount();
    vi.setSystemTime(NOW + 14 * 24 * 60 * MIN);
    renderInShell(<BackupNote variant="home" />);
    expect(screen.getByText('הנתונים אינם מגובים')).toBeInTheDocument();
  });
});

describe('AccountSection (Settings)', () => {
  it('signed out: the persistent "not backed up" card (no dismiss)', () => {
    renderInShell(<AccountSection />);
    expect(screen.getByText('הנתונים אינם מגובים')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'סגירת ההודעה' })).not.toBeInTheDocument();
  });

  it('signed in with a family: account, live sync line, members, invite', () => {
    fakeCloud.set({ user: USER, family: FAMILY, status: 'synced', lastSyncedAt: NOW - 2 * MIN });
    renderInShell(<AccountSection />);
    expect(screen.getByRole('heading', { name: 'חשבון ומשפחה' })).toBeInTheDocument();
    expect(screen.getByText('dana@example.com')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('מסונכרן · לפני 2 ד׳');
    expect(screen.getByText('יואב')).toBeInTheDocument();
    expect(screen.getByText('(את/ה)')).toBeInTheDocument();
    act(() => fakeCloud.set({ status: 'offline' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'אין חיבור — השינויים יסונכרנו כשהחיבור יחזור',
    );
    fireEvent.click(screen.getByRole('button', { name: 'הזמנת הורה נוסף' }));
    expect(screen.getByRole('dialog', { name: 'הזמנת הורה נוסף' })).toBeInTheDocument();
  });

  it('signed in without a family: create or join', () => {
    fakeCloud.set({ user: USER });
    renderInShell(<AccountSection />);
    fireEvent.click(screen.getByRole('button', { name: /הצטרפות עם קוד/ }));
    expect(screen.getByRole('dialog', { name: 'הצטרפות למשפחה' })).toBeInTheDocument();
  });

  it('sign out and leave family need confirmation; failures show a Hebrew toast', async () => {
    fakeCloud.set({ user: USER, family: FAMILY, status: 'synced' });
    renderInShell(<AccountSection />);
    fireEvent.click(screen.getByRole('button', { name: 'התנתקות' }));
    const dialog = screen.getByRole('alertdialog', { name: 'להתנתק מהחשבון?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    expect(actions.signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'יציאה מהמשפחה' }));
    actions.leaveFamily.mockImplementationOnce(() => fakeCloud.fail('network'));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog', { name: 'לצאת מהמשפחה?' })).getByRole('button', {
          name: 'יציאה מהמשפחה',
        }),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט');

    fireEvent.click(screen.getByRole('button', { name: 'התנתקות' }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog', { name: 'להתנתק מהחשבון?' })).getByRole('button', {
          name: 'התנתקות',
        }),
      );
    });
    expect(actions.signOut).toHaveBeenCalledOnce();
    expect(screen.getByText('התנתקת מהחשבון')).toBeInTheDocument();
  });
});

describe('SyncIndicator', () => {
  it('only when signed in; names the status; problems are coloured', () => {
    renderInShell(<SyncIndicator />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    act(() => fakeCloud.set({ user: USER, family: FAMILY, status: 'synced' }));
    const link = screen.getByRole('link', { name: 'מצב הסנכרון: מסונכרן' });
    expect(link).toHaveAttribute('href', '/settings');
    expect(link).not.toHaveAttribute('style');
    act(() => fakeCloud.set({ status: 'error' }));
    expect(screen.getByRole('link', { name: 'מצב הסנכרון: שגיאת סנכרון' })).toHaveStyle({
      color: 'var(--color-danger)',
    });
  });
});
