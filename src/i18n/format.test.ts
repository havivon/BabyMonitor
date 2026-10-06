import { describe, expect, it } from 'vitest';
import { isolateNumbers } from './format';

const L = '⁦';
const P = '⁩';

describe('isolateNumbers', () => {
  it('isolates ranges, signed and decimal numbers', () => {
    expect(isolateNumbers('2–3 כפיות')).toBe(`${L}2–3${P} כפיות`);
    expect(isolateNumbers('2-3 כפיות')).toBe(`${L}2-3${P} כפיות`);
    expect(isolateNumbers('עלייה של +27 גר׳')).toBe(`עלייה של ${L}+27${P} גר׳`);
    expect(isolateNumbers('−0.5 ו-1,5')).toBe(`${L}−0.5${P} ו-${L}1,5${P}`);
  });

  it('leaves text without numbers untouched and is idempotent', () => {
    expect(isolateNumbers('חצי קערית')).toBe('חצי קערית');
    const once = isolateNumbers('2–3 כפיות · 50 גר׳');
    expect(isolateNumbers(once)).toBe(once);
  });
});
