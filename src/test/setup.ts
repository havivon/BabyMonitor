import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

process.env.TZ = 'Asia/Jerusalem';

if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Jerusalem') {
  throw new Error('Tests must run with TZ=Asia/Jerusalem (see vitest.config.ts)');
}

// jsdom has no <dialog> modal API. Minimal polyfill: `open` attribute + `close` event, which is all
// the app relies on (Esc is simulated in tests by dispatching a `cancel` event on the dialog).
if (typeof HTMLDialogElement !== 'undefined' && !('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    show(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement, returnValue?: string) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new Event('close'));
    },
  });
}

// jsdom does not implement scrolling APIs; they are irrelevant to behaviour under test.
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

// Vitest globals are off, so Testing Library cannot auto-register its cleanup.
afterEach(() => {
  cleanup();
});
