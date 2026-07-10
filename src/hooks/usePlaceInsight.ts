import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { modelConsensus, type DayConsensus } from '../core/scoring/consensus';
import type { Place } from '../core/types';
import { fetchHourly, type HourPoint } from '../core/weather/hourly';
import { fetchModelForecasts } from '../core/weather/models';
import { useAppStore } from '../state/store';

export interface PlaceInsight {
  consensusByDate: Map<string, DayConsensus>;
  hoursByDate: Map<string, HourPoint[]>;
  isLoadingConsensus: boolean;
  isLoadingHours: boolean;
}

/**
 * Deep detail for one place: cross-model agreement and an hourly profile.
 * Two extra API calls, fetched lazily when a detail view opens and cached
 * like every other forecast.
 */
export function usePlaceInsight(place: Place | null): PlaceInsight {
  const comfort = useAppStore((s) => s.comfort);

  const modelsQuery = useQuery({
    queryKey: ['models', place?.key],
    enabled: !!place,
    queryFn: () => fetchModelForecasts(place!),
  });

  const hourlyQuery = useQuery({
    queryKey: ['hourly', place?.key],
    enabled: !!place,
    queryFn: () => fetchHourly(place!),
  });

  const consensusByDate = useMemo(() => {
    const map = new Map<string, DayConsensus>();
    if (modelsQuery.data) {
      for (const day of modelConsensus(modelsQuery.data, comfort)) map.set(day.date, day);
    }
    return map;
  }, [modelsQuery.data, comfort]);

  const hoursByDate = useMemo(() => {
    const map = new Map<string, HourPoint[]>();
    if (hourlyQuery.data) {
      for (const point of hourlyQuery.data) {
        const existing = map.get(point.date);
        if (existing) existing.push(point);
        else map.set(point.date, [point]);
      }
    }
    return map;
  }, [hourlyQuery.data]);

  return {
    consensusByDate,
    hoursByDate,
    isLoadingConsensus: !!place && modelsQuery.isLoading,
    isLoadingHours: !!place && hourlyQuery.isLoading,
  };
}
