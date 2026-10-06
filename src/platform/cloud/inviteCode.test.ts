import { describe, expect, it } from 'vitest';
import {
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_TTL_MS,
  isValidInviteCode,
  normalizeInviteCode,
} from './inviteCode';

describe('invite codes', () => {
  it('uses A–Z2–9 without look-alikes', () => {
    expect(INVITE_ALPHABET).toHaveLength(31);
    for (const c of ['0', 'O', '1', 'I', 'L']) expect(INVITE_ALPHABET).not.toContain(c);
    expect(INVITE_TTL_MS).toBe(7 * 86_400_000);
  });

  it('generates valid 6-char codes from the alphabet', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode()));
    for (const c of codes) expect(isValidInviteCode(c)).toBe(true);
    expect(codes.size).toBeGreaterThan(490);
  });

  it('rejects biased bytes (rejection sampling)', () => {
    let call = 0;
    // First fill: all 255 (≥ 248, rejected); second fill: index 0 → 'A'.
    const fill = (b: Uint8Array<ArrayBuffer>) => b.fill(call++ === 0 ? 255 : 0);
    expect(generateInviteCode(fill)).toBe('AAAAAA');
  });

  it('normalises and validates user input', () => {
    expect(normalizeInviteCode(' ab-c d2 9 ')).toBe('ABCD29');
    expect(isValidInviteCode('ABCD29')).toBe(true);
    expect(isValidInviteCode('ABCD2')).toBe(false);
    expect(isValidInviteCode('ABCDO9')).toBe(false); // O is a look-alike
    expect(isValidInviteCode('abcd29')).toBe(false);
  });
});
