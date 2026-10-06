import { useTimerStarter } from '../../platform/cloud';

/**
 * Name of the OTHER parent who started the shared running feed of `babyId` (DESIGN §15.9:
 * "התחילה ב-06:52 · נועם"), or `null` (not in a family, started on this phone, or unknown).
 */
export function useOtherStarter(babyId: string | null | undefined): string | null {
  const starter = useTimerStarter(babyId);
  return starter && !starter.isMe && starter.name ? starter.name : null;
}
