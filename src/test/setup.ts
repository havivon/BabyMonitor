import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

process.env.TZ = 'Asia/Jerusalem';

if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Jerusalem') {
  throw new Error('Tests must run with TZ=Asia/Jerusalem (see vitest.config.ts)');
}

// Vitest globals are off, so Testing Library cannot auto-register its cleanup.
afterEach(() => {
  cleanup();
});
