import { useQuery } from '@tanstack/react-query';
import { fetchNearbyPoi, type PointOfInterest } from '../core/poi/wikipedia';
import type { LatLon } from '../core/types';

// POIs at a place are effectively static; cache generously and dedupe by
// coordinate rounded to ~1 km so nearby detail opens reuse one fetch.
const HOUR_MS = 60 * 60 * 1000;
const STALE_MS = 12 * HOUR_MS;
const GC_MS = 24 * HOUR_MS;

export interface NearbyPoiResult {
  poi: PointOfInterest[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Nearby Wikipedia points of interest for a coordinate. Lazy per detail view and
 * cached (≤2 network calls), matching usePlaceInsight's philosophy.
 */
export function useNearbyPoi(coords: LatLon | null): NearbyPoiResult {
  const query = useQuery({
    queryKey: ['poi', coords?.lat.toFixed(2), coords?.lon.toFixed(2)],
    enabled: !!coords,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: () => fetchNearbyPoi(coords!),
  });

  return {
    poi: query.data ?? [],
    isLoading: !!coords && query.isLoading,
    isError: !!coords && query.isError,
  };
}
