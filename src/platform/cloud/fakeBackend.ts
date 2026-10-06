/**
 * In-memory stand-in for Firestore used by the sync engine's unit tests: one `FakeServer` (the
 * shared family) and one `FakeClient` per device. Mirrors the Firestore behaviour the engine relies
 * on: initial snapshot = all docs, later snapshots = changed docs only, latency compensation
 * (a client sees its own pending writes immediately), offline queueing and in-order replay,
 * last write wins, and echo of a device's own writes back to it.
 */
import type { CloudBackend, RemoteDoc, SnapshotInfo, WriteOp } from './backend';
import { stableStringify, SYNC_COLLECTIONS, type SyncCollection } from './records';

interface StoredDoc {
  data: unknown;
  deleted: boolean;
}

type Docs = Record<SyncCollection, Map<string, StoredDoc>>;

const emptyDocs = (): Docs =>
  Object.fromEntries(SYNC_COLLECTIONS.map((c) => [c, new Map<string, StoredDoc>()])) as Docs;

const toStored = (op: WriteOp): StoredDoc =>
  op.data === null ? { data: null, deleted: true } : { data: structuredClone(op.data), deleted: false };

export class FakeServer {
  readonly docs: Docs = emptyDocs();
  private readonly clients = new Set<FakeClient>();
  /** Number of committed write batches (to assert "no echo uploads"). */
  commits = 0;

  client(): FakeClient {
    const c = new FakeClient(this);
    this.clients.add(c);
    return c;
  }

  commit(ops: readonly WriteOp[]): void {
    for (const op of ops) this.docs[op.collection].set(op.id, toStored(op));
    this.commits++;
    for (const c of this.clients) c.refresh();
  }

  /** Live (non-tombstone) records of a collection. */
  records(collection: SyncCollection): unknown[] {
    return [...this.docs[collection].values()].filter((d) => !d.deleted).map((d) => d.data);
  }
}

interface Listener {
  collection: SyncCollection;
  onDocs: (docs: RemoteDoc[], info: SnapshotInfo) => void;
  onError: (error: unknown) => void;
  view: Map<string, string> | null;
}

export class FakeClient implements CloudBackend {
  private online = true;
  private readonly pending: { ops: WriteOp[]; resolve: () => void; reject: (e: unknown) => void }[] = [];
  private readonly listeners = new Set<Listener>();
  /** When set, the next write is rejected with this error (e.g. permission-denied). */
  failNextWrite: Error | null = null;
  private readonly server: FakeServer;

  constructor(server: FakeServer) {
    this.server = server;
  }

  listen(
    collection: SyncCollection,
    onDocs: (docs: RemoteDoc[], info: SnapshotInfo) => void,
    onError: (error: unknown) => void,
  ): () => void {
    const listener: Listener = { collection, onDocs, onError, view: null };
    this.listeners.add(listener);
    queueMicrotask(() => {
      this.emit(listener);
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  write(ops: WriteOp[]): Promise<void> {
    if (this.failNextWrite !== null) {
      const e = this.failNextWrite;
      this.failNextWrite = null;
      return Promise.reject(e);
    }
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ ops: structuredClone(ops), resolve, reject });
      this.refresh(); // latency compensation
      if (this.online) this.flush();
    });
  }

  setOnline(online: boolean): void {
    this.online = online;
    if (online) this.flush();
    this.refresh();
  }

  /** Re-evaluates every listener against server state + this client's pending writes. */
  refresh(): void {
    if (!this.online && this.pending.length === 0) return; // offline: no server pushes
    for (const l of this.listeners) {
      queueMicrotask(() => {
        this.emit(l);
      });
    }
  }

  private flush(): void {
    while (this.pending.length > 0) {
      const next = this.pending.shift();
      if (!next) break;
      this.server.commit(next.ops);
      next.resolve();
    }
  }

  private visible(collection: SyncCollection): Map<string, StoredDoc> {
    const merged = new Map(this.server.docs[collection]);
    if (!this.online) {
      // Offline: the device only knows what it saw before plus its own pending writes.
      merged.clear();
    }
    for (const { ops } of this.pending) {
      for (const op of ops) if (op.collection === collection) merged.set(op.id, toStored(op));
    }
    return merged;
  }

  private emit(l: Listener): void {
    if (!this.listeners.has(l)) return;
    const docs = this.visible(l.collection);
    const out: RemoteDoc[] = [];
    const next = new Map<string, string>(this.online ? [] : (l.view ?? []));
    for (const [id, d] of docs) {
      const json = stableStringify(d);
      next.set(id, json);
      if (l.view?.get(id) !== json) out.push({ id, data: structuredClone(d.data), deleted: d.deleted });
    }
    const initial = l.view === null;
    l.view = next;
    if (!initial && out.length === 0) return;
    l.onDocs(out, { fromCache: !this.online, hasPendingWrites: this.pending.length > 0 });
  }
}

/** Lets queued microtasks (snapshot deliveries) and promise callbacks run. */
export async function settle(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
