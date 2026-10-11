import { useEffect, useRef } from 'react';
import { useToast } from '../../components/toast';
import { he } from '../../i18n/he';
import { useCloud } from '../../platform/cloud';
import {
  clearOwnFamilyExit,
  consumeOwnFamilyExit,
  readLastFamily,
  writeLastFamily,
} from './familyExit';

/** Long enough to read the whole sentence (default toast is 3.5 s). */
const NOTICE_MS = 8000;

/**
 * One-time toast "הוסרת מהמשפחה. הנתונים נשארו בטלפון הזה." when the signed-in account's family
 * goes away without this device leaving it (another member removed us) — during the session, or
 * while the app was closed (the last family is remembered per account). Membership is only judged
 * once it is known (`ready` and status ≠ 'connecting').
 */
export function useRemovedFromFamilyNotice(): void {
  const { ready, user, family, status } = useCloud();
  const toast = useToast();
  const uid = user?.uid ?? null;
  const familyId = family?.id ?? null;
  // At startup the service briefly reports a user with `family: null` while `ready` is false;
  // only `ready` + status ≠ 'connecting' means the family membership is really known.
  const membershipKnown = uid !== null && ready && status !== 'connecting';
  const hadFamily = useRef<string | null>(null);

  useEffect(() => {
    if (uid === null) {
      // Signed out (or not yet): a pending own-exit mark belongs to that sign-out.
      hadFamily.current = null;
      clearOwnFamilyExit();
      return;
    }
    if (!membershipKnown) return;
    if (familyId !== null) {
      hadFamily.current = familyId;
      writeLastFamily({ uid, familyId });
      return;
    }
    const last = readLastFamily();
    const wasInFamily = hadFamily.current !== null || last?.uid === uid;
    hadFamily.current = null;
    if (last?.uid === uid) writeLastFamily(null);
    if (!wasInFamily) return;
    if (consumeOwnFamilyExit()) return;
    toast.show({ text: he.account.family.removedMe, durationMs: NOTICE_MS });
  }, [uid, familyId, membershipKnown, toast]);
}
