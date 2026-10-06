import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useFeedingSheets } from '../features/feeding/sheetsContext';
import { appStore, useAppStore } from '../store';
import { TabBar } from './TabBar';
import { TimerBanner } from './TimerBanner';
import { useBannerTimer } from './useBannerTimer';

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
  const timer = useBannerTimer();
  const activeBabyId = useAppStore((st) => st.settings.activeBabyId);
  const babyName = useAppStore((st) => st.babies.find((b) => b.id === timer?.babyId)?.name ?? '');
  const sheets = useFeedingSheets();
  const { pathname } = useLocation();
  if (!hasBabies) return <Navigate to="/onboarding" replace />;

  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
      {/* Home's hero already shows the live feed (review P2-1); the banner is for the other tabs. */}
      {timer && !sheets.timerSheetOpen && pathname !== '/' && (
        <TimerBanner
          timer={timer}
          // Another baby's feed is labelled with its name; opening it switches to that baby.
          babyName={timer.babyId === activeBabyId ? undefined : babyName}
          onOpen={() => {
            if (timer.babyId !== activeBabyId) appStore.getState().setActiveBaby(timer.babyId);
            sheets.open({ kind: 'timer' });
          }}
        />
      )}
      <TabBar />
    </>
  );
}
