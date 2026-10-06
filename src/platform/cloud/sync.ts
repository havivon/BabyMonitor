/**
 * Two-way sync between the local Zustand store and a family's cloud collections
 * (docs/ACCOUNTS.md §4). The store stays the single source of truth for the UI.
 *
 * Model
 * - `known[collection]` maps id → stable JSON of the version we believe the server has (from a
 *   remote snapshot, or from our own write). It is the baseline for both directions:
 *   - DOWN: a remote doc that differs from the local record is applied to the store; `known` is
 *     updated first, so the resulting store change produces no upload (no echo loops).
 *   - UP: on every store change, records whose JSON differs from `known` are written; ids that
 *     disappeared locally are written as tombstones (`deleted: true`).
 * - Tombstones win over stale local copies: a remote tombstone removes the record locally, so a
 *   delete made on one phone is never resurrected by the other phone's old copy.
 * - Conflicts are last-write-wins per document (the server's final version reaches every device).
 * - Uploads start only after every collection delivered its first snapshot; then one reconcile pass
 *   uploads everything the device has that the family does not (initial upload / merge / offline
 *   edits made before a reload).
 * - Settings (units, theme) are never synced; `activeBabyId` is only repaired locally.
 */
import type { PersistedData } from '../../store/persistence';
import type { ActiveTimer, Baby, FeedingEntry, Measurement } from '../../domain/types';
import { browserConnectivity, type CloudBackend, type Connectivity, type RemoteDoc, type WriteOp } from './backend';
import { decodeRecord, recordId, stableStringify, SYNC_COLLECTIONS, type SyncCollection, type SyncRecord } from './records';
import type { SyncStatus } from './types';

/** The part of the app store the engine reads and writes. */
export interface SyncStore {
  getState(): PersistedData;
  setState(partial: Partial<PersistedData>): void;
  subscribe(listener: (state: PersistedData, previous: PersistedData) => void): () => void;
}

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncedAt: number | null;
}

export interface SyncEngineOptions {
  store: SyncStore;
  backend: CloudBackend;
  onStatus?: (info: SyncStatusInfo) => void;
  connectivity?: Connectivity;
  now?: () => number;
  /** Called for remote docs that fail validation (default: console.warn). */
  onInvalidDoc?: (collection: SyncCollection, id: string) => void;
}

export interface SyncEngine {
  /** Resolves once every collection delivered its first snapshot and the reconcile pass ran. */
  readonly ready: Promise<void>;
  readonly status: SyncStatusInfo;
  /** Stops listeners and store subscription (pending writes still complete in the backend). */
  stop(): void;
}

type RecordMap = Map<string, SyncRecord>;

/** Records of one collection in the store, keyed by document id. */
export function localRecords(state: PersistedData, collection: SyncCollection): RecordMap {
  const list: readonly SyncRecord[] =
    collection === 'babies'
      ? state.babies
      : collection === 'entries'
        ? state.entries
        : collection === 'measurements'
          ? state.measurements
          : Object.values(state.activeTimers);
  return new Map(list.map((r) => [recordId(collection, r), r]));
}

/** Store patch for one collection from its full record map (preserves array order where possible). */
function patchFor(state: PersistedData, collection: SyncCollection, records: RecordMap): Partial<PersistedData> {
  const ordered = (current: readonly SyncRecord[]): SyncRecord[] => {
    const out: SyncRecord[] = [];
    const seen = new Set<string>();
    for (const r of current) {
      const id = recordId(collection, r);
      const next = records.get(id);
      if (next) {
        out.push(next);
        seen.add(id);
      }
    }
    for (const [id, r] of records) if (!seen.has(id)) out.push(r);
    return out;
  };
  switch (collection) {
    case 'babies':
      return { babies: ordered(state.babies) as Baby[] };
    case 'entries':
      return { entries: ordered(state.entries) as FeedingEntry[] };
    case 'measurements':
      return { measurements: ordered(state.measurements) as Measurement[] };
    case 'timers':
      return { activeTimers: Object.fromEntries([...records].map(([id, t]) => [id, t as ActiveTimer])) };
  }
}

export function startSync(options: SyncEngineOptions): SyncEngine {
  const { store, backend } = options;
  const connectivity = options.connectivity ?? browserConnectivity;
  const now = options.now ?? Date.now;
  const onInvalid =
    options.onInvalidDoc ??
    ((collection: SyncCollection, id: string) => {
      console.warn(`[sync] ignoring malformed ${collection}/${id}`);
    });

  const known = Object.fromEntries(SYNC_COLLECTIONS.map((c) => [c, new Map<string, string>()])) as Record<
    SyncCollection,
    Map<string, string>
  >;
  const tombstoned = Object.fromEntries(SYNC_COLLECTIONS.map((c) => [c, new Set<string>()])) as Record<
    SyncCollection,
    Set<string>
  >;
  const firstSnapshot = new Set<SyncCollection>();
  const confirmedByServer = new Set<SyncCollection>();
  let pendingWrites = 0;
  let online = connectivity.isOnline();
  let error = false;
  let stopped = false;
  let applyingRemote = false;
  let reconciled = false;
  let published = false;
  const statusInfo: SyncStatusInfo = { status: 'connecting', lastSyncedAt: null };

  const publish = (): void => {
    if (stopped) return;
    const status: SyncStatus = error
      ? 'error'
      : !online
        ? 'offline'
        : !reconciled || confirmedByServer.size < SYNC_COLLECTIONS.length
          ? 'connecting'
          : pendingWrites > 0
            ? 'syncing'
            : 'synced';
    // Every publish in the synced state means the server just confirmed something.
    if (status === 'synced') statusInfo.lastSyncedAt = now();
    else if (status === statusInfo.status && published) return;
    published = true;
    statusInfo.status = status;
    options.onStatus?.({ ...statusInfo });
  };

  // ---------------------------------------------------------------- DOWN

  const applyRemote = (collection: SyncCollection, docs: RemoteDoc[]): void => {
    const state = store.getState();
    const records = localRecords(state, collection);
    let changed = false;
    for (const doc of docs) {
      if (doc.deleted) {
        tombstoned[collection].add(doc.id);
        known[collection].delete(doc.id);
        if (records.delete(doc.id)) changed = true;
        continue;
      }
      const record = decodeRecord(collection, doc.data);
      if (!record || recordId(collection, record) !== doc.id) {
        onInvalid(collection, doc.id);
        continue;
      }
      const json = stableStringify(record);
      tombstoned[collection].delete(doc.id);
      known[collection].set(doc.id, json);
      const local = records.get(doc.id);
      if (!local || stableStringify(local) !== json) {
        records.set(doc.id, record);
        changed = true;
      }
    }
    if (!changed) return;
    const patch = patchFor(state, collection, records);
    if (collection === 'babies') {
      const babies = patch.babies ?? [];
      const active = state.settings.activeBabyId;
      if (active === null || !babies.some((b) => b.id === active)) {
        patch.settings = { ...state.settings, activeBabyId: babies[0]?.id ?? null };
      }
    }
    applyingRemote = true;
    try {
      store.setState(patch);
    } finally {
      applyingRemote = false;
    }
  };

  // ---------------------------------------------------------------- UP

  const collectUploads = (state: PersistedData): WriteOp[] => {
    const ops: WriteOp[] = [];
    for (const collection of SYNC_COLLECTIONS) {
      const records = localRecords(state, collection);
      const baseline = known[collection];
      for (const [id, record] of records) {
        const json = stableStringify(record);
        if (baseline.get(id) === json) continue;
        baseline.set(id, json);
        tombstoned[collection].delete(id);
        ops.push({ collection, id, data: record });
      }
      for (const id of [...baseline.keys()]) {
        if (records.has(id)) continue;
        baseline.delete(id);
        tombstoned[collection].add(id);
        ops.push({ collection, id, data: null });
      }
    }
    return ops;
  };

  const upload = (ops: WriteOp[]): void => {
    if (ops.length === 0 || stopped) return;
    pendingWrites++;
    publish();
    backend.write(ops).then(
      () => {
        pendingWrites--;
        publish();
      },
      (e: unknown) => {
        pendingWrites--;
        error = true;
        console.error('[sync] write failed', e);
        publish();
      },
    );
  };

  const onStoreChange = (state: PersistedData): void => {
    if (applyingRemote || !reconciled || stopped) return;
    upload(collectUploads(state));
  };

  // ---------------------------------------------------------------- wiring

  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const unsubscribers: (() => void)[] = [];
  for (const collection of SYNC_COLLECTIONS) {
    unsubscribers.push(
      backend.listen(
        collection,
        (docs, info) => {
          if (stopped) return;
          error = false;
          applyRemote(collection, docs);
          firstSnapshot.add(collection);
          if (!info.fromCache) confirmedByServer.add(collection);
          if (!reconciled && firstSnapshot.size === SYNC_COLLECTIONS.length) {
            reconciled = true;
            upload(collectUploads(store.getState()));
            resolveReady();
          }
          publish();
        },
        (e) => {
          console.error(`[sync] listener ${collection} failed`, e);
          error = true;
          publish();
        },
      ),
    );
  }
  unsubscribers.push(store.subscribe(onStoreChange));
  unsubscribers.push(
    connectivity.subscribe((isOnline) => {
      online = isOnline;
      publish();
    }),
  );
  publish();

  return {
    ready,
    get status() {
      return { ...statusInfo };
    },
    stop() {
      stopped = true;
      for (const u of unsubscribers) u();
      resolveReady();
    },
  };
}
