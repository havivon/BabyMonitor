import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { FAMILY, fakeCloud, USER } from '../../test/fakeCloud';
import { renderInShell, seedStore } from '../../test/harness';
import { bottle, local, MIN } from '../../test/helpers';
import { AccountSection } from './AccountSection';
import { BackupNote } from './BackupNote';
import { NOTE_DISMISSED_KEY, resetNoteSession } from './backupNote';
import { SyncIndicator } from './SyncIndicator';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const NOW = local(2026, 10, 6, 12, 0);
const DAY = 24 * 60 * MIN;
const { actions } = fakeCloud;
const press = async (el: HTMLElement): Promise<void> => {
  await act(async () => {
    fireEvent.click(el);
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  fakeCloud.reset();
  localStorage.removeItem(NOTE_DISMISSED_KEY);
  resetNoteSession();
  seedStore({ entries: [bottle(NOW - 60 * MIN, 120)] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Home note (§15.2)', () => {
  it('says plainly the data is only on this phone, and opens sign-in', () => {
    renderInShell(<BackupNote variant="home" />);
    const note = screen.getByRole('region', { name: 'הנתונים שמורים רק בטלפון הזה' });
    expect(note).toHaveClass('card', 'benefits', 'benefits--compact');
    expect(note).toHaveTextContent('הם אינם מגובים.');
    fireEvent.click(within(note).getByRole('button', { name: 'התחברות' }));
    expect(screen.getByRole('dialog', { name: 'התחברות' })).toBeInTheDocument();
  });

  it('hidden before the first entry, during a running feed, before auth is known, and signed in', () => {
    seedStore();
    const first = renderInShell(<BackupNote variant="home" />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    first.unmount();

    const baby = seedStore({ entries: [bottle(NOW - MIN, 90)] });
    act(() => appStore.getState().startTimer(baby.id, 'left'));
    renderInShell(<BackupNote variant="home" />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    act(() => appStore.getState().discardTimer(baby.id));
    expect(screen.getByRole('region')).toBeInTheDocument();
    act(() => fakeCloud.set({ ready: false }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    act(() => fakeCloud.set({ ready: true, user: USER }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('"לא עכשיו" hides it for 14 days (device-local)', () => {
    const view = renderInShell(<BackupNote variant="home" />);
    fireEvent.click(screen.getByRole('button', { name: 'לא עכשיו' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(localStorage.getItem(NOTE_DISMISSED_KEY)).toBe(String(NOW));
    view.unmount();
    vi.setSystemTime(NOW + 13 * DAY);
    const again = renderInShell(<BackupNote variant="home" />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    again.unmount();
    vi.setSystemTime(NOW + 14 * DAY);
    renderInShell(<BackupNote variant="home" />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});

describe('Settings → חשבון ומשפחה (§15.4)', () => {
  it('signed out: the full, non-dismissible benefits card', () => {
    renderInShell(<AccountSection />);
    const card = screen.getByRole('region', { name: 'הנתונים שמורים רק בטלפון הזה' });
    expect(card).toHaveClass('card', 'benefits');
    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
    expect(card).toHaveTextContent('אפשר גם להמשיך בלי חשבון.');
    expect(within(card).queryByRole('button', { name: 'לא עכשיו' })).not.toBeInTheDocument();
  });

  it('signed in with a family: account, live sync row, members (me first), invite', () => {
    fakeCloud.set({ user: USER, family: FAMILY, status: 'synced', lastSyncedAt: NOW - 2 * MIN });
    renderInShell(<AccountSection />);
    expect(screen.getByRole('heading', { name: 'חשבון ומשפחה' })).toBeInTheDocument();
    expect(screen.getByText('dana@example.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'מחובר/ת עם אימייל' })).toBeInTheDocument();
    const sync = screen.getByRole('status');
    expect(sync).toHaveClass('row--success');
    expect(sync).toHaveTextContent('מסונכרןלפני 2 ד׳');

    const family = screen.getByRole('list', { name: 'משפחה' });
    expect(family).toHaveTextContent(FAMILY.name);
    expect(family).toHaveTextContent('2 חברים');
    expect(within(family).getByText('אני')).toBeInTheDocument();
    expect(within(family).getByText(/הצטרף\/ה ב-/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הזמנת בן/בת זוג' }));
    expect(screen.getByRole('dialog', { name: 'הזמנת בן/בת זוג' })).toBeInTheDocument();
  });

  it.each([
    ['offline', 'row--warning', 'לא מקוון', 'השינויים נשמרים בטלפון ויסונכרנו כשהחיבור יחזור'],
    ['syncing', 'row--syncing', 'מסנכרן…', ''],
    ['connecting', 'row--syncing', 'מתחבר…', ''],
  ] as const)('sync row for %s', (status, tone, title, sub) => {
    fakeCloud.set({ user: USER, family: FAMILY, status });
    renderInShell(<AccountSection />);
    const row = screen.getByRole('status');
    expect(row).toHaveClass(tone);
    expect(row).toHaveTextContent(`${title}${sub}`);
  });

  it('sync error offers "ניסיון חוזר" (retrySync); its failure becomes a toast', async () => {
    fakeCloud.set({ user: USER, family: FAMILY, status: 'error' });
    renderInShell(<AccountSection />);
    expect(screen.getByRole('status')).toHaveClass('row--error');
    actions.retrySync.mockImplementationOnce(() => fakeCloud.fail('network'));
    await press(screen.getByRole('button', { name: 'ניסיון חוזר' }));
    expect(actions.retrySync).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט');
  });

  it('signed in without a family: create / join rows, no "leave"', () => {
    fakeCloud.set({ user: USER });
    renderInShell(<AccountSection />);
    expect(screen.getByText('עוד אין משפחה')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'עזיבת המשפחה' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הצטרפות עם קוד' }));
    expect(screen.getByRole('dialog', { name: 'הצטרפות למשפחה' })).toBeInTheDocument();
  });

  it('sign out is confirmed (non-destructive tone); leaving names the family', async () => {
    fakeCloud.set({ user: USER, family: FAMILY, status: 'synced' });
    renderInShell(<AccountSection />);
    fireEvent.click(screen.getByRole('button', { name: 'התנתקות' }));
    const dialog = screen.getByRole('alertdialog', { name: 'להתנתק?' });
    expect(dialog.querySelector('.dialog__icon--primary')).not.toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    expect(actions.signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'עזיבת המשפחה' }));
    const leave = screen.getByRole('alertdialog', { name: `לעזוב את ${FAMILY.name}?` });
    actions.leaveFamily.mockImplementationOnce(() => fakeCloud.fail('not-in-family'));
    await press(within(leave).getByRole('button', { name: 'עזיבת המשפחה' }));
    expect(screen.getByRole('alert')).toHaveTextContent('החשבון כבר לא חבר במשפחה הזו.');

    fireEvent.click(screen.getByRole('button', { name: 'התנתקות' }));
    await press(
      within(screen.getByRole('alertdialog', { name: 'להתנתק?' })).getByRole('button', {
        name: 'התנתקות',
      }),
    );
    expect(actions.signOut).toHaveBeenCalledOnce();
    expect(screen.getByText('התנתקת. הנתונים שמורים בענן.')).toBeInTheDocument();
  });
});

describe('header sync indicator (§15.6)', () => {
  it('only when signed in AND in a family', () => {
    fakeCloud.set({ user: USER, status: 'off' });
    renderInShell(<SyncIndicator />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    act(() => fakeCloud.set({ family: FAMILY, status: 'synced', lastSyncedAt: NOW - 2 * MIN }));
    const link = screen.getByRole('link', { name: 'מסונכרן · לפני 2 ד׳' });
    expect(link).toHaveClass('sync-ind');
    expect(link).toHaveAttribute('href', '/settings');
  });

  it('offline / error are labelled pills; syncing shows only after 600 ms', () => {
    fakeCloud.set({ user: USER, family: FAMILY, status: 'synced' });
    renderInShell(<SyncIndicator />);
    act(() => fakeCloud.set({ status: 'syncing' }));
    expect(screen.getByRole('link')).not.toHaveClass('sync-ind--syncing');
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole('link', { name: 'מסנכרן…' })).toHaveClass('sync-ind--syncing');

    act(() => fakeCloud.set({ status: 'offline' }));
    const offline = screen.getByRole('link', {
      name: 'לא מקוון — השינויים יסונכרנו כשהחיבור יחזור',
    });
    expect(offline).toHaveClass('sync-ind--offline');
    expect(offline).toHaveTextContent('לא מקוון');
    act(() => fakeCloud.set({ status: 'error' }));
    expect(
      screen.getByRole('link', { name: 'הסנכרון נכשל — פתיחת הגדרות החשבון' }),
    ).toHaveTextContent('שגיאת סנכרון');
  });
});
