import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastProvider } from '../components/toast';
import { FeedingSheetsProvider } from '../features/feeding/FeedingSheetsProvider';
import { appStore, useActiveTimer, useAppStore } from '../store';

/**
 * App root: the `.app` container (it carries `app--has-timer`, which reserves room for the timer
 * banner in the page AND lifts toasts above it), the toast host and the feeding sheets host.
 */
export function Root({ children }: { children: ReactNode }) {
  const timer = useActiveTimer();
  const { pathname } = useLocation();
  const babies = useAppStore((s) => s.babies);
  const activeBabyId = useAppStore((s) => s.settings.activeBabyId);

  // Self-heal a dangling active baby (e.g. an imported backup without a valid selection).
  useEffect(() => {
    const first = babies[0];
    if (first && !babies.some((b) => b.id === activeBabyId)) {
      appStore.getState().setActiveBaby(first.id);
    }
  }, [babies, activeBabyId]);

  // Each route starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const hasTimer = Boolean(timer) && pathname !== '/onboarding';
  return (
    <div className={`app${hasTimer ? ' app--has-timer' : ''}`}>
      <ToastProvider>
        <FeedingSheetsProvider>{children}</FeedingSheetsProvider>
      </ToastProvider>
    </div>
  );
}
