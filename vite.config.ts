import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Brand teal used for the manifest + theme-color until the designer's tokens settle. */
const THEME_COLOR = '#2F8F83';
const BACKGROUND_COLOR = '#F6FAF9';

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build works from any sub-path (HashRouter handles routing).
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeManifestIcons: false, // already matched by globPatterns (avoids duplicate precache entries)
      injectRegister: 'auto',
      manifest: {
        name: 'מעקב האכלה לתינוק',
        short_name: 'מעקב האכלה',
        description: 'מעקב האכלה, הנקה ומשקל לתינוק — פרטי, עובד ללא אינטרנט',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        categories: ['health', 'lifestyle', 'medical'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // public/ icons are matched by the glob; manifest icons are added by the plugin.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Rubik ships Arabic/Cyrillic subsets we never render; skip precaching them (Hebrew + Latin only).
        globIgnores: ['**/rubik-{arabic,cyrillic,cyrillic-ext}-*'],
        // WHO growth tables are lazy chunks; precache them so growth works offline.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
