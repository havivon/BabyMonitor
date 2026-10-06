import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

/**
 * Colors from src/styles/tokens.css (DESIGN §2): the app bar matches the warm paper background
 * (`--color-bg` light), so the standalone window blends with the header; icons use `--color-primary`.
 */
const THEME_COLOR = '#f8f5ef';
const BACKGROUND_COLOR = '#f8f5ef';

// https://vite.dev/config/
// `--mode android` builds the web assets for the Capacitor APK: everything is bundled in the app,
// so the service worker (offline cache) and source maps are left out.
export default defineConfig(({ mode }) => {
  const isAndroid = mode === 'android';
  return {
    // Relative base so the static build works from any sub-path (HashRouter handles routing).
    base: './',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      VitePWA({
        disable: isAndroid,
        registerType: 'autoUpdate',
        includeManifestIcons: false, // already matched by globPatterns (avoids duplicate precache entries)
        injectRegister: 'auto',
        manifest: {
          name: 'BabyMonitor — מעקב האכלה וגדילה',
          short_name: 'מעקב האכלה',
          description:
            'מעקב רגוע ופשוט אחר האכלות וגדילה. הכול נשמר במכשיר שלך ועובד גם בלי אינטרנט.',
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
          // The Firebase SDK (accounts & sync) is only fetched by signed-in users: don't make every
          // local-only install download it; cache it at runtime instead (works offline after first use).
          globIgnores: ['**/rubik-{arabic,cyrillic,cyrillic-ext}-*', '**/firebase-*.js', '**/firebaseRuntime-*.js'],
          runtimeCaching: [
            {
              urlPattern: /\/assets\/firebase(Runtime)?-[\w-]+\.js$/,
              handler: 'CacheFirst',
              options: { cacheName: 'firebase-sdk', expiration: { maxEntries: 10 } },
            },
          ],
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
      sourcemap: !isAndroid,
      // The lazily loaded Firebase chunk (~190 KB gzip) is the only one above Vite's 500 KB default.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // One named chunk for the Firebase SDK (+ its Capacitor plugin), loaded only on demand.
          manualChunks(id: string) {
            if (/node_modules\/(firebase|@firebase|@capacitor-firebase)\//.test(id)) return 'firebase';
            return undefined;
          },
        },
      },
    },
    server: { port: 5173 },
    preview: { port: 4173, strictPort: true },
  };
});
