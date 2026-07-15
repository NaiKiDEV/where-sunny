import type { DayForecast, LatLon, PlaceForecast } from '../types';

export const FORECAST_DAYS = 7;
/** Open-Meteo free-tier maximum forecast horizon. */
export const MAX_FORECAST_DAYS = 16;
const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 2;

export const DAILY_VARS = [
  'sunshine_duration',
  'daylight_duration',
  'cloud_cover_mean',
  'precipitation_probability_max',
  'temperature_2m_max',
  'temperature_2m_min',
  'weather_code',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'uv_index_max',
  'wind_speed_10m_max',
] as const;

/**
 * Daily variables for the single-place path: everything the grid requests plus
 * snow. Kept off DAILY_VARS so the batch/grid request shape stays unchanged.
 */
export const PLACE_DAILY_VARS = [...DAILY_VARS, 'snowfall_sum', 'snow_depth_max'] as const;

export interface OpenMeteoDaily {
  time?: string[];
  sunshine_duration?: (number | null)[];
  daylight_duration?: (number | null)[];
  cloud_cover_mean?: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  weather_code?: (number | null)[];
  apparent_temperature_max?: (number | null)[];
  apparent_temperature_min?: (number | null)[];
  uv_index_max?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  snowfall_sum?: (number | null)[];
  snow_depth_max?: (number | null)[];
}

interface OpenMeteoLocation {
  daily?: OpenMeteoDaily;
  timezone?: string;
  utc_offset_seconds?: number;
}

export interface FetchForecastOptions {
  fetchImpl?: typeof fetch;
  days?: number;
  batchSize?: number;
  timezone?: string;
}

/**
 * The requester's IANA timezone. All forecasts are aggregated on this one
 * calendar so daily date strings always match the dates `windowDates`
 * derives from the local clock. With `timezone=auto` (destination-local),
 * places east of the user disappear from results near midnight because their
 * "today" is already the user's "tomorrow".
 */
export function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto';
  } catch {
    return 'auto';
  }
}

export function buildForecastUrl(coords: LatLon[], days = FORECAST_DAYS, timezone = 'auto'): string {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c.lat.toFixed(3)).join(','),
    longitude: coords.map((c) => c.lon.toFixed(3)).join(','),
    daily: DAILY_VARS.join(','),
    forecast_days: String(days),
    timezone,
  });
  return `${API_BASE}?${params}`;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Coerce Open-Meteo's `number | null | undefined` cells to `number | undefined`. */
function optionalNum(value: number | null | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function mapDaily(daily: OpenMeteoDaily): DayForecast[] {
  const time = daily.time ?? [];
  const days: DayForecast[] = [];
  for (let i = 0; i < time.length; i++) {
    const daylight = daily.daylight_duration?.[i] ?? 0;
    const cloud = daily.cloud_cover_mean?.[i] ?? 50;
    // Some regions lack sunshine data; estimate it from cloud cover so they
    // still rank sensibly instead of scoring zero.
    const sunshine = daily.sunshine_duration?.[i] ?? Math.max(0, daylight * (1 - cloud / 100));
    days.push({
      date: time[i],
      sunshineDuration: sunshine,
      daylightDuration: daylight,
      cloudCoverMean: cloud,
      precipProbMax: daily.precipitation_probability_max?.[i] ?? 0,
      tempMax: daily.temperature_2m_max?.[i] ?? 15,
      tempMin: daily.temperature_2m_min?.[i] ?? 8,
      weatherCode: daily.weather_code?.[i] ?? 3,
      apparentTempMax: optionalNum(daily.apparent_temperature_max?.[i]),
      apparentTempMin: optionalNum(daily.apparent_temperature_min?.[i]),
      uvIndexMax: optionalNum(daily.uv_index_max?.[i]),
      windMax: optionalNum(daily.wind_speed_10m_max?.[i]),
      snowfallSum: optionalNum(daily.snowfall_sum?.[i]),
      snowDepthMax: optionalNum(daily.snow_depth_max?.[i]),
    });
  }
  return days;
}

async function fetchChunk(
  coords: LatLon[],
  days: number,
  timezone: string,
  fetchImpl: typeof fetch,
  attempt = 1,
): Promise<DayForecast[][]> {
  try {
    const res = await fetchImpl(buildForecastUrl(coords, days, timezone));
    if (!res.ok) throw new Error(`Open-Meteo request failed: HTTP ${res.status}`);
    const json: unknown = await res.json();
    const locations = (Array.isArray(json) ? json : [json]) as OpenMeteoLocation[];
    if (locations.length !== coords.length) {
      throw new Error(`Open-Meteo returned ${locations.length} locations for ${coords.length} coordinates`);
    }
    return locations.map((loc) => mapDaily(loc.daily ?? {}));
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) return fetchChunk(coords, days, timezone, fetchImpl, attempt + 1);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Fetch daily forecasts for many coordinates, batched into multi-location
 * requests. Result order matches the input coordinate order. If some (but not
 * all) batches fail after retrying, their coordinates get empty forecasts so
 * index alignment survives and the rest of the results still render.
 */
export async function fetchDailyForecasts(
  coords: LatLon[],
  options: FetchForecastOptions = {},
): Promise<DayForecast[][]> {
  const {
    fetchImpl = fetch,
    days = FORECAST_DAYS,
    batchSize = BATCH_SIZE,
    timezone = systemTimeZone(),
  } = options;
  if (coords.length === 0) return [];
  const chunks = chunkArray(coords, batchSize);
  const settled = await Promise.allSettled(
    chunks.map((chunk) => fetchChunk(chunk, days, timezone, fetchImpl)),
  );
  const firstFailure = settled.find((s) => s.status === 'rejected');
  if (firstFailure && settled.every((s) => s.status === 'rejected')) {
    throw (firstFailure as PromiseRejectedResult).reason;
  }
  return settled.flatMap((s, i) =>
    s.status === 'fulfilled' ? s.value : chunks[i].map(() => [] as DayForecast[]),
  );
}

export interface FetchPlaceForecastOptions {
  fetchImpl?: typeof fetch;
  /** Forecast horizon, clamped to 1–MAX_FORECAST_DAYS. Defaults to FORECAST_DAYS. */
  forecastDays?: number;
  timezone?: string;
}

export function buildPlaceForecastUrl(coord: LatLon, days = FORECAST_DAYS, timezone = 'auto'): string {
  const params = new URLSearchParams({
    latitude: coord.lat.toFixed(3),
    longitude: coord.lon.toFixed(3),
    daily: PLACE_DAILY_VARS.join(','),
    forecast_days: String(Math.min(Math.max(1, Math.round(days)), MAX_FORECAST_DAYS)),
    timezone,
  });
  return `${API_BASE}?${params}`;
}

/**
 * Fetch the forecast for one place, with extras the batch/grid path skips: a
 * longer horizon (up to MAX_FORECAST_DAYS) and snow variables. Defaults to
 * `timezone=auto` (destination-local) — unlike fetchDailyForecasts, which pins
 * the requester's calendar — so the returned `timezone`/`utcOffsetSeconds` are
 * the place's own and components can show local time. Pass
 * `timezone: systemTimeZone()` when date alignment with the grid forecast
 * matters more than local dates.
 */
export async function fetchPlaceForecast(
  coord: LatLon,
  options: FetchPlaceForecastOptions = {},
  attempt = 1,
): Promise<PlaceForecast> {
  const { fetchImpl = fetch, forecastDays = FORECAST_DAYS, timezone = 'auto' } = options;
  try {
    const res = await fetchImpl(buildPlaceForecastUrl(coord, forecastDays, timezone));
    if (!res.ok) throw new Error(`Open-Meteo request failed: HTTP ${res.status}`);
    const json: unknown = await res.json();
    const loc = (Array.isArray(json) ? json[0] : json) as OpenMeteoLocation | undefined;
    if (!loc) throw new Error('Open-Meteo returned no location');
    return {
      days: mapDaily(loc.daily ?? {}),
      timezone: loc.timezone ?? (timezone === 'auto' ? systemTimeZone() : timezone),
      utcOffsetSeconds: optionalNum(loc.utc_offset_seconds),
    };
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) return fetchPlaceForecast(coord, options, attempt + 1);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
