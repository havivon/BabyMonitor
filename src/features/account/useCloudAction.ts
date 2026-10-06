import { useCallback, useEffect, useRef, useState } from 'react';
import type { CloudErrorCode } from '../../platform/cloud';
import { cloudErrorCode, cloudErrorMessage } from './cloudErrors';

export interface CloudAction {
  pending: boolean;
  /** Hebrew error of the last failed run (null after success, a cancel, or `clearError`). */
  error: string | null;
  /** Code of the last failure ('cancelled' included, with `error` null), for field routing. */
  errorCode: CloudErrorCode | null;
  /** Runs `fn`; resolves `true` on success, `false` on failure (error stored for display). */
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  clearError: () => void;
}

/**
 * Pending/error state for one cloud action button or form. Ignores re-entry while pending (no
 * double submits) and never sets state after unmount (a sheet may close on success).
 */
export function useCloudAction(): CloudAction {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ code: CloudErrorCode; message: string | null } | null>(
    null,
  );
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setFailure(null);
    try {
      await fn();
      return true;
    } catch (e) {
      if (mounted.current) setFailure({ code: cloudErrorCode(e), message: cloudErrorMessage(e) });
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  const clearError = useCallback(() => setFailure(null), []);
  return {
    pending,
    error: failure?.message ?? null,
    errorCode: failure?.code ?? null,
    run,
    clearError,
  };
}
