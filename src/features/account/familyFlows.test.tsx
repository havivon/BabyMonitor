import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { FAMILY, fakeCloud, USER } from '../../test/fakeCloud';
import { renderInShell, seedStore } from '../../test/harness';
import { bottle, local } from '../../test/helpers';
import { useAccountFlows } from './flowsContext';
import { cleanInviteInput } from './inviteCode';
import { InviteSheet } from './InviteSheet';
import { joinNames } from './names';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const { actions } = fakeCloud;
const press = async (name: string | RegExp, scope?: HTMLElement): Promise<void> => {
  const el = (scope ? within(scope) : screen).getByRole('button', { name });
  await act(async () => {
    fireEvent.click(el);
    await Promise.resolve();
  });
};

/** Opens a flow through the provider, the way Home / Settings / onboarding do. */
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
const openFlow = (flow: 'signIn' | 'join' | 'invite' | 'setup'): void => {
  renderInShell(<Opener flow={flow} />);
  fireEvent.click(screen.getByRole('button', { name: 'open' }));
};

/** Sets navigator.clipboard / navigator.share for one test (restored in afterEach). */
const restorers: (() => void)[] = [];
function stubNavigator(key: 'clipboard' | 'share', value: unknown): void {
  const had = Object.getOwnPropertyDescriptor(navigator, key);
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
  restorers.push(() => {
    if (had) Object.defineProperty(navigator, key, had);
    else Reflect.deleteProperty(navigator, key);
  });
}

beforeEach(() => {
  fakeCloud.reset();
  seedStore();
});
afterEach(() => {
  restorers.splice(0).forEach((r) => r());
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('cleans pasted invite codes to the alphabet', () => {
    expect(cleanInviteInput('k7q-2mx')).toBe('K7Q2MX');
    expect(cleanInviteInput(' k7q 2mx ')).toBe('K7Q2MX');
    expect(cleanInviteInput('O0I1L-AB')).toBe('AB'); // look-alikes are dropped
    expect(cleanInviteInput('ABCDEFGH')).toBe('ABCDEF');
  });
  it('joins member names the Hebrew way', () => {
    expect(joinNames(['דנה'])).toBe('דנה');
    expect(joinNames(['דנה', 'נועם'])).toBe('דנה ונועם');
    expect(joinNames(['דנה', 'נועם', 'מאיה'])).toBe('דנה, נועם ומאיה');
  });
});

describe('after sign-in (§15.7)', () => {
  it('no family yet → "התחברת · עוד צעד אחד", create (prefilled) uploads the data', async () => {
    openFlow('signIn');
    actions.signInWithGoogle.mockImplementationOnce(() => {
      fakeCloud.set({ user: { ...USER, displayName: 'מיכל כהן' }, status: 'connecting' });
      return Promise.resolve();
    });
    await press('המשך עם Google');
    // Membership not known yet → no flash of the setup sheet.
    expect(screen.queryByRole('dialog', { name: 'התחברת · עוד צעד אחד' })).not.toBeInTheDocument();
    act(() => fakeCloud.set({ status: 'off' }));
    const sheet = screen.getByRole('dialog', { name: 'התחברת · עוד צעד אחד' });
    const group = within(sheet).getByRole('radiogroup', { name: 'איך ממשיכים' });
    expect(within(group).getByRole('radio', { name: /יצירת משפחה חדשה/ })).toBeChecked();
    expect(within(sheet).getByLabelText('שם המשפחה')).toHaveValue('משפחת כהן');

    actions.createFamily.mockImplementationOnce((name) => {
      fakeCloud.set({ family: { ...FAMILY, name }, status: 'synced' });
      return Promise.resolve();
    });
    await press('יצירת המשפחה', sheet);
    expect(actions.createFamily).toHaveBeenCalledWith('משפחת כהן');
    expect(screen.getByText('המשפחה נוצרה · הנתונים מגובים')).toBeInTheDocument();
    expect(sheet).not.toHaveAttribute('open');
  });

  it('already in a family → just a toast, no setup', async () => {
    openFlow('signIn');
    actions.signInWithGoogle.mockImplementationOnce(() => {
      fakeCloud.set({ user: USER, status: 'connecting' });
      return Promise.resolve();
    });
    await press('המשך עם Google');
    act(() => fakeCloud.set({ family: FAMILY, status: 'syncing' }));
    expect(screen.getByText('התחברת · הנתונים מסונכרנים')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'התחברת · עוד צעד אחד' })).not.toBeInTheDocument();
  });

  it('choosing "הצטרפות עם קוד" switches the same sheet to the join flow', async () => {
    fakeCloud.set({ user: USER });
    openFlow('setup');
    const sheet = screen.getByRole('dialog', { name: 'יצירת משפחה' });
    fireEvent.click(within(sheet).getByRole('radio', { name: /הצטרפות עם קוד/ }));
    expect(within(sheet).queryByLabelText('שם המשפחה')).not.toBeInTheDocument();
    await press('המשך', sheet);
    expect(within(sheet).getByRole('heading', { name: 'הצטרפות למשפחה' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'חזרה' }));
    expect(within(sheet).getByRole('radio', { name: /הצטרפות עם קוד/ })).toBeChecked();
  });

  it('an empty family name and server errors are reported', async () => {
    fakeCloud.set({ user: { ...USER, displayName: null, email: null } });
    openFlow('setup');
    const sheet = screen.getByRole('dialog', { name: 'יצירת משפחה' });
    await press('יצירת המשפחה', sheet);
    expect(within(sheet).getByText('יש להזין שם למשפחה')).toBeInTheDocument();
    expect(actions.createFamily).not.toHaveBeenCalled();
    fireEvent.change(within(sheet).getByLabelText('שם המשפחה'), { target: { value: 'משפחת לוי' } });
    actions.createFamily.mockImplementationOnce(() => fakeCloud.fail('already-in-family'));
    await press('יצירת המשפחה', sheet);
    expect(within(sheet).getByRole('alert')).toHaveTextContent('החשבון הזה כבר שייך למשפחה.');
  });
});

describe('join a family (§15.8)', () => {
  const codeInput = (): HTMLElement => screen.getByLabelText('קוד הצטרפות');

  it('code step: cleans input, enables "המשך" at 6 characters, errors under the field', async () => {
    fakeCloud.set({ user: USER });
    openFlow('join');
    const next = screen.getByRole('button', { name: 'המשך' });
    fireEvent.change(codeInput(), { target: { value: 'k7q-2m' } });
    expect(codeInput()).toHaveValue('K7Q2M');
    expect(next).toBeDisabled();
    fireEvent.change(codeInput(), { target: { value: 'k7q-2mx' } });
    expect(next).toBeEnabled();

    actions.previewInvite.mockImplementationOnce(() => fakeCloud.fail('invite-expired'));
    await press('המשך');
    expect(actions.previewInvite).toHaveBeenCalledWith('K7Q2MX');
    expect(codeInput()).toHaveAccessibleDescription('תוקף הקוד פג. אפשר לבקש קוד חדש מבן/בת הזוג.');
    expect(codeInput()).toHaveFocus();
    actions.previewInvite.mockImplementationOnce(() => fakeCloud.fail('invite-not-found'));
    await press('המשך');
    expect(codeInput()).toHaveAccessibleDescription(/לא מצאנו משפחה עם הקוד הזה/);
  });

  it('a fresh phone joins without being asked (merge)', async () => {
    appStore.getState().resetAll();
    fakeCloud.set({ user: USER });
    actions.previewInvite.mockImplementationOnce(() =>
      Promise.resolve({
        familyName: 'משפחת לוי',
        memberNames: ['דנה', 'נועם'],
        familyHasData: true,
      }),
    );
    renderInShell(<Opener flow="join" />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.change(codeInput(), { target: { value: 'K7Q2MX' } });
    await press('המשך');
    expect(screen.getByText('משפחת לוי')).toBeInTheDocument();
    expect(screen.getByText('דנה ונועם · כבר יש נתונים במשפחה')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText('הנתונים מהטלפון הזה יעלו למשפחה.')).not.toBeInTheDocument();
    await press('הצטרפות למשפחת לוי');
    expect(actions.joinFamily).toHaveBeenCalledWith('K7Q2MX', 'merge');
    expect(screen.getByText('הצטרפת למשפחת לוי')).toBeInTheDocument();
  });

  it('device has data, family empty: no choice, a note that it will be uploaded', async () => {
    fakeCloud.set({ user: USER });
    actions.previewInvite.mockImplementationOnce(() =>
      Promise.resolve({ familyName: 'משפחת לוי', memberNames: ['דנה'], familyHasData: false }),
    );
    openFlow('join');
    fireEvent.change(codeInput(), { target: { value: 'K7Q2MX' } });
    await press('המשך');
    expect(screen.getByText('הנתונים מהטלפון הזה יעלו למשפחה.')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('both have data: merge by default; replace offers a backup and is confirmed first', async () => {
    seedStore({ entries: [bottle(local(2026, 10, 5, 9), 120)] });
    fakeCloud.set({ user: USER });
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    openFlow('join');
    fireEvent.change(codeInput(), { target: { value: 'K7Q2MX' } });
    await press('המשך');
    const group = screen.getByRole('radiogroup');
    expect(screen.getByText('גם בטלפון הזה יש נתונים. מה לעשות איתם?')).toBeInTheDocument();
    expect(
      within(group).getByRole('radio', { name: /מיזוג הנתונים מהמכשיר למשפחה/ }),
    ).toBeChecked();
    expect(screen.queryByRole('button', { name: 'שמירת גיבוי של הטלפון' })).not.toBeInTheDocument();

    fireEvent.click(within(group).getByRole('radio', { name: /שימוש בנתוני המשפחה בלבד/ }));
    await press('שמירת גיבוי של הטלפון');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(screen.getByText('הגיבוי נשמר ✓')).toBeInTheDocument();

    await press(`הצטרפות ל${FAMILY.name}`);
    const confirm = screen.getByRole('alertdialog', { name: 'להחליף את הנתונים בטלפון?' });
    expect(actions.joinFamily).not.toHaveBeenCalled();
    await press('חזרה', confirm);
    expect(actions.joinFamily).not.toHaveBeenCalled();

    actions.joinFamily.mockImplementationOnce(() => fakeCloud.fail('network'));
    await press(`הצטרפות ל${FAMILY.name}`);
    await press('החלפה', screen.getByRole('alertdialog', { name: 'להחליף את הנתונים בטלפון?' }));
    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט');

    await press(`הצטרפות ל${FAMILY.name}`);
    await press('החלפה', screen.getByRole('alertdialog', { name: 'להחליף את הנתונים בטלפון?' }));
    expect(actions.joinFamily).toHaveBeenLastCalledWith('K7Q2MX', 'replace');
    expect(appStore.getState().entries).toHaveLength(1); // replacing is the cloud layer's job
  });
});

describe('invite (§15.5)', () => {
  beforeEach(() => fakeCloud.set({ user: USER, family: FAMILY, status: 'synced' }));

  const renderInvite = async (): Promise<void> => {
    await act(async () => {
      renderInShell(<InviteSheet open onClose={() => undefined} />);
      await Promise.resolve();
    });
  };

  it('shows the code split 3+3, spelled out for screen readers, with its expiry', async () => {
    stubNavigator('share', undefined);
    await renderInvite();
    const code = screen.getByRole('img', { name: 'K 7 Q 2 M X' });
    expect(code).toHaveTextContent('K7Q2MX');
    expect(code.children).toHaveLength(2);
    expect(screen.getByText(`קוד הצטרפות ל${FAMILY.name}`)).toBeInTheDocument();
    expect(screen.getByText(/הקוד בתוקף 7 ימים, עד יום ג׳, 13 באוקטובר/)).toBeInTheDocument();
  });

  it('copy (primary without Web Share) → toast; a blocked clipboard → error toast', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator('clipboard', { writeText });
    stubNavigator('share', undefined);
    await renderInvite();
    expect(screen.queryByRole('button', { name: 'שיתוף' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'העתקה' })).toHaveClass('btn--primary');
    await press('העתקה');
    expect(writeText).toHaveBeenCalledWith('K7Q2MX');
    expect(screen.getByText('הקוד הועתק')).toBeInTheDocument();
    writeText.mockImplementationOnce(() => Promise.reject(new Error('denied')));
    await press('העתקה');
    expect(screen.getByRole('alert')).toHaveTextContent('לא הצלחנו להעתיק');
  });

  it('shares with the spec text; cancelling the share sheet is silent', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('cancel', 'AbortError')));
    stubNavigator('share', share);
    await renderInvite();
    await press('שיתוף');
    expect(share).toHaveBeenCalledWith({
      text: 'מצטרפים למשפחה שלנו ב-BabyMonitor: בוחרים ״הצטרפות עם קוד״ ומקלידים K7Q2MX. הקוד בתוקף עד יום ג׳, 13 באוקטובר.',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('errors replace the code with a banner and "ניסיון חוזר"; a new code can be made', async () => {
    stubNavigator('share', undefined);
    actions.createInvite.mockImplementationOnce(() => fakeCloud.fail('permission-denied'));
    await renderInvite();
    expect(screen.getByRole('alert')).toHaveTextContent('אין הרשאה לפעולה הזו.');
    expect(screen.queryByRole('button', { name: 'העתקה' })).not.toBeInTheDocument();
    await press('ניסיון חוזר');
    expect(screen.getByRole('img', { name: 'K 7 Q 2 M X' })).toBeInTheDocument();
    actions.createInvite.mockImplementationOnce(() =>
      Promise.resolve({ code: 'ABCDEF', expiresAt: Date.UTC(2026, 9, 13, 10, 0) }),
    );
    await press('יצירת קוד חדש');
    expect(screen.getByRole('img', { name: 'A B C D E F' })).toBeInTheDocument();
  });
});
