import { useQuery } from '@tanstack/react-query';
import { fetchAirQuality, type AirDaySummary } from '../core/air/airQuality';
import type { LatLon } from '../core/types';

// Air quality forecasts refresh on model cadence (hours, not minutes); cache
// per coordinate rounded to ~1 km so nearby detail opens reuse one fetch.
const HOUR_MS = 60 * 60 * 1000;
const STALE_MS = 1 * HOUR_MS;
const GC_MS = 6 * HOUR_MS;

export interface AirQualityResult {
  days: AirDaySummary[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Per-day air quality + pollen summaries for a coordinate. Lazy per detail
 * view and cached (1 network call), matching useNearbyPoi's philosophy.
 */
export function useAirQuality(coords: LatLon | null): AirQualityResult {
  const query = useQuery({
    queryKey: ['air-quality', coords?.lat.toFixed(2), coords?.lon.toFixed(2)],
    enabled: !!coords,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: () => fetchAirQuality(coords!),
  });

  return {
    days: query.data ?? [],
    isLoading: !!coords && query.isLoading,
    isError: !!coords && query.isError,
  };
}
