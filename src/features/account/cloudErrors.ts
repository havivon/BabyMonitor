import { CloudError, type CloudErrorCode } from '../../platform/cloud';
import { he } from '../../i18n/he';

/** Normalises anything an action rejects with to a `CloudErrorCode`. */
export function cloudErrorCode(error: unknown): CloudErrorCode {
  return error instanceof CloudError ? error.code : 'unknown';
}

/**
 * Hebrew message for a cloud error, or `null` when nothing should be shown ('cancelled' — the user
 * closed Google's sheet themselves).
 */
export function cloudErrorMessage(error: unknown): string | null {
  const code = cloudErrorCode(error);
  if (code === 'cancelled') return null;
  return he.account.errors[code];
}
