/** Invite codes are 6 characters (docs/ACCOUNTS.md §3). */
export const CODE_LENGTH = 6;

/** Upper-cases and drops spaces / dashes, so "k7q-2mz" and "K7Q 2MZ" both read "K7Q2MZ". */
export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}
