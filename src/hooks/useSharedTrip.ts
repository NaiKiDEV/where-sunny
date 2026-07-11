import { useEffect } from 'react';
import { decodeSharedTrip } from '../core/trip/share';
import { useAppStore } from '../state/store';

/**
 * On first load, adopt a `?trip=` itinerary from a shared link: import it as a
 * saved trip (and take its origin if the visitor hasn't set one, so the link is
 * immediately usable), then strip the param so a refresh doesn't re-import.
 */
export function useSharedTrip(): void {
  const importTrip = useAppStore((s) => s.importTrip);
  const setOrigin = useAppStore((s) => s.setOrigin);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get('trip');
    if (!param) return;

    const data = decodeSharedTrip(param);
    if (data) {
      if (!useAppStore.getState().origin && data.origin) setOrigin(data.origin);
      importTrip(data);
    }

    params.delete('trip');
    const query = params.toString();
    const url = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    window.history.replaceState(null, '', url);
  }, [importTrip, setOrigin]);
}
