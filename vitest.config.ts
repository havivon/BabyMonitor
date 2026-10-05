import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Pin the timezone for every worker BEFORE they spawn: all date logic is local-time based
// and tests assert Israel-local behaviour (incl. DST transitions).
process.env.TZ = 'Asia/Jerusalem';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    env: { TZ: 'Asia/Jerusalem' },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/store/**/*.ts'],
      exclude: ['src/domain/growth/data/**', 'src/**/*.test.ts', 'src/**/index.ts'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: {
        'src/domain/**': { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
  },
});
