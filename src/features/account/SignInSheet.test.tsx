import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeCloud } from '../../test/fakeCloud';
import { renderInShell, seedStore } from '../../test/harness';
import { SignInSheet } from './SignInSheet';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const { actions } = fakeCloud;
const email = (): HTMLElement => screen.getByLabelText('אימייל');
const password = (): HTMLElement => screen.getByLabelText('סיסמה');
const press = async (name: string): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await Promise.resolve();
  });
};
const fill = (el: HTMLElement, value: string): void => {
  fireEvent.change(el, { target: { value } });
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function renderSheet() {
  const onSignedIn = vi.fn();
  renderInShell(<SignInSheet open onClose={() => undefined} onSignedIn={onSignedIn} />);
  return onSignedIn;
}

beforeEach(() => {
  fakeCloud.reset();
  seedStore();
});

describe('SignInSheet — Google', () => {
  it('focuses the Google button first and signs in with it', async () => {
    const onSignedIn = renderSheet();
    expect(screen.getByRole('button', { name: 'המשך עם Google' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'המשך עם Google' })).toHaveClass('gbtn');
    await press('המשך עם Google');
    expect(actions.signInWithGoogle).toHaveBeenCalledOnce();
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it('cancelling shows nothing; a network failure shows a focused form banner', async () => {
    actions.signInWithGoogle.mockImplementationOnce(() => fakeCloud.fail('cancelled'));
    const onSignedIn = renderSheet();
    await press('המשך עם Google');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();

    actions.signInWithGoogle.mockImplementationOnce(() => fakeCloud.fail('network'));
    await press('המשך עם Google');
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('אין חיבור לאינטרנט. כדאי לנסות שוב כשהחיבור יחזור.');
    expect(banner).toHaveFocus();
  });

  it('while waiting: busy, disabled, with a spinner after the label', async () => {
    const pending = deferred();
    actions.signInWithGoogle.mockImplementation(() => pending.promise);
    renderSheet();
    await press('המשך עם Google');
    const g = screen.getByRole('button', { name: 'המשך עם Google' });
    expect(g).toHaveAttribute('aria-busy', 'true');
    expect(g).toBeDisabled();
    expect(g.querySelector('.gbtn__spinner')).not.toBeNull();
    expect(email()).toBeDisabled();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
  });
});

describe('SignInSheet — email sign-in', () => {
  it('validates on blur and on submit, before calling the cloud', async () => {
    renderSheet();
    fireEvent.blur(email());
    expect(screen.getByText('יש להזין אימייל')).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    await press('התחברות');
    expect(screen.getByText('יש להזין סיסמה')).toBeInTheDocument();
    expect(email()).toHaveFocus();
    fill(email(), 'not-an-email');
    expect(screen.getByText('כתובת האימייל לא נראית תקינה')).toBeInTheDocument();
    expect(actions.signInWithEmail).not.toHaveBeenCalled();
  });

  it('signs in with a trimmed email; the busy label is "מתחברים…"', async () => {
    const pending = deferred();
    actions.signInWithEmail.mockImplementation(() => pending.promise);
    const onSignedIn = renderSheet();
    fill(email(), ' dana@example.com ');
    fill(password(), 'secret1');
    await press('התחברות');
    expect(screen.getByRole('button', { name: 'מתחברים…' })).toHaveAttribute('aria-busy', 'true');
    await press('מתחברים…'); // a second tap while busy does nothing
    expect(actions.signInWithEmail).toHaveBeenCalledOnce();
    expect(actions.signInWithEmail).toHaveBeenCalledWith('dana@example.com', 'secret1');
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it.each([
    ['wrong-password', 'האימייל או הסיסמה שגויים'],
    ['too-many-requests', 'היו יותר מדי ניסיונות. כדאי לחכות כמה דקות ולנסות שוב.'],
    ['not-configured', 'ההתחברות לא זמינה כרגע בגרסה הזו.'],
    ['unknown', 'משהו השתבש. כדאי לנסות שוב.'],
  ] as const)('form-level error %s → banner', async (code, text) => {
    actions.signInWithEmail.mockImplementationOnce(() => fakeCloud.fail(code));
    const onSignedIn = renderSheet();
    fill(email(), 'a@b.co');
    fill(password(), 'x');
    await press('התחברות');
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('a server invalid-email goes under the email field, and clears when edited', async () => {
    actions.signInWithEmail.mockImplementationOnce(() => fakeCloud.fail('invalid-email'));
    renderSheet();
    fill(email(), 'a@b.co');
    fill(password(), 'x');
    await press('התחברות');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(email()).toHaveAccessibleDescription('כתובת האימייל לא נראית תקינה');
    fill(email(), 'a@b.com');
    expect(email()).not.toHaveAttribute('aria-invalid');
  });

  it('the password visibility toggle', () => {
    renderSheet();
    const toggle = screen.getByRole('button', { name: 'הצגת הסיסמה' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(password()).toHaveAttribute('type', 'password');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'הסתרת הסיסמה' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(password()).toHaveAttribute('type', 'text');
  });
});

describe('SignInSheet — create account', () => {
  it('validates name and a 6+ password, then creates the account', async () => {
    const onSignedIn = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'יצירת חשבון' }));
    expect(screen.getByRole('heading', { name: 'יצירת חשבון' })).toBeInTheDocument();
    expect(screen.getByLabelText('שם')).toHaveAccessibleDescription(
      'כך השם יופיע לבן/בת הזוג במשפחה',
    );
    fill(email(), 'a@b.co');
    fill(password(), '123');
    await press('יצירת חשבון');
    expect(screen.getByText('יש להזין שם')).toBeInTheDocument();
    expect(screen.getByText('הסיסמה צריכה להכיל לפחות 6 תווים')).toBeInTheDocument();
    expect(screen.getByLabelText('שם')).toHaveFocus();
    expect(actions.signUpWithEmail).not.toHaveBeenCalled();

    fill(screen.getByLabelText('שם'), ' מיכל ');
    fill(password(), '123456');
    await press('יצירת חשבון');
    expect(actions.signUpWithEmail).toHaveBeenCalledWith('מיכל', 'a@b.co', '123456');
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it('email-in-use: field error + "התחברות עם האימייל הזה" back to sign-in with the email kept', async () => {
    actions.signUpWithEmail.mockImplementationOnce(() => fakeCloud.fail('email-in-use'));
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'יצירת חשבון' }));
    fill(screen.getByLabelText('שם'), 'מיכל');
    fill(email(), 'michal@example.com');
    fill(password(), 'baby2026');
    await press('יצירת חשבון');
    expect(email()).toHaveAccessibleDescription('כבר קיים חשבון עם האימייל הזה.');
    fireEvent.click(screen.getByRole('button', { name: 'התחברות עם האימייל הזה' }));
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
    expect(email()).toHaveValue('michal@example.com');
  });

  it('the back chevron returns to sign-in', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'יצירת חשבון' }));
    fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'חזרה' })).not.toBeInTheDocument();
  });
});

describe('SignInSheet — reset password', () => {
  it('prefills the email, sends the link and confirms', async () => {
    renderSheet();
    fill(email(), 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: 'שכחתי סיסמה' }));
    expect(screen.getByRole('heading', { name: 'איפוס סיסמה' })).toBeInTheDocument();
    expect(screen.queryByLabelText('סיסמה')).not.toBeInTheDocument();
    expect(email()).toHaveValue('a@b.co');
    await press('שליחת קישור לאיפוס');
    expect(actions.sendPasswordReset).toHaveBeenCalledWith('a@b.co');
    const ok = screen.getByRole('status');
    expect(ok).toHaveTextContent('הקישור נשלח');
    expect(ok).toHaveTextContent('שלחנו קישור לאיפוס אל a@b.co. כדאי לבדוק גם בתיקיית הספאם.');
    fireEvent.click(screen.getByRole('button', { name: 'חזרה להתחברות' }));
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
  });

  it('too-many-requests is shown on the reset form', async () => {
    actions.sendPasswordReset.mockImplementationOnce(() => fakeCloud.fail('too-many-requests'));
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'שכחתי סיסמה' }));
    fill(email(), 'a@b.co');
    await press('שליחת קישור לאיפוס');
    expect(screen.getByRole('alert')).toHaveTextContent('היו יותר מדי ניסיונות');
  });
});
