import type { ScoredDay } from '../types';
import { stopDay, type TripStop } from './trip';

export interface StopPlan {
  placeKey: string;
  /** 0-based slot in the itinerary (the stop's day, minus one). */
  dayIndex: number;
  assignedDate: string; // YYYY-MM-DD
  /** Forecast on the assigned day (null if out of horizon / unavailable). */
  forecast: ScoredDay | null;
  /** Sunniest day in the whole horizon - lets the UI nudge "sunnier on Sat". */
  best: ScoredDay | null;
}

/**
 * Maps each stop to a forecast date from its assigned day (`stop.day`), clamped
 * to the last day once the trip outruns the forecast horizon (`dates`). Days
 * come from the stop, not its position, so several stops can share one day.
 */
export function planTrip(stops: TripStop[], scoredByStop: ScoredDay[][], dates: string[]): StopPlan[] {
  const horizon = Math.max(dates.length, 1);
  return stops.map((stop, i) => {
    const scored = scoredByStop[i] ?? [];
    const dayIndex = Math.min(stopDay(stop) - 1, horizon - 1);
    const assignedDate = dates[dayIndex] ?? '';
    const forecast = scored.find((d) => d.date === assignedDate) ?? null;
    const best = scored.reduce<ScoredDay | null>((b, d) => (!b || d.score > b.score ? d : b), null);
    return { placeKey: stop.placeKey, dayIndex, assignedDate, forecast, best };
  });
}
