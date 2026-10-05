import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { BottleSheet } from './BottleSheet';
import { BreastEditSheet } from './BreastEditSheet';
import {
  FeedingSheetsContext,
  type FeedingSheetRequest,
  type FeedingSheetsApi,
} from './sheetsContext';
import { SolidSheet } from './SolidSheet';
import { TimerSheet } from './TimerSheet';

/**
 * Hosts the feeding sheets once for the whole shell, so the timer banner (any tab), Home tiles and
 * timeline items can all open them. Each open gets a fresh `key`, which remounts the sheet and
 * re-initialises its form; on close the request is kept so the exit animation shows real content.
 */
export function FeedingSheetsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(FeedingSheetRequest & { key: number }) | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((r: FeedingSheetRequest) => {
    setRequest((prev) => ({ ...r, key: (prev?.key ?? 0) + 1 }));
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const timerSheetOpen = isOpen && request?.kind === 'timer';
  const api = useMemo<FeedingSheetsApi>(() => ({ open, timerSheetOpen }), [open, timerSheetOpen]);

  let sheet: ReactNode = null;
  if (request) {
    const props = { key: request.key, open: isOpen, onClose: close };
    if (request.kind === 'timer') sheet = <TimerSheet {...props} />;
    else if (request.kind === 'bottle') sheet = <BottleSheet {...props} />;
    else if (request.kind === 'solid') sheet = <SolidSheet {...props} />;
    else {
      const { entry } = request;
      if (entry.type === 'bottle') sheet = <BottleSheet {...props} entry={entry} />;
      else if (entry.type === 'solid') sheet = <SolidSheet {...props} entry={entry} />;
      else sheet = <BreastEditSheet {...props} entry={entry} />;
    }
  }

  return (
    <FeedingSheetsContext.Provider value={api}>
      {children}
      {sheet}
    </FeedingSheetsContext.Provider>
  );
}
