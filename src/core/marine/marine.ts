/**
 * Open-Meteo Marine API client (free, no key, CORS). Shared by trip forecasts
 * (current sea temperature per stop) and the place-detail sea conditions
 * section (daily sea temperature + wave height). Inland coordinates answer
 * with HTTP 200 and all-null series (historically also HTTP 400) - both mean
 * "not coastal", never an error worth surfacing. Fetchers inject `fetchImpl`
 * for tests; parsing and banding are pure helpers.
 */
import type { LatLon } from '../types';

const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine';
const MARINE_FORECAST_DAYS = 7;
/** Above this a place cannot plausibly sit on a beach - skip the marine probe. */
const MAX_COASTAL_ELEVATION_M = 50;

const SWIM_FRESH_MIN_C = 18;
const SWIM_PLEASANT_MIN_C = 21;
const SWIM_WARM_ABOVE_C = 24;

const WAVE_CALM_BELOW_M = 0.5;
const WAVE_ROUGH_ABOVE_M = 1.25;

export interface MarineDay {
  date: string; // YYYY-MM-DD
  seaTempMax: number | null; // °C, null where the model has no sea
  waveHeightMax: number | null; // metres, significant wave height
}

/** Swim-comfort band for a daily max sea-surface temperature. */
export type SwimBand = 'cold' | 'fresh' | 'pleasant' | 'warm';

/** Wave-comfort band for a daily max wave height. */
export type WaveComfort = 'calm' | 'moderate' | 'rough';

export interface FetchMarineOptions {
  fetchImpl?: typeof fetch;
  days?: number;
  timezone?: string;
}

export function swimBand(seaTempC: number): SwimBand {
  if (seaTempC < SWIM_FRESH_MIN_C) return 'cold';
  if (seaTempC < SWIM_PLEASANT_MIN_C) return 'fresh';
  if (seaTempC <= SWIM_WARM_ABOVE_C) return 'pleasant';
  return 'warm';
}

export function waveComfort(waveHeightM: number): WaveComfort {
  if (waveHeightM < WAVE_CALM_BELOW_M) return 'calm';
  if (waveHeightM <= WAVE_ROUGH_ABOVE_M) return 'moderate';
  return 'rough';
}

/**
 * Cheap inland pre-filter so detail opens far from any coast never spend a
 * request on the marine endpoint. Unknown elevation stays eligible - the
 * API's null response settles it.
 */
export function isLikelyCoastal(place: { elevation?: number }): boolean {
  return place.elevation === undefined || place.elevation <= MAX_COASTAL_ELEVATION_M;
}

export function buildMarineDailyUrl(
  coord: LatLon,
  days = MARINE_FORECAST_DAYS,
  timezone = 'auto',
): string {
  const params = new URLSearchParams({
    latitude: coord.lat.toFixed(3),
    longitude: coord.lon.toFixed(3),
    daily: 'sea_surface_temperature_max,wave_height_max',
    forecast_days: String(days),
    timezone,
  });
  return `${MARINE_BASE}?${params}`;
}

interface MarineDailyJson {
  daily?: {
    time?: (string | null)[];
    sea_surface_temperature_max?: (number | null)[];
    wave_height_max?: (number | null)[];
  };
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseMarineDaily(json: unknown): MarineDay[] {
  const daily = (json as MarineDailyJson).daily ?? {};
  return (daily.time ?? [])
    .map((date, i) => ({
      date: date ?? '',
      seaTempMax: finiteOrNull(daily.sea_surface_temperature_max?.[i]),
      waveHeightMax: finiteOrNull(daily.wave_height_max?.[i]),
    }))
    .filter((day) => day.date !== '');
}

/**
 * Daily sea conditions for a coordinate, or null when the point is not
 * coastal (all-null series / non-OK response). Callers render nothing on
 * null rather than an error.
 */
export async function fetchMarineDaily(
  coord: LatLon,
  options: FetchMarineOptions = {},
): Promise<MarineDay[] | null> {
  const { fetchImpl = fetch, days = MARINE_FORECAST_DAYS, timezone = 'auto' } = options;
  const res = await fetchImpl(buildMarineDailyUrl(coord, days, timezone));
  if (!res.ok) return null;
  const parsed = parseMarineDaily(await res.json());
  return parsed.some((day) => day.seaTempMax !== null) ? parsed : null;
}

export function buildMarineUrl(coord: LatLon): string {
  const params = new URLSearchParams({
    latitude: coord.lat.toFixed(3),
    longitude: coord.lon.toFixed(3),
    current: 'sea_surface_temperature',
  });
  return `${MARINE_BASE}?${params}`;
}

export function parseSeaTemp(json: unknown): number | null {
  const value = (json as { current?: { sea_surface_temperature?: number | null } }).current
    ?.sea_surface_temperature;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Sea-surface temperature per coordinate; null where there's no sea data (i.e.
 * inland). Probed per-stop and settled independently: the marine endpoint 400s
 * for inland points, and a single inland stop must not blank the coastal ones
 * (which a batched request would). Not worth surfacing as an error.
 */
export async function fetchSeaTemps(
  coords: LatLon[],
  options: { fetchImpl?: typeof fetch } = {},
): Promise<(number | null)[]> {
  const { fetchImpl = fetch } = options;
  if (coords.length === 0) return [];
  const settled = await Promise.allSettled(
    coords.map(async (coord) => {
      const res = await fetchImpl(buildMarineUrl(coord));
      return res.ok ? parseSeaTemp(await res.json()) : null;
    }),
  );
  return settled.map((r) => (r.status === 'fulfilled' ? r.value : null));
}
