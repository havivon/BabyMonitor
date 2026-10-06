/**
 * Firestore document shape for synced records (docs/ACCOUNTS.md §3):
 * `families/{fid}/{collection}/{id}` = `{ v: 1, data: <record> | null, deleted, updatedAt, updatedBy }`.
 * The record lives under `data` (not inline) so the rules can validate meta fields independently of
 * the record schema, and a tombstone is simply `{ deleted: true, data: null }`.
 */
import { parseRecord, type RecordKind } from '../../domain/backup';
import type { ActiveTimer, Baby, FeedingEntry, Measurement } from '../../domain/types';

export const SYNC_COLLECTIONS = ['babies', 'entries', 'measurements', 'timers'] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export interface SyncRecordTypes {
  babies: Baby;
  entries: FeedingEntry;
  measurements: Measurement;
  timers: ActiveTimer;
}
export type SyncRecord = SyncRecordTypes[SyncCollection];

export const RECORD_KIND: { [C in SyncCollection]: RecordKind } = {
  babies: 'baby',
  entries: 'entry',
  measurements: 'measurement',
  timers: 'timer',
};

export const SYNC_DOC_VERSION = 1;

/** Document id of a record: its `id`, or `babyId` for timers (one running timer per baby). */
export function recordId(collection: SyncCollection, record: SyncRecord): string {
  return collection === 'timers' ? (record as ActiveTimer).babyId : (record as Baby).id;
}

/** Validates a remote record; `null` for malformed data (ignored by the sync engine). */
export function decodeRecord<C extends SyncCollection>(collection: C, raw: unknown): SyncRecordTypes[C] | null {
  return parseRecord(RECORD_KIND[collection], raw) as SyncRecordTypes[C] | null;
}

/** JSON with object keys sorted recursively — key order never makes two equal records differ. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
