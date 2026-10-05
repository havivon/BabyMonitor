/**
 * Applies the theme preference to `<html data-theme>` (the designer's tokens.css keys off it):
 * 'light' / 'dark' force a theme; 'auto' removes the attribute so `prefers-color-scheme` decides.
 */
import type { ThemePreference } from '../domain/types';
import type { AppStore } from '../store/appStore';

export function applyTheme(
  theme: ThemePreference,
  root: HTMLElement = document.documentElement,
): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Applies the current theme now and whenever it changes. Returns an unsubscribe function. */
export function syncThemeWithStore(
  store: AppStore,
  root: HTMLElement = document.documentElement,
): () => void {
  let current = store.getState().settings.theme;
  applyTheme(current, root);
  return store.subscribe((state) => {
    if (state.settings.theme !== current) {
      current = state.settings.theme;
      applyTheme(current, root);
    }
  });
}
