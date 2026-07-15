import type { DayForecast, LatLon } from '../types';
import {
  DAILY_VARS,
  FORECAST_DAYS,
  mapDaily,
  systemTimeZone,
  type OpenMeteoDaily,
} from '../weather/openMeteo';

const API_BASE = 'https://api.open-meteo.com/v1/forecast';

// Marine probing lives in core/marine/marine.ts (shared with the place-detail
// sea conditions section); re-exported so trip consumers keep this import path.
export { buildMarineUrl, fetchSeaTemps, parseSeaTemp } from '../marine/marine';

/** Per-stop daily forecast plus sun-up/sun-down clock times (the trip "timings"). */
export interface TripStopForecast {
  days: DayForecast[];
  sunrise: string[]; // ISO local datetime per forecast day
  sunset: string[];
}

interface TripDaily extends OpenMeteoDaily {
  sunrise?: (string | null)[];
  sunset?: (string | null)[];
}

export interface FetchTripOptions {
  fetchImpl?: typeof fetch;
  days?: number;
  timezone?: string;
}

export function buildTripForecastUrl(coords: LatLon[], days = FORECAST_DAYS, timezone = 'auto'): string {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c.lat.toFixed(3)).join(','),
    longitude: coords.map((c) => c.lon.toFixed(3)).join(','),
    daily: [...DAILY_VARS, 'sunrise', 'sunset'].join(','),
    forecast_days: String(days),
    timezone,
  });
  return `${API_BASE}?${params}`;
}

function parseLocation(daily: TripDaily): TripStopForecast {
  return {
    days: mapDaily(daily),
    sunrise: (daily.sunrise ?? []).map((s) => s ?? ''),
    sunset: (daily.sunset ?? []).map((s) => s ?? ''),
  };
}

/** Pads/truncates to `count` so a location-count mismatch still renders the trip. */
export function parseTripForecasts(json: unknown, count: number): TripStopForecast[] {
  const locations = (Array.isArray(json) ? json : [json]) as { daily?: TripDaily }[];
  return Array.from({ length: count }, (_, i) => parseLocation(locations[i]?.daily ?? {}));
}

export async function fetchTripForecasts(
  coords: LatLon[],
  options: FetchTripOptions = {},
): Promise<TripStopForecast[]> {
  const { fetchImpl = fetch, days = FORECAST_DAYS, timezone = systemTimeZone() } = options;
  if (coords.length === 0) return [];
  const res = await fetchImpl(buildTripForecastUrl(coords, days, timezone));
  if (!res.ok) throw new Error(`Trip forecast request failed: HTTP ${res.status}`);
  return parseTripForecasts(await res.json(), coords.length);
}
