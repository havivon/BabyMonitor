/**
 * Family invite codes: 6 characters from an unambiguous alphabet (no 0/O, 1/I/L), valid 7 days.
 */

/** A–Z and 2–9 without the look-alikes 0, O, 1, I, L. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const VALID_CODE = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
const cryptoFill: RandomFill = (bytes) => {
  crypto.getRandomValues(bytes);
  return bytes;
};

/** Uniformly random code (rejection sampling, so no modulo bias). */
export function generateInviteCode(fill: RandomFill = cryptoFill): string {
  const n = INVITE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let out = '';
  while (out.length < INVITE_CODE_LENGTH) {
    for (const b of fill(new Uint8Array(16))) {
      if (b < limit && out.length < INVITE_CODE_LENGTH) out += INVITE_ALPHABET.charAt(b % n);
    }
  }
  return out;
}

/** User input → canonical code: upper-case, spaces/dashes removed. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s\-–_]/g, '');
}

export function isValidInviteCode(code: string): boolean {
  return VALID_CODE.test(code);
}
