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
  const text = he.account.errors[code];
  // An unexpected failure carries the provider's own message (e.g. Google Play services' "10:"
  // developer error); showing it lets the user send a screenshot that identifies the cause.
  if (code === 'unknown') {
    const detail = errorDetail(error);
    if (detail) return `${text} (${detail})`;
  }
  return text;
}

/** Short technical detail of an error, trimmed so it fits under the message. */
export function errorDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean || clean === 'unknown' || clean === 'unknown error') return '';
  return clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
}
