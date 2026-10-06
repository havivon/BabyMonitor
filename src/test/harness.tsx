import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/toast';
import type { Baby, FeedingEntry, Measurement } from '../domain/types';
import { AccountFlowsProvider } from '../features/account/AccountFlowsProvider';
import { FeedingSheetsProvider } from '../features/feeding/FeedingSheetsProvider';
import { appStore } from '../store';

/** Resets the singleton app store and seeds one baby (+ optional data). Returns the baby. */
export function seedStore(
  data: { entries?: FeedingEntry[]; measurements?: Measurement[]; baby?: Partial<Baby> } = {},
): Baby {
  appStore.getState().resetAll();
  const baby = appStore.getState().addBaby({
    name: 'נועה',
    birthDate: '2026-07-01',
    sex: 'female',
    birthWeightG: 3300,
    ...data.baby,
  });
  appStore.setState((s) => ({
    entries: (data.entries ?? []).map((e) => ({ ...e, babyId: baby.id })),
    measurements: (data.measurements ?? []).map((m) => ({ ...m, babyId: baby.id })),
    settings: { ...s.settings, activeBabyId: baby.id },
  }));
  return baby;
}

/** Renders inside the same providers the app shell uses (router, toasts, feeding sheets). */
export function renderInShell(ui: ReactNode, route = '/'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <div className="app">
        <ToastProvider>
          <AccountFlowsProvider>
            <FeedingSheetsProvider>{ui}</FeedingSheetsProvider>
          </AccountFlowsProvider>
        </ToastProvider>
      </div>
    </MemoryRouter>,
  );
}
