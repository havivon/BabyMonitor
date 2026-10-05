/**
 * React bindings for the singleton app store.
 */
import { useStore } from 'zustand';
import { createAppStore, type AppState, type AppStore } from './appStore';
import {
  selectActiveBaby,
  selectActiveEntries,
  selectActiveMeasurements,
  selectActiveTimer,
  selectSettings,
} from './selectors';

/** The app-wide store instance (persisted to localStorage). */
export const appStore: AppStore = createAppStore();

/** Subscribe to a slice of the app store. Selectors must return stable references (see selectors.ts). */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export const useActiveBaby = () => useAppStore(selectActiveBaby);
export const useActiveEntries = () => useAppStore(selectActiveEntries);
export const useActiveMeasurements = () => useAppStore(selectActiveMeasurements);
export const useActiveTimer = () => useAppStore(selectActiveTimer);
export const useSettings = () => useAppStore(selectSettings);

/**
 * Keeps tabs/windows in sync: when another tab writes the store key, rehydrate from storage.
 * Returns an unsubscribe function.
 */
export function enableCrossTabSync(store: AppStore = appStore, key = 'babymonitor:v1'): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === key) void store.persist.rehydrate();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
