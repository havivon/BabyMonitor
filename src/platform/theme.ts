/**
 * Applies the theme preference to `<html data-theme>` (the designer's tokens.css keys off it):
 * 'light' / 'dark' force a theme; 'auto' removes the attribute so `prefers-color-scheme` decides.
 */
import type { ThemePreference } from '../domain/types';
import type { AppStore } from '../store/appStore';

/** `--color-bg` per theme (tokens.css) — the browser/status bar color (DESIGN: theme-color). */
export const THEME_COLORS = { light: '#f8f5ef', dark: '#141211' } as const;
const MEDIA = {
  light: '(prefers-color-scheme: light)',
  dark: '(prefers-color-scheme: dark)',
} as const;

/**
 * Keeps the two `<meta name="theme-color" media=…>` tags (index.html) in sync: with 'auto' each
 * follows its media query; a forced theme sets both tags to that theme's color.
 */
export function applyThemeColorMeta(theme: ThemePreference, doc: Document = document): void {
  for (const scheme of ['light', 'dark'] as const) {
    const meta = doc.querySelector<HTMLMetaElement>(
      `meta[name="theme-color"][media="${MEDIA[scheme]}"]`,
    );
    if (meta) meta.content = THEME_COLORS[theme === 'auto' ? scheme : theme];
  }
}

export function applyTheme(
  theme: ThemePreference,
  root: HTMLElement = document.documentElement,
): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  applyThemeColorMeta(theme, root.ownerDocument);
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
