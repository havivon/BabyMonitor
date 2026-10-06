/**
 * `CloudBackend` on Cloud Firestore: `families/{familyId}/{collection}/{id}`.
 */
import {
  collection as col,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { CloudBackend, RemoteDoc, WriteOp } from './backend';
import { SYNC_DOC_VERSION, type SyncCollection } from './records';

/** Firestore allows 500 operations per batch; stay below it. */
const BATCH_LIMIT = 450;

function toRemote(snap: QueryDocumentSnapshot): RemoteDoc {
  const d = snap.data();
  const deleted = d.deleted === true;
  return { id: snap.id, data: deleted ? null : (d.data as unknown), deleted };
}

export function createFirestoreBackend(db: Firestore, familyId: string, uid: string): CloudBackend {
  const ref = (collection: SyncCollection) => col(db, 'families', familyId, collection);
  return {
    listen(collection, onDocs, onError) {
      let first = true;
      return onSnapshot(
        ref(collection),
        // Metadata changes too: the engine needs the cache → server transition for its status.
        { includeMetadataChanges: true },
        (snap) => {
          const docs: RemoteDoc[] = first
            ? snap.docs.map(toRemote)
            : snap.docChanges().map((c) =>
                c.type === 'removed' ? { id: c.doc.id, data: null, deleted: true } : toRemote(c.doc),
              );
          first = false;
          onDocs(docs, { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites });
        },
        onError,
      );
    },

    async write(ops: WriteOp[]) {
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + BATCH_LIMIT)) {
          batch.set(doc(ref(op.collection), op.id), {
            v: SYNC_DOC_VERSION,
            data: op.data,
            deleted: op.data === null,
            updatedAt: serverTimestamp(),
            updatedBy: uid,
          });
        }
        await batch.commit();
      }
    },
  };
}
