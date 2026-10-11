import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { appStore } from '../store';
import { backAction, cancelTopDialog, topOpenDialog } from './backButton';

/**
 * Wires the Android back button (see `backButton.ts`). No-op on the web/PWA, where the browser
 * owns back navigation. The `@capacitor/app` plugin is loaded lazily, only on the native app.
 */
export function useAndroidBackButton(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The listener is registered once; read the current route through a ref.
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let remove: (() => void) | undefined;

    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('backButton', () => {
        const action = backAction({
          dialogOpen: topOpenDialog() !== null,
          pathname: pathRef.current,
          hasBabies: appStore.getState().babies.length > 0,
        });
        if (action === 'close-dialog') cancelTopDialog();
        else if (action === 'home') void navigate('/', { replace: true });
        else void App.minimizeApp();
      });
      if (cancelled) void handle.remove();
      else remove = () => void handle.remove();
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [navigate]);
}
