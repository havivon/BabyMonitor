import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native Android shell (Capacitor). The web build is bundled inside the APK and served from
 * https://localhost, so the app works fully offline and data stays in the WebView's localStorage.
 * Build with `npm run build:android` (web assets + `cap sync`), then Gradle in `android/`.
 */
const config: CapacitorConfig = {
  appId: 'com.havivon.babymonitor',
  appName: 'מעקב האכלה',
  webDir: 'dist',
  backgroundColor: '#f8f5ef',
  android: {
    // Light/dark backgrounds come from the web theme; keep the WebView from flashing white.
    backgroundColor: '#f8f5ef',
  },
  plugins: {
    // index.html uses viewport-fit=cover and the CSS pads with env(safe-area-inset-*), so the
    // WebView runs edge-to-edge; the hint avoids a layout jump while that meta tag is detected.
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    // Native Google sign-in only; the Firebase JS SDK owns the session (signInWithCredential),
    // so one JS auth state drives web and Android alike (docs/ACCOUNTS.md §2).
    FirebaseAuthentication: { skipNativeAuth: true, providers: ['google.com'] },
  },
};

export default config;
