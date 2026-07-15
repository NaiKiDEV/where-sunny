import { useQuery } from '@tanstack/react-query';
import type { LatLon, PlaceForecast } from '../core/types';
import { fetchPlaceForecast, MAX_FORECAST_DAYS } from '../core/weather/openMeteo';

// Days 8–16 are trend information and move slowly; refresh at most hourly and
// dedupe by coordinate rounded to ~1 km so nearby detail opens reuse one fetch
// (mirrors useNearbyPoi / useMarine).
const HOUR_MS = 60 * 60 * 1000;
const STALE_MS = HOUR_MS;
const GC_MS = 24 * HOUR_MS;

export interface PlaceForecastResult {
  /**
   * Full 16-day destination forecast — all days, snow fields, and the
   * destination timezone — or null until loaded. Deliberately unsliced: the
   * outlook strip, practical info row, and snow note all feed off this one
   * query, so a detail open costs a single extra request.
   */
  forecast: PlaceForecast | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Extended 16-day forecast for the selected place only. Lazy per detail view;
 * the batch grid path stays at 7 days (cost control), this single-place call
 * carries the longer horizon.
 */
export function usePlaceForecast(coords: LatLon | null): PlaceForecastResult {
  const query = useQuery({
    queryKey: ['placeForecast', coords?.lat.toFixed(2), coords?.lon.toFixed(2)],
    enabled: !!coords,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: () => fetchPlaceForecast(coords!, { forecastDays: MAX_FORECAST_DAYS }),
  });

  return {
    forecast: query.data ?? null,
    isLoading: !!coords && query.isLoading,
    isError: !!coords && query.isError,
  };
}
