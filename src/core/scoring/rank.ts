import type { Candidate, DayForecast, ScoredPlace } from '../types';
import type { ComfortPrefs } from './score';
import { DEFAULT_COMFORT, scoreDays } from './score';

/**
 * Score one candidate against its forecast for the given window dates.
 * Returns null when the forecast has no days inside the window.
 */
export function scorePlace(
  candidate: Candidate,
  forecast: DayForecast[] | undefined,
  dates: string[],
  prefs: ComfortPrefs = DEFAULT_COMFORT,
): ScoredPlace | null {
  const wanted = new Set(dates);
  const days = scoreDays(forecast ?? [], prefs);
  const windowDays = days.filter((day) => wanted.has(day.date));
  if (windowDays.length === 0) return null;
  // best day wins; on ties the earlier date (reduce keeps the first max)
  const best = windowDays.reduce((a, b) => (b.score > a.score ? b : a));
  return { ...candidate, days, windowDays, best, score: best.score };
}

/**
 * Rank candidates by best-day sun score (desc), ties broken by distance.
 * `forecasts[i]` must correspond to `candidates[i]`.
 */
export function rankPlaces(
  candidates: Candidate[],
  forecasts: DayForecast[][],
  dates: string[],
  prefs: ComfortPrefs = DEFAULT_COMFORT,
): ScoredPlace[] {
  const scored: ScoredPlace[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const place = scorePlace(candidates[i], forecasts[i], dates, prefs);
    if (place) scored.push(place);
  }
  scored.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
  return scored;
}
