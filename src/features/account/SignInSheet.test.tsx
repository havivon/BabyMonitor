import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInShell, seedStore } from '../../test/harness';
import { fakeCloud } from '../../test/fakeCloud';
import { SignInSheet } from './SignInSheet';

vi.mock('../../platform/cloud', async () => (await import('../../test/fakeCloud')).cloudModule);

const { actions } = fakeCloud;
const email = (): HTMLElement => screen.getByLabelText('מייל');
const password = (): HTMLElement => screen.getByLabelText('סיסמה');
const submit = async (name = 'התחברות'): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function renderSheet(onSignedIn = vi.fn()) {
  renderInShell(<SignInSheet open onClose={() => undefined} onSignedIn={onSignedIn} />);
  return onSignedIn;
}

beforeEach(() => {
  fakeCloud.reset();
  seedStore();
});

describe('SignInSheet — Google', () => {
  it('signs in with Google', async () => {
    const onSignedIn = renderSheet();
    await submit('המשך עם Google');
    expect(actions.signInWithGoogle).toHaveBeenCalledOnce();
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it('shows nothing when the user cancels Google, and a Hebrew error on network failure', async () => {
    actions.signInWithGoogle.mockImplementationOnce(() => fakeCloud.fail('cancelled'));
    const onSignedIn = renderSheet();
    await submit('המשך עם Google');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();

    actions.signInWithGoogle.mockImplementationOnce(() => fakeCloud.fail('network'));
    await submit('המשך עם Google');
    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט. כדאי לנסות שוב.');
  });
});

describe('SignInSheet — email', () => {
  it('validates before calling the server, then signs in with a trimmed email', async () => {
    const onSignedIn = renderSheet();
    await submit();
    expect(screen.getByText('יש להזין כתובת מייל תקינה')).toBeInTheDocument();
    expect(screen.getByText('יש להזין סיסמה')).toBeInTheDocument();
    expect(email()).toHaveFocus();
    expect(actions.signInWithEmail).not.toHaveBeenCalled();

    fireEvent.change(email(), { target: { value: ' dana@example.com ' } });
    fireEvent.change(password(), { target: { value: 'secret1' } });
    await submit();
    expect(actions.signInWithEmail).toHaveBeenCalledWith('dana@example.com', 'secret1');
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it.each([
    ['wrong-password', 'המייל או הסיסמה שגויים'],
    ['too-many-requests', 'יותר מדי ניסיונות. כדאי לחכות כמה דקות ולנסות שוב.'],
    ['invalid-email', 'כתובת המייל אינה תקינה'],
    ['unknown', 'משהו השתבש. כדאי לנסות שוב.'],
  ] as const)('maps %s to Hebrew', async (code, text) => {
    actions.signInWithEmail.mockImplementationOnce(() => fakeCloud.fail(code));
    const onSignedIn = renderSheet();
    fireEvent.change(email(), { target: { value: 'a@b.co' } });
    fireEvent.change(password(), { target: { value: 'x' } });
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('disables everything while a request runs, so a double tap sends once', async () => {
    const pending = deferred();
    actions.signInWithEmail.mockImplementation(() => pending.promise);
    renderSheet();
    fireEvent.change(email(), { target: { value: 'a@b.co' } });
    fireEvent.change(password(), { target: { value: 'x' } });
    await submit();
    await submit();
    expect(actions.signInWithEmail).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'התחברות' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'התחברות' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'המשך עם Google' })).toBeDisabled();
    expect(email()).toBeDisabled();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(screen.getByRole('button', { name: 'התחברות' })).toBeEnabled();
  });
});

describe('SignInSheet — create account & reset', () => {
  it('requires a name and a 6+ character password, maps email-in-use, then signs up', async () => {
    const onSignedIn = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'אין לך חשבון? יצירת חשבון' }));
    expect(screen.getByRole('heading', { name: 'יצירת חשבון' })).toBeInTheDocument();
    fireEvent.change(email(), { target: { value: 'a@b.co' } });
    fireEvent.change(password(), { target: { value: '123' } });
    await submit('יצירת חשבון');
    expect(screen.getByText('יש להזין שם')).toBeInTheDocument();
    expect(screen.getByText('הסיסמה צריכה להכיל לפחות 6 תווים')).toBeInTheDocument();
    expect(actions.signUpWithEmail).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('שם'), { target: { value: ' דנה ' } });
    fireEvent.change(password(), { target: { value: '123456' } });
    actions.signUpWithEmail.mockImplementationOnce(() => fakeCloud.fail('email-in-use'));
    await submit('יצירת חשבון');
    expect(screen.getByRole('alert')).toHaveTextContent('כבר קיים חשבון עם המייל הזה');
    await submit('יצירת חשבון');
    expect(actions.signUpWithEmail).toHaveBeenLastCalledWith('דנה', 'a@b.co', '123456');
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it('sends a password reset and confirms where it went', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'שכחתי סיסמה' }));
    expect(screen.queryByLabelText('סיסמה')).not.toBeInTheDocument();
    fireEvent.change(email(), { target: { value: 'a@b.co' } });
    await submit('שליחת קישור לאיפוס');
    expect(actions.sendPasswordReset).toHaveBeenCalledWith('a@b.co');
    expect(screen.getByRole('status')).toHaveTextContent('שלחנו קישור לאיפוס הסיסמה אל a@b.co.');
    fireEvent.click(screen.getByRole('button', { name: 'חזרה להתחברות' }));
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
  });
});
