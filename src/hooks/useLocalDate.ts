import { useCallback, useSyncExternalStore } from 'react';
import { toLocalIsoDate } from '../core/scoring/window';

const CLOCK_CHECK_MS = 30_000;

/**
 * The current local calendar date (YYYY-MM-DD), updating when the day rolls
 * over — including after the device sleeps and the tab becomes visible again.
 * Components only re-render when the date string actually changes.
 */
export function useLocalDate(): string {
  const subscribe = useCallback((onChange: () => void) => {
    const interval = setInterval(onChange, CLOCK_CHECK_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onChange();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return useSyncExternalStore(subscribe, () => toLocalIsoDate(new Date()));
}
