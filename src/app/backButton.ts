/**
 * Android hardware/gesture "back" (Capacitor `backButton` event). The app's tabs are separate
 * routes, so the WebView's own history would walk back through every tab visited. Instead:
 *   1. an open sheet/dialog closes first;
 *   2. any other screen returns to Home;
 *   3. on Home (or the first-run onboarding) the app goes to the background — the phone's home
 *      screen — without being killed, so a running breastfeeding timer keeps its state.
 */

export type BackAction = 'close-dialog' | 'home' | 'minimize';

export interface BackContext {
  /** A modal sheet or confirmation dialog is open. */
  dialogOpen: boolean;
  /** Current route path (HashRouter `location.pathname`). */
  pathname: string;
  /** At least one baby exists (onboarding is then "add a child", not the first run). */
  hasBabies: boolean;
}

export function backAction({ dialogOpen, pathname, hasBabies }: BackContext): BackAction {
  if (dialogOpen) return 'close-dialog';
  if (pathname === '/' || pathname === '') return 'minimize';
  // First run: there is no Home to return to.
  if (pathname === '/onboarding' && !hasBabies) return 'minimize';
  return 'home';
}

/**
 * The dialog the user is looking at: the innermost open dialog holding focus (a confirmation
 * nested in a sheet), otherwise the last open one in document order.
 */
export function topOpenDialog(doc: Document = document): HTMLDialogElement | null {
  const focused = doc.activeElement?.closest('dialog[open]');
  if (focused instanceof HTMLDialogElement) return focused;
  const open = doc.querySelectorAll<HTMLDialogElement>('dialog[open]');
  return open.length > 0 ? (open[open.length - 1] ?? null) : null;
}

/**
 * Closes the top dialog the same way Esc does: a cancelable `cancel` event, which our Sheet and
 * ConfirmDialog intercept to run their own close logic (incl. "discard changes?" for dirty forms).
 * Returns false when no dialog is open.
 */
export function cancelTopDialog(doc: Document = document): boolean {
  const dialog = topOpenDialog(doc);
  if (!dialog) return false;
  const event = new Event('cancel', { cancelable: true });
  // A dialog without a cancel handler (none today) still closes, like Esc would.
  if (dialog.dispatchEvent(event)) dialog.close();
  return true;
}
