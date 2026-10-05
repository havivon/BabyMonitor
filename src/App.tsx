import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { Root } from './app/Root';

// Route-level code splitting: each screen (and Recharts, used by growth/stats) loads on demand.
const HomePage = lazy(() => import('./features/home').then((m) => ({ default: m.HomePage })));
const HistoryPage = lazy(() =>
  import('./features/history').then((m) => ({ default: m.HistoryPage })),
);
const GrowthPage = lazy(() => import('./features/growth').then((m) => ({ default: m.GrowthPage })));
const StatsPage = lazy(() => import('./features/stats').then((m) => ({ default: m.StatsPage })));
const SettingsPage = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.SettingsPage })),
);
const OnboardingPage = lazy(() =>
  import('./features/onboarding').then((m) => ({ default: m.OnboardingPage })),
);

export default function App() {
  return (
    <HashRouter>
      <Root>
        <Routes>
          <Route
            path="/onboarding"
            element={
              <Suspense fallback={null}>
                <OnboardingPage />
              </Suspense>
            }
          />
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="growth" element={<GrowthPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Root>
    </HashRouter>
  );
}
