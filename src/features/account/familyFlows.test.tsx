import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { renderInShell, seedStore } from '../../test/harness';
import { FAMILY, fakeCloud, USER } from '../../test/fakeCloud';
import { bottle, local } from '../../test/helpers';
import { useAccountFlows } from './flowsContext';
import { InviteSheet } from './InviteSheet';
import { JoinFlow } from './JoinFlow';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const { actions } = fakeCloud;
const click = async (name: string | RegExp, scope: HTMLElement | null = null): Promise<void> => {
  const target = scope
    ? within(scope).getByRole('button', { name })
    : screen.getByRole('button', { name });
  await act(async () => {
    fireEvent.click(target);
  });
};

/** A button that opens a flow through the provider, like Home / Settings / onboarding do. */
function Opener({ flow }: { flow: 'signIn' | 'join' | 'invite' | 'setup' }) {
  const flows = useAccountFlows();
  const run = {
    signIn: () => flows.openSignIn(),
    join: () => flows.openFamilySetup('join'),
    invite: () => flows.openInvite(),
    setup: () => flows.openFamilySetup('choose'),
  }[flow];
  return (
    <button type="button" onClick={run}>
      open
    </button>
  );
}

beforeEach(() => {
  fakeCloud.reset();
  seedStore();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('after sign-in', () => {
  it('a user without a family is offered to create one (name prefilled from the baby)', async () => {
    renderInShell(<Opener flow="signIn" />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    actions.signInWithGoogle.mockImplementationOnce(() => {
      fakeCloud.set({ user: USER, status: 'connecting' });
      return Promise.resolve();
    });
    await click('המשך עם Google');
    expect(screen.getByText('התחברת בהצלחה')).toBeInTheDocument();
    // Membership not known yet → no setup sheet flash.
    expect(screen.queryByRole('dialog', { name: 'משפחה' })).not.toBeInTheDocument();

    act(() => fakeCloud.set({ status: 'off' }));
    const sheet = screen.getByRole('dialog', { name: 'משפחה' });
    expect(within(sheet).getByLabelText('שם המשפחה')).toHaveValue('המשפחה של נועה');
    actions.createFamily.mockImplementationOnce((name) => {
      fakeCloud.set({ family: { ...FAMILY, name }, status: 'synced' });
      return Promise.resolve();
    });
    await click('יצירת משפחה', within(sheet).getByLabelText('שם המשפחה').closest('form'));
    expect(actions.createFamily).toHaveBeenCalledWith('המשפחה של נועה');
    expect(screen.getByText('המשפחה נוצרה והנתונים גובו')).toBeInTheDocument();
    expect(sheet).not.toHaveAttribute('open');
  });

  it('a user who already has a family is not asked anything', async () => {
    renderInShell(<Opener flow="signIn" />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    actions.signInWithGoogle.mockImplementationOnce(() => {
      fakeCloud.set({ user: USER, family: FAMILY, status: 'syncing' });
      return Promise.resolve();
    });
    await click('המשך עם Google');
    expect(screen.queryByRole('dialog', { name: 'משפחה' })).not.toBeInTheDocument();
  });

  it('create-family errors are shown in Hebrew', async () => {
    fakeCloud.set({ user: USER });
    renderInShell(<Opener flow="setup" />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    actions.createFamily.mockImplementationOnce(() => fakeCloud.fail('already-in-family'));
    const form = screen.getByLabelText('שם המשפחה').closest('form')!;
    await click('יצירת משפחה', form);
    expect(screen.getByRole('alert')).toHaveTextContent('החשבון כבר שייך למשפחה.');
  });
});

describe('JoinFlow', () => {
  const onJoined = vi.fn();
  beforeEach(() => onJoined.mockReset());

  it('normalises the code, validates its length and maps invite errors', async () => {
    renderInShell(<JoinFlow onJoined={onJoined} />);
    const code = screen.getByLabelText('קוד הזמנה');
    fireEvent.change(code, { target: { value: 'k7q-2m' } });
    expect(code).toHaveValue('K7Q2M');
    await click('המשך');
    expect(screen.getByText('הקוד צריך להכיל 6 תווים')).toBeInTheDocument();
    expect(actions.previewInvite).not.toHaveBeenCalled();

    fireEvent.change(code, { target: { value: 'k7q 2mz' } });
    actions.previewInvite.mockImplementationOnce(() => fakeCloud.fail('invite-expired'));
    await click('המשך');
    expect(actions.previewInvite).toHaveBeenCalledWith('K7Q2MZ');
    expect(screen.getByRole('alert')).toHaveTextContent('תוקף הקוד פג. אפשר לבקש קוד חדש.');
    actions.previewInvite.mockImplementationOnce(() => fakeCloud.fail('invite-not-found'));
    await click('המשך');
    expect(screen.getByRole('alert')).toHaveTextContent('הקוד לא נמצא');
  });

  it('no device data: preview, then join (merge) without asking', async () => {
    appStore.getState().resetAll(); // a fresh phone (second parent)
    renderInShell(<JoinFlow onJoined={onJoined} />);
    fireEvent.change(screen.getByLabelText('קוד הזמנה'), { target: { value: 'K7Q2MZ' } });
    await click('המשך');
    expect(screen.getByText('המשפחה של נועה')).toBeInTheDocument();
    expect(screen.getByText('בני המשפחה: דנה')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    await click('הצטרפות');
    expect(actions.joinFamily).toHaveBeenCalledWith('K7Q2MZ', 'merge');
    expect(onJoined).toHaveBeenCalledWith('המשפחה של נועה');
  });

  it('both sides have data: asks merge vs replace and offers a backup before replacing', async () => {
    seedStore({ entries: [bottle(local(2026, 10, 5, 9), 120)] });
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    renderInShell(<JoinFlow onJoined={onJoined} />);
    fireEvent.change(screen.getByLabelText('קוד הזמנה'), { target: { value: 'K7Q2MZ' } });
    await click('המשך');
    const group = screen.getByRole('radiogroup', { name: /יש נתונים גם בטלפון הזה/ });
    expect(
      within(group).getByRole('radio', { name: 'מיזוג הנתונים מהמכשיר למשפחה' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'הורדת גיבוי של הטלפון' })).not.toBeInTheDocument();
    fireEvent.click(within(group).getByRole('radio', { name: 'שימוש בנתוני המשפחה בלבד' }));
    await click('הורדת גיבוי של הטלפון');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(screen.getByText('קובץ הגיבוי נשמר')).toBeInTheDocument();
    actions.joinFamily.mockImplementationOnce(() => fakeCloud.fail('network'));
    await click('הצטרפות');
    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט');
    expect(onJoined).not.toHaveBeenCalled();
    await click('הצטרפות');
    expect(actions.joinFamily).toHaveBeenLastCalledWith('K7Q2MZ', 'replace');
    expect(onJoined).toHaveBeenCalledOnce();
    expect(appStore.getState().entries).toHaveLength(1); // the cloud layer, not the UI, replaces data
  });
});

describe('InviteSheet', () => {
  beforeEach(() => fakeCloud.set({ user: USER, family: FAMILY, status: 'synced' }));

  it('creates a code; copy writes it to the clipboard (with a Hebrew fallback on failure)', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText }, share: undefined });
    await act(async () => {
      renderInShell(<InviteSheet open onClose={() => undefined} />);
    });
    expect(screen.getByText('K7Q2MZ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'שיתוף' })).not.toBeInTheDocument();
    await click('העתקת הקוד');
    expect(writeText).toHaveBeenCalledWith('K7Q2MZ');
    expect(screen.getByText('הקוד הועתק')).toBeInTheDocument();
    writeText.mockImplementationOnce(() => Promise.reject(new Error('denied')));
    await click('העתקת הקוד');
    expect(screen.getByRole('alert')).toHaveTextContent('לא הצלחנו להעתיק');
  });

  it('shares through the Web Share API when available; cancelling is silent', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('cancel', 'AbortError')));
    vi.stubGlobal('navigator', { ...navigator, share });
    await act(async () => {
      renderInShell(<InviteSheet open onClose={() => undefined} />);
    });
    await click('שיתוף');
    expect(share).toHaveBeenCalledWith({
      text: 'הצטרפות ל"המשפחה של נועה" ב-BabyMonitor: קוד ההזמנה הוא K7Q2MZ',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a failed code creation can be retried', async () => {
    actions.createInvite.mockImplementationOnce(() => fakeCloud.fail('permission-denied'));
    await act(async () => {
      renderInShell(<InviteSheet open onClose={() => undefined} />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('אין הרשאה לפעולה הזו.');
    await click('ניסיון נוסף');
    expect(screen.getByText('K7Q2MZ')).toBeInTheDocument();
  });
});
