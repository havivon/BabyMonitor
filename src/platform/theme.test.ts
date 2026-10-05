import { describe, expect, it } from 'vitest';
import { applyTheme, syncThemeWithStore } from './theme';
import { createAppStore } from '../store/appStore';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe('theme', () => {
  it('sets or removes data-theme', () => {
    const el = document.createElement('html');
    applyTheme('dark', el);
    expect(el.getAttribute('data-theme')).toBe('dark');
    applyTheme('auto', el);
    expect(el.hasAttribute('data-theme')).toBe(false);
  });

  it('follows the store setting until unsubscribed', () => {
    const el = document.createElement('html');
    const store = createAppStore({ storage: memory() });
    const stop = syncThemeWithStore(store, el);
    expect(el.hasAttribute('data-theme')).toBe(false);
    store.getState().updateSettings({ theme: 'light' });
    expect(el.getAttribute('data-theme')).toBe('light');
    store.getState().updateSettings({ volumeUnit: 'oz' });
    expect(el.getAttribute('data-theme')).toBe('light');
    stop();
    store.getState().updateSettings({ theme: 'dark' });
    expect(el.getAttribute('data-theme')).toBe('light');
  });
});
