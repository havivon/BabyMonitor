/**
 * The small surface the sync engine needs from a backend (Firestore in production, an in-memory
 * fake in unit tests). A backend instance is bound to one family and one signed-in user.
 */
import type { SyncCollection } from './records';

export interface RemoteDoc {
  id: string;
  /** Raw record (validated by the engine); `null` for a tombstone. */
  data: unknown;
  deleted: boolean;
  /** Timers only: uid of the parent who started the running feed. */
  startedBy?: string;
}

export interface SnapshotInfo {
  /** The data came from the local cache only (not confirmed by the server yet). */
  fromCache: boolean;
  /** Some docs in the snapshot carry local writes not yet acknowledged by the server. */
  hasPendingWrites: boolean;
}

/** A write: the record to store, or `null` to write a tombstone. */
export interface WriteOp {
  collection: SyncCollection;
  id: string;
  data: unknown;
  /** Timers only: uid of the parent who started the running feed (kept across side switches). */
  startedBy?: string;
}

export interface CloudBackend {
  /**
   * Listens to one family collection. The first callback delivers ALL current docs (cache or
   * server); later callbacks deliver changed docs only. Local pending writes are reflected
   * immediately (latency compensation), like Firestore.
   */
  listen(
    collection: SyncCollection,
    onDocs: (docs: RemoteDoc[], info: SnapshotInfo) => void,
    onError: (error: unknown) => void,
  ): () => void;
  /** Writes atomically (chunked by the backend if needed). Resolves once the server acknowledged. */
  write(ops: WriteOp[]): Promise<void>;
}

/** Connectivity source (browser `online`/`offline` events by default). */
export interface Connectivity {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export const browserConnectivity: Connectivity = {
  // `onLine` is undefined outside browsers (e.g. Node) — treat that as online.
  isOnline: () => typeof navigator === 'undefined' || (navigator as { onLine?: boolean }).onLine !== false,
  subscribe: (listener) => {
    if (typeof window === 'undefined') return () => undefined;
    const on = (): void => {
      listener(true);
    };
    const off = (): void => {
      listener(false);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  },
};
