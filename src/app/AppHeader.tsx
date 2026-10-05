import type { ReactNode } from 'react';
import { useScrolled } from '../hooks/useScrolled';

export interface AppHeaderProps {
  /** Page title (rendered as the page's `<h1>`). Omit when `start` provides the identity. */
  title?: string;
  /** Content at the inline start instead of a title (e.g. the baby switcher on Home). */
  start?: ReactNode;
  /** Actions at the inline end. */
  actions?: ReactNode;
}

/** Sticky `.app-header` that shows its hairline once the page is scrolled (DESIGN §5). */
export function AppHeader({ title, start, actions }: AppHeaderProps) {
  const scrolled = useScrolled();
  return (
    <header className={`app-header${scrolled ? ' is-scrolled' : ''}`}>
      {title ? <h1 className="app-header__title">{title}</h1> : start}
      {actions && <div className="app-header__actions">{actions}</div>}
    </header>
  );
}
