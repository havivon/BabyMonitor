import { useMemo } from 'react';
import { useToast } from '../../components/toast';
import type { FeedingEntry, NewFeedingEntry } from '../../domain/types';
import { he } from '../../i18n/he';
import { appStore } from '../../store';

export interface EntryActions {
  /** Adds an entry and shows `toastText` with "בטל" (undo removes it again). */
  add: (input: NewFeedingEntry, toastText: string) => FeedingEntry;
  /** Replaces an entry; undo restores the previous version. */
  update: (next: FeedingEntry) => void;
  /** Deletes an entry; "בטל" restores it with the same id (DESIGN §6.11). */
  remove: (entry: FeedingEntry) => void;
}

/** Store writes for feeding entries, each paired with its toast + undo. */
export function useEntryActions(): EntryActions {
  const toast = useToast();
  return useMemo<EntryActions>(() => {
    const store = (): ReturnType<typeof appStore.getState> => appStore.getState();
    return {
      add: (input, toastText) => {
        const entry = store().addEntry(input);
        toast.show({
          text: toastText,
          actionLabel: he.common.undo,
          onAction: () => store().deleteEntry(entry.id),
        });
        return entry;
      },
      update: (next) => {
        const previous = store().entries.find((e) => e.id === next.id);
        store().updateEntry(next);
        toast.show({
          text: he.entry.updated,
          actionLabel: previous ? he.common.undo : undefined,
          onAction: previous ? () => store().updateEntry(previous) : undefined,
        });
      },
      remove: (entry) => {
        const removed = store().deleteEntry(entry.id);
        if (!removed) return;
        toast.show({
          text: he.entry.deleted,
          actionLabel: he.common.undo,
          onAction: () => store().restoreEntry(removed),
        });
      },
    };
  }, [toast]);
}
