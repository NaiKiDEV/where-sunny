import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { haversineKm } from '../core/geo';
import { scorePlace } from '../core/scoring/rank';
import { windowDates } from '../core/scoring/window';
import type { ScoredPlace } from '../core/types';
import { fetchDailyForecasts } from '../core/weather/openMeteo';
import { useAppStore } from '../state/store';
import { useLocalDate } from './useLocalDate';

export interface PreviewPlaceResult {
  scored: ScoredPlace | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Forecast + score for a destination the user is previewing from search, before
 * they commit to watching it or starting there. One lazy 7-day fetch, scored
 * against the active window so it re-ranks with filter changes like any place.
 */
export function usePreviewPlace(): PreviewPlaceResult {
  const previewPlace = useAppStore((s) => s.previewPlace);
  const origin = useAppStore((s) => s.origin);
  const timeWindow = useAppStore((s) => s.timeWindow);
  const comfort = useAppStore((s) => s.comfort);

  const forecastQuery = useQuery({
    queryKey: ['forecast-preview', previewPlace?.key],
    enabled: !!previewPlace,
    queryFn: () => fetchDailyForecasts([previewPlace!]),
  });

  const todayIso = useLocalDate();
  const dates = useMemo(() => windowDates(timeWindow), [timeWindow, todayIso]);

  const scored = useMemo(() => {
    if (!previewPlace || !forecastQuery.data?.[0]) return null;
    const distanceKm = origin ? haversineKm(origin, previewPlace) : 0;
    return scorePlace({ place: previewPlace, distanceKm }, forecastQuery.data[0], dates, comfort);
  }, [previewPlace, forecastQuery.data, origin, dates, comfort]);

  return {
    scored,
    isLoading: !!previewPlace && forecastQuery.isLoading,
    error: (previewPlace ? forecastQuery.error : null) as Error | null,
  };
}
