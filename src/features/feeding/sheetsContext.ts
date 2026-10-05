import { createContext, useContext } from 'react';
import type { FeedingEntry } from '../../domain/types';

export type FeedingSheetRequest =
  | { kind: 'timer' }
  | { kind: 'bottle' }
  | { kind: 'solid' }
  | { kind: 'edit'; entry: FeedingEntry };

export interface FeedingSheetsApi {
  open: (request: FeedingSheetRequest) => void;
  /** True while the breastfeeding timer sheet is open (the banner hides then). */
  timerSheetOpen: boolean;
}

export const FeedingSheetsContext = createContext<FeedingSheetsApi | null>(null);

/** Opens the add / edit / timer sheets from anywhere inside the app shell. */
export function useFeedingSheets(): FeedingSheetsApi {
  const ctx = useContext(FeedingSheetsContext);
  if (!ctx) throw new Error('useFeedingSheets() must be used inside <FeedingSheetsProvider>');
  return ctx;
}
