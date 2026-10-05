import { Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useFeedingSheets } from '../features/feeding/sheetsContext';
import { useActiveTimer, useAppStore } from '../store';
import { TabBar } from './TabBar';
import { TimerBanner } from './TimerBanner';

/** Fallback while a lazy route loads: keeps the page column so nothing jumps. */
function PageFallback() {
  return <main className="page" aria-busy="true" />;
}

/**
 * Layout of the tabbed screens: lazy page outlet, persistent timer banner and the tab bar.
 * First run (no baby yet) redirects to onboarding.
 */
export function AppLayout() {
  const hasBabies = useAppStore((s) => s.babies.length > 0);
  const timer = useActiveTimer();
  const sheets = useFeedingSheets();
  if (!hasBabies) return <Navigate to="/onboarding" replace />;

  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
      {timer && !sheets.timerSheetOpen && (
        <TimerBanner timer={timer} onOpen={() => sheets.open({ kind: 'timer' })} />
      )}
      <TabBar />
    </>
  );
}
