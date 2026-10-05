import { useEffect, useState } from 'react';

/**
 * Current time (epoch ms) that re-renders the caller every `intervalMs`.
 *
 * - Ticks are aligned to the interval boundary (e.g. whole seconds), so several live clocks on
 *   screen flip together instead of drifting apart.
 * - Pauses while the document is hidden (no wasted work in a background tab / locked phone) and
 *   catches up immediately when it becomes visible again.
 *
 * Elapsed values must always be DERIVED from this timestamp (never accumulated), so a missed or
 * late tick can never make a timer wrong — only momentarily stale.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = (): void => {
      const delay = intervalMs - (Date.now() % intervalMs) || intervalMs;
      timeoutId = setTimeout(tick, delay);
    };
    const tick = (): void => {
      setNow(Date.now());
      schedule();
    };
    const stop = (): void => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = undefined;
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else if (timeoutId === undefined) {
        tick();
      }
    };

    if (document.visibilityState !== 'hidden') schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}
