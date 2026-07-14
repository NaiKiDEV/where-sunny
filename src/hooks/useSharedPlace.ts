import { useEffect } from 'react';
import { decodeSharedPlace } from '../core/share/placeShare';
import { useAppStore } from '../state/store';

/**
 * On first load, adopt a `?place=` destination from a shared link: open it as a
 * preview (the store's setPreviewPlace guard already blocks banned countries),
 * then strip the param so a refresh doesn't re-open it.
 */
export function useSharedPlace(): void {
  const setPreviewPlace = useAppStore((s) => s.setPreviewPlace);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get('place');
    if (!param) return;

    const place = decodeSharedPlace(param);
    if (place) setPreviewPlace(place);

    params.delete('place');
    const query = params.toString();
    const url = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    window.history.replaceState(null, '', url);
  }, [setPreviewPlace]);
}
