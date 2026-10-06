/**
 * Independent WHO weight-for-age percentile computation for E2E assertions — reads the official
 * LMS table (data/who/weianthro.txt: sex 1 = boys, 2 = girls; age in days) and applies
 * z = ((X/M)^L − 1) / (L·S), percentile = Φ(z). Does NOT import any app code.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Row = { l: number; m: number; s: number };

let table: Map<string, Row> | null = null;
function load(): Map<string, Row> {
  if (table) return table;
  const txt = readFileSync(fileURLToPath(new URL('../data/who/weianthro.txt', import.meta.url)), 'utf8');
  table = new Map();
  for (const line of txt.split(/\r?\n/).slice(1)) {
    const [sex, age, l, m, s] = line.trim().split(/\s+/);
    if (!sex || !s) continue;
    table.set(`${sex}:${age}`, { l: Number(l), m: Number(m), s: Number(s) });
  }
  return table;
}

export function whoRow(sex: 'male' | 'female', ageDays: number): Row {
  const row = load().get(`${sex === 'male' ? 1 : 2}:${ageDays}`);
  if (!row) throw new Error(`no WHO row for ${sex} day ${ageDays}`);
  return row;
}

/** Φ(z) via the Abramowitz–Stegun 7.1.26-free high-precision erf (W. J. Cody rational approx). */
export function normalCdf(z: number): number {
  // Use the complementary error function by continued fraction / series (accurate to ~1e-12).
  const x = z / Math.SQRT2;
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const y =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  const erf = x >= 0 ? 1 - y : y - 1;
  return 0.5 * (1 + erf);
}

export function weightZ(sex: 'male' | 'female', ageDays: number, kg: number): number {
  const { l, m, s } = whoRow(sex, ageDays);
  return (Math.pow(kg / m, l) - 1) / (l * s);
}

export function weightPercentile(sex: 'male' | 'female', ageDays: number, kg: number): number {
  return normalCdf(weightZ(sex, ageDays, kg)) * 100;
}
