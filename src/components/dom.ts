/** Small DOM helpers shared by overlay components (no React). */

let scrollLocks = 0;
let savedOverflow = '';

/**
 * Prevents the page behind a modal from scrolling (a native modal `<dialog>` does not).
 * Reference-counted so nested overlays work. Returns the unlock function.
 */
export function lockBodyScroll(): () => void {
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks--;
    if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
  };
}

/** False when the user asked for reduced motion, or when the environment cannot animate. */
export function prefersMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Joins the defined ids for `aria-describedby` (undefined when none). */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined || undefined;
}
