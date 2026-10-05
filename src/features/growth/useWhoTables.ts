import { useCallback, useEffect, useState } from 'react';
import { loadWhoTables, type WhoTables } from '../../domain/growth/who';

export type WhoTablesState =
  { status: 'loading' } | { status: 'ready'; tables: WhoTables } | { status: 'error' };

/** Lazily loads the WHO LMS tables (separate chunks). `retry` re-attempts after a failure. */
export function useWhoTables(): { state: WhoTablesState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WhoTablesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadWhoTables().then(
      (tables) => {
        if (!cancelled) setState({ status: 'ready', tables });
      },
      () => {
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
