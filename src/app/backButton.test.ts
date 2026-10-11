import { afterEach, describe, expect, it, vi } from 'vitest';
import { backAction, cancelTopDialog, topOpenDialog } from './backButton';

describe('backAction', () => {
  const base = { dialogOpen: false, hasBabies: true };

  it('closes an open dialog before anything else', () => {
    expect(backAction({ ...base, dialogOpen: true, pathname: '/history' })).toBe('close-dialog');
    expect(backAction({ ...base, dialogOpen: true, pathname: '/' })).toBe('close-dialog');
  });

  it.each(['/history', '/growth', '/stats', '/settings'])('returns Home from %s', (pathname) => {
    expect(backAction({ ...base, pathname })).toBe('home');
  });

  it('minimizes from Home', () => {
    expect(backAction({ ...base, pathname: '/' })).toBe('minimize');
  });

  it('returns Home from "add a child", but minimizes on the first run', () => {
    expect(backAction({ ...base, pathname: '/onboarding' })).toBe('home');
    expect(backAction({ ...base, pathname: '/onboarding', hasBabies: false })).toBe('minimize');
  });
});

describe('topOpenDialog / cancelTopDialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function openDialog(parent: HTMLElement = document.body): HTMLDialogElement {
    const d = document.createElement('dialog');
    parent.appendChild(d);
    d.setAttribute('open', '');
    return d;
  }

  it('returns null and does nothing without an open dialog', () => {
    expect(topOpenDialog()).toBeNull();
    expect(cancelTopDialog()).toBe(false);
  });

  it('prefers the innermost dialog that holds focus', () => {
    const sheet = openDialog();
    const confirm = openDialog(sheet);
    const button = document.createElement('button');
    confirm.appendChild(button);
    button.focus();
    expect(topOpenDialog()).toBe(confirm);
  });

  it('falls back to the last open dialog', () => {
    openDialog();
    const second = openDialog();
    expect(topOpenDialog()).toBe(second);
  });

  it('sends a cancelable cancel event that the dialog can intercept', () => {
    const sheet = openDialog();
    const onCancel = vi.fn((e: Event) => {
      e.preventDefault();
    });
    sheet.addEventListener('cancel', onCancel);
    expect(cancelTopDialog()).toBe(true);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(sheet.open).toBe(true); // the component decides how to close
  });

  it('closes a dialog that does not handle cancel', () => {
    const plain = openDialog();
    const close = vi.spyOn(plain, 'close');
    cancelTopDialog();
    expect(close).toHaveBeenCalledOnce();
  });
});
