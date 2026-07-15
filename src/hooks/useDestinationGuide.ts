import { useQuery } from '@tanstack/react-query';
import { fetchGuide, type DestinationGuide } from '../core/guide/destinationGuide';
import type { Place } from '../core/types';

// A destination's intro is effectively static; cache generously and key by the
// place key so re-opening the same detail reuses one fetch (2 network calls
// typical, 4 worst case - see fetchGuide).
const HOUR_MS = 60 * 60 * 1000;
const STALE_MS = 24 * HOUR_MS;
const GC_MS = 24 * HOUR_MS;

export interface DestinationGuideResult {
  guide: DestinationGuide | null;
  isLoading: boolean;
}

/**
 * Traveler-oriented intro (Wikivoyage, Wikipedia fallback) for a place. Lazy
 * per detail view, mirroring useNearbyPoi. Airports never fetch - the blurb
 * describes destinations, not infrastructure - and errors surface as a null
 * guide so the section degrades silently.
 */
export function useDestinationGuide(place: Place | null): DestinationGuideResult {
  const enabled = !!place && place.kind !== 'airport';

  const query = useQuery({
    queryKey: ['guide', place?.key],
    enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: () => fetchGuide(place!),
  });

  return {
    guide: query.data ?? null,
    isLoading: enabled && query.isLoading,
  };
}
