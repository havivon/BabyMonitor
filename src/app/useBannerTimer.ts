import { useMemo } from 'react';
import type { ActiveTimer } from '../domain/types';
import { useAppStore } from '../store';

/**
 * The timer the shell surfaces: the active baby's, else any other baby's running timer (twins —
 * a feed for the non-active baby must not become invisible, BUG-010). Ignores timers of babies
 * that no longer exist.
 */
export function useBannerTimer(): ActiveTimer | null {
  const timers = useAppStore((s) => s.activeTimers);
  const babies = useAppStore((s) => s.babies);
  const activeId = useAppStore((s) => s.settings.activeBabyId);
  return useMemo(() => {
    if (activeId && timers[activeId]) return timers[activeId];
    return babies.map((b) => timers[b.id]).find((t): t is ActiveTimer => Boolean(t)) ?? null;
  }, [timers, babies, activeId]);
}
