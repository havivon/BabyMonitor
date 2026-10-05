import type { BottleEntry, BreastEntry, Measurement, Side, SolidEntry } from '../domain/types';

/** Epoch ms for a LOCAL wall-clock time (TZ is pinned to Asia/Jerusalem in tests). */
export function local(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number {
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

let seq = 0;
const nextId = (prefix: string): string => `${prefix}${++seq}`;

export function breast(
  startedAt: number,
  segments: [Side, number][],
  extra: Partial<BreastEntry> = {},
): BreastEntry {
  let t = startedAt;
  const segs = segments.map(([side, minutes]) => {
    const seg = { side, startedAt: t, endedAt: t + minutes * MIN };
    t = seg.endedAt;
    return seg;
  });
  return {
    id: nextId('b'),
    babyId: 'baby1',
    type: 'breast',
    startedAt,
    endedAt: t,
    segments: segs,
    ...extra,
  };
}

export function bottle(
  at: number,
  amountMl: number,
  extra: Partial<BottleEntry> = {},
): BottleEntry {
  return {
    id: nextId('o'),
    babyId: 'baby1',
    type: 'bottle',
    at,
    content: 'formula',
    amountMl,
    ...extra,
  };
}

export function solid(at: number, foods: string[], extra: Partial<SolidEntry> = {}): SolidEntry {
  return { id: nextId('s'), babyId: 'baby1', type: 'solid', at, foods, ...extra };
}

export function measurement(date: string, fields: Partial<Measurement>): Measurement {
  return { id: nextId('m'), babyId: 'baby1', date, ...fields };
}
