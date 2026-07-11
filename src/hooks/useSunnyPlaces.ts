import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { selectCandidates } from '../core/candidates/filter';
import { fetchCities } from '../core/candidates/loadCities';
import { TRAVEL_TIERS } from '../core/candidates/tiers';
import { snapToGrid } from '../core/geo';
import { rankPlaces, scorePlace } from '../core/scoring/rank';
import { windowDates } from '../core/scoring/window';
import type { Candidate, ScoredPlace } from '../core/types';
import { fetchDailyForecasts } from '../core/weather/openMeteo';
import { useAppStore } from '../state/store';
import { useLocalDate } from './useLocalDate';

/**
 * Origin is snapped to a ~1 km grid before it enters the query pipeline, so
 * GPS jitter neither refetches forecasts nor shifts distances between renders.
 */
const ORIGIN_GRID_STEP = 0.01;

/**
 * Forecasts are zipped to candidates by array position, so the cache entry
 * must be bound to the exact candidate set it was fetched for - a city
 * dataset update between visits would otherwise misalign persisted forecasts
 * against freshly computed candidates.
 */
function candidateSetKey(candidates: Candidate[]): string {
  let hash = 5381;
  for (const candidate of candidates) {
    for (let i = 0; i < candidate.place.key.length; i++) {
      hash = (Math.imul(hash, 33) ^ candidate.place.key.charCodeAt(i)) >>> 0;
    }
  }
  return `${candidates.length}:${hash.toString(36)}`;
}

export interface SunnyPlacesResult {
  results: ScoredPlace[];
  home: ScoredPlace | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  candidateCount: number;
}

export function useSunnyPlaces(): SunnyPlacesResult {
  const origin = useAppStore((s) => s.origin);
  const tier = useAppStore((s) => s.tier);
  const timeWindow = useAppStore((s) => s.timeWindow);

  const queryOrigin = useMemo(
    () =>
      origin
        ? { lat: snapToGrid(origin.lat, ORIGIN_GRID_STEP), lon: snapToGrid(origin.lon, ORIGIN_GRID_STEP) }
        : null,
    [origin],
  );

  const citiesQuery = useQuery({
    queryKey: ['cities'],
    queryFn: () => fetchCities(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const candidates: Candidate[] = useMemo(() => {
    if (!queryOrigin || !citiesQuery.data) return [];
    return selectCandidates(citiesQuery.data, queryOrigin, TRAVEL_TIERS[tier]);
  }, [queryOrigin, citiesQuery.data, tier]);

  // One 7-day fetch per (origin cell, tier) serves every time window; window
  // switching is pure client-side re-scoring. Index 0 is always the origin.
  const forecastQuery = useQuery({
    queryKey: ['forecasts', tier, queryOrigin?.lat, queryOrigin?.lon, candidateSetKey(candidates)],
    enabled: !!queryOrigin && !!citiesQuery.data,
    queryFn: () => fetchDailyForecasts([queryOrigin!, ...candidates.map((c) => c.place)]),
  });

  // todayIso keys the memo so windows roll over at local midnight and after
  // the device wakes from sleep, instead of freezing at yesterday's dates
  const todayIso = useLocalDate();
  const dates = useMemo(() => windowDates(timeWindow), [timeWindow, todayIso]);

  const comfort = useAppStore((s) => s.comfort);

  const results = useMemo(() => {
    if (!forecastQuery.data) return [];
    return rankPlaces(candidates, forecastQuery.data.slice(1), dates, comfort);
  }, [forecastQuery.data, candidates, dates, comfort]);

  const home = useMemo(() => {
    if (!forecastQuery.data?.[0] || !origin || !queryOrigin) return null;
    const homeCandidate: Candidate = {
      place: { key: 'home', kind: 'home', name: origin.label, country: '', ...queryOrigin, population: 0 },
      distanceKm: 0,
    };
    return scorePlace(homeCandidate, forecastQuery.data[0], dates, comfort);
  }, [forecastQuery.data, origin, queryOrigin, dates, comfort]);

  return {
    results,
    home,
    isLoading: citiesQuery.isLoading || forecastQuery.isLoading,
    isFetching: citiesQuery.isFetching || forecastQuery.isFetching,
    error: (citiesQuery.error ?? forecastQuery.error) as Error | null,
    candidateCount: candidates.length,
  };
}
