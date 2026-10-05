import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Screen-reader announcements through a visually hidden polite live region that the caller
 * renders: `<p className="visually-hidden" aria-live="polite">{message}</p>`.
 * Re-announcing the same text works because the region is cleared first.
 */
export function useAnnouncer(): [message: string, announce: (text: string) => void] {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const announce = useCallback((text: string) => {
    setMessage('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(text), 100);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [message, announce];
}
