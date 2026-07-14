import { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { Place } from '../../core/types';
import { encodePlace } from '../../core/share/placeShare';

/**
 * Share a single place as a `?place=` deep link. Uses the native share sheet
 * when available and falls back to copying the URL to the clipboard - mirrors
 * the trip Share button UX (ShareTripButton in TripsView). Reuses the existing
 * `.place-detail-actions` button classes so it needs no new CSS.
 */
export function SharePlaceButton({ place }: { place: Place }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}?place=${encodePlace(place)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, url });
        return;
      } catch {
        // user dismissed the share sheet - fall through to copy
      }
    }
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked (e.g. insecure context) - nothing more we can do
    }
  };

  return (
    <button type="button" className="trip-toggle" onClick={share}>
      <Share2 size={15} strokeWidth={2} aria-hidden />
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
