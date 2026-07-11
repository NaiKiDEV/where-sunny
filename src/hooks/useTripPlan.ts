import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scoreDays } from '../core/scoring/score';
import { windowDates } from '../core/scoring/window';
import { planTrip, type StopPlan } from '../core/trip/schedule';
import type { Trip } from '../core/trip/trip';
import { fetchSeaTemps, fetchTripForecasts } from '../core/trip/tripForecast';
import { formatClock } from '../lib/format';
import { useAppStore } from '../state/store';
import { useLocalDate } from './useLocalDate';

// Below this elevation a finite sea-surface reading is plausibly the stop's own
// coast; higher up it's a distant sea cell, so we don't call it a beach.
const COASTAL_MAX_ELEVATION_M = 200;

export interface StopInsight {
  plan: StopPlan;
  sunrise?: string; // clock on the assigned day
  sunset?: string;
  seaTempC?: number;
}

export interface TripPlan {
  byKey: Map<string, StopInsight>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Forecast + timings + sea context for every stop on a trip. One batched daily
 * request (with sunrise/sunset) and one marine request, cached like every other
 * forecast. Scored client-side against the active comfort preset.
 */
export function useTripPlan(trip: Trip | null): TripPlan {
  const comfort = useAppStore((s) => s.comfort);
  const stops = trip?.stops ?? [];
  const keyPart = stops.map((s) => s.placeKey).join(',');
  const coords = stops.map((s) => ({ lat: s.place.lat, lon: s.place.lon }));

  const forecastQuery = useQuery({
    queryKey: ['trip-forecast', keyPart],
    enabled: stops.length > 0,
    queryFn: () => fetchTripForecasts(coords),
  });

  const seaQuery = useQuery({
    queryKey: ['trip-sea', keyPart],
    enabled: stops.length > 0,
    queryFn: () => fetchSeaTemps(coords),
  });

  const todayIso = useLocalDate();
  const dates = useMemo(() => windowDates('week'), [todayIso]);

  const byKey = useMemo(() => {
    const map = new Map<string, StopInsight>();
    if (!forecastQuery.data) return map;
    const scoredByStop = forecastQuery.data.map((f) => scoreDays(f.days, comfort));
    const plans = planTrip(stops, scoredByStop, dates);
    plans.forEach((plan, i) => {
      const forecast = forecastQuery.data![i];
      const stopPlace = stops[i].place;
      const sea = seaQuery.data?.[i];
      const isLowland = stopPlace.elevation === undefined || stopPlace.elevation < COASTAL_MAX_ELEVATION_M;
      map.set(plan.placeKey, {
        plan,
        sunrise: forecast ? formatClock(forecast.sunrise[plan.dayIndex] ?? '') : undefined,
        sunset: forecast ? formatClock(forecast.sunset[plan.dayIndex] ?? '') : undefined,
        seaTempC: typeof sea === 'number' && isLowland ? sea : undefined,
      });
    });
    return map;
    // stops is derived from keyPart; depending on keyPart keeps this stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastQuery.data, seaQuery.data, comfort, dates, keyPart]);

  return {
    byKey,
    isLoading: stops.length > 0 && forecastQuery.isLoading,
    error: (forecastQuery.error as Error | null) ?? null,
  };
}
