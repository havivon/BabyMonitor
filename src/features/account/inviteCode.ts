import { INVITE_CODE_LENGTH, isValidInviteCode, normalizeInviteCode } from '../../platform/cloud';

/**
 * Invite-code typing aid (DESIGN §15.8): upper-cases, strips spaces/dashes (pasted "k7q-2mx" →
 * "K7Q2MX") and silently drops characters outside the invite alphabet (A–Z, 2–9 without the
 * look-alikes I, L, O, 0, 1), using the cloud module's own validator as the single source.
 */
export function cleanInviteInput(raw: string): string {
  return Array.from(normalizeInviteCode(raw))
    .filter((c) => isValidInviteCode(c.repeat(INVITE_CODE_LENGTH)))
    .join('')
    .slice(0, INVITE_CODE_LENGTH);
}
