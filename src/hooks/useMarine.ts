import { useQuery } from '@tanstack/react-query';
import {
  fetchMarineDaily,
  isLikelyCoastal,
  type MarineDay,
  type SeaLevelHour,
} from '../core/marine/marine';
import type { Place } from '../core/types';

// Sea state changes slowly; cache generously and dedupe by coordinate rounded
// to ~1 km so nearby detail opens reuse one fetch (mirrors useNearbyPoi).
const HOUR_MS = 60 * 60 * 1000;
const STALE_MS = 6 * HOUR_MS;
const GC_MS = 24 * HOUR_MS;

export interface MarineResult {
  /** Daily sea conditions, or null when the place is inland / not probed yet. */
  days: MarineDay[] | null;
  /** Hourly sea-level heights for tide times; rides the same request. Undefined until loaded. */
  seaLevels?: SeaLevelHour[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Daily sea conditions for a place. Lazy per detail view; the elevation
 * pre-filter (isLikelyCoastal) keeps obviously-inland places from spending a
 * request at all - the marine endpoint would only answer them with nulls.
 * The hourly sea-level series for tide times rides the same single request.
 */
export function useMarine(place: Place | null): MarineResult {
  const eligible = !!place && isLikelyCoastal(place);
  const query = useQuery({
    queryKey: ['marine', place?.lat.toFixed(2), place?.lon.toFixed(2)],
    enabled: eligible,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: () => fetchMarineDaily(place!, { includeSeaLevel: true }),
  });

  return {
    days: query.data ?? null,
    seaLevels: query.data?.seaLevels,
    isLoading: eligible && query.isLoading,
    isError: eligible && query.isError,
  };
}
