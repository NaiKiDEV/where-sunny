import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { haversineKm } from '../core/geo';
import { scorePlace } from '../core/scoring/rank';
import { windowDates } from '../core/scoring/window';
import type { ScoredPlace } from '../core/types';
import { fetchDailyForecasts } from '../core/weather/openMeteo';
import { useAppStore } from '../state/store';
import { useBannedFilter } from './useBannedFilter';
import { useLocalDate } from './useLocalDate';

export interface PinnedPlacesResult {
  pinnedScored: ScoredPlace[];
  isLoading: boolean;
}

/**
 * Forecasts + scores for the user's places of interest. Pins are independent
 * of tier/radius - they always get data, no matter how niche or far away.
 */
export function usePinnedPlaces(): PinnedPlacesResult {
  const pinned = useAppStore((s) => s.pinned);
  const origin = useAppStore((s) => s.origin);
  const timeWindow = useAppStore((s) => s.timeWindow);
  const comfort = useAppStore((s) => s.comfort);

  const pinKeys = pinned.map((p) => p.key).join(',');
  const forecastQuery = useQuery({
    queryKey: ['forecasts-pins', pinKeys],
    enabled: pinned.length > 0,
    queryFn: () => fetchDailyForecasts(pinned),
  });

  const todayIso = useLocalDate();
  const dates = useMemo(() => windowDates(timeWindow), [timeWindow, todayIso]);
  const { codes, isBanned } = useBannedFilter();

  // Banning HIDES a pin's forecast reactively; the saved pin itself is never
  // removed, so un-banning brings it straight back.
  const pinnedScored = useMemo(() => {
    if (!forecastQuery.data) return [];
    const scored: ScoredPlace[] = [];
    pinned.forEach((place, i) => {
      const distanceKm = origin ? haversineKm(origin, place) : 0;
      const result = scorePlace({ place, distanceKm }, forecastQuery.data[i], dates, comfort);
      if (result) scored.push(result);
    });
    return scored.filter((p) => !isBanned(p.place)); // user's own order, not score order
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastQuery.data, pinned, origin, dates, comfort, codes]);

  return { pinnedScored, isLoading: pinned.length > 0 && forecastQuery.isLoading };
}
