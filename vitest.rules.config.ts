import { defineConfig } from 'vitest/config';

/**
 * Emulator-backed tests (security rules + two-device integration). Not part of `npm test`;
 * run with `npm run test:rules`, which starts the Auth + Firestore emulators.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
