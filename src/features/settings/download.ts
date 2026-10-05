/**
 * Triggers a client-side file download (no server involved). Works offline.
 */
export function downloadText(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: some browsers read the blob asynchronously after click().
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

/** Local date stamp for file names, e.g. "2026-10-05". */
export { toDateKey as fileDateStamp } from '../../domain/dates';
