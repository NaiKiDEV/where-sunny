/**
 * Steering wind for the rain-movement arrows. RainViewer serves radar as images
 * only - no motion vectors - so the direction rain areas drift is approximated
 * by the wind that carries them. The 700 hPa wind is the meteorological
 * steering-level proxy; where a model lacks it we fall back to the 10 m surface
 * wind so an arrow still draws. Data comes from Open-Meteo (the app's existing
 * weather backend); a coarse grid over the current viewport keeps one request
 * small. Fetch injects `fetchImpl`/`nowMs` for tests; grid, URL, hour selection,
 * and bearing math are pure helpers.
 */
import type { LatLon } from '../types';

// Same free, key-less forecast endpoint openMeteo.ts uses (kept local so its
// private constant stays private).
const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const MAX_ATTEMPTS = 2;

/** Arrows only appear once zoomed to a regional scale; below this we neither
 *  draw nor fetch, so a continental view never pulls a wall of wind data. */
export const MIN_ARROW_ZOOM = 6;

/** Grid density across the viewport: 6×4 = 24 points, one small batch request. */
export const ARROW_GRID_COLS = 6;
export const ARROW_GRID_ROWS = 4;

/** A screen-space rectangle in lon/lat (from MapLibre's getBounds). */
export interface GridBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** One arrow: where it sits and which way (and how fast) the rain is drifting. */
export interface WindArrow {
  lon: number;
  lat: number;
  /** Compass bearing (deg, clockwise from north) the rain is moving TOWARD. */
  bearing: number;
  /** Steering wind speed in km/h (Open-Meteo's default unit). */
  speedKmh: number;
}

/**
 * Evenly spaced sample points across the bounds, one centred in each grid cell
 * so none land exactly on the viewport edge. Column/row counts default to the
 * arrow grid but stay parameterised for tests.
 */
export function gridPoints(
  bounds: GridBounds,
  cols = ARROW_GRID_COLS,
  rows = ARROW_GRID_ROWS,
): LatLon[] {
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;
  const points: LatLon[] = [];
  for (let j = 0; j < rows; j++) {
    const lat = bounds.south + ((j + 0.5) / rows) * latSpan;
    for (let i = 0; i < cols; i++) {
      const lon = bounds.west + ((i + 0.5) / cols) * lonSpan;
      points.push({ lat, lon });
    }
  }
  return points;
}

/** Multi-location hourly-wind request: 700 hPa steering + 10 m fallback, in UTC. */
export function buildSteeringWindUrl(coords: LatLon[]): string {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c.lat.toFixed(3)).join(','),
    longitude: coords.map((c) => c.lon.toFixed(3)).join(','),
    hourly: 'wind_speed_700hPa,wind_direction_700hPa,wind_speed_10m,wind_direction_10m',
    forecast_days: '1',
    // GMT so every grid point shares one clock; we then pick the hour nearest now.
    timezone: 'GMT',
  });
  return `${API_BASE}?${params}`;
}

/**
 * Index of the hourly slot nearest `nowUtcMs`. Open-Meteo GMT times omit a zone
 * ("2026-07-22T14:00"), which JS would read as local, so we pin them to UTC.
 * Returns 0 for an empty list (callers guard on the parsed values anyway).
 */
export function pickHourIndex(times: string[], nowUtcMs: number): number {
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = Date.parse(`${times[i]}Z`);
    if (Number.isNaN(t)) continue;
    const delta = Math.abs(t - nowUtcMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best;
}

/**
 * Open-Meteo reports the direction wind blows FROM; rain drifts the opposite
 * way, so the arrow bearing is the reciprocal, normalised to 0–360.
 */
export function movementBearing(windFromDeg: number): number {
  return ((windFromDeg + 180) % 360 + 360) % 360;
}

interface SteeringHourly {
  time?: string[];
  wind_speed_700hPa?: (number | null)[];
  wind_direction_700hPa?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
}

interface SteeringLocation {
  hourly?: SteeringHourly;
}

function numAt(list: (number | null)[] | undefined, i: number): number | undefined {
  const v = list?.[i];
  return typeof v === 'number' ? v : undefined;
}

/**
 * Turn the Open-Meteo payload into arrows, one per input coordinate (order is
 * preserved, so index i pairs with coords[i]). Prefers the 700 hPa steering wind
 * and falls back to the 10 m wind; a point with neither is dropped rather than
 * drawn wrong.
 */
export function parseSteeringResponse(
  json: unknown,
  coords: LatLon[],
  nowUtcMs: number,
): WindArrow[] {
  const locations = (Array.isArray(json) ? json : [json]) as SteeringLocation[];
  const arrows: WindArrow[] = [];
  for (let i = 0; i < coords.length; i++) {
    const hourly = locations[i]?.hourly;
    if (!hourly?.time) continue;
    const idx = pickHourIndex(hourly.time, nowUtcMs);
    const dir = numAt(hourly.wind_direction_700hPa, idx) ?? numAt(hourly.wind_direction_10m, idx);
    const speed = numAt(hourly.wind_speed_700hPa, idx) ?? numAt(hourly.wind_speed_10m, idx);
    if (dir === undefined || speed === undefined) continue;
    arrows.push({
      lon: coords[i].lon,
      lat: coords[i].lat,
      bearing: movementBearing(dir),
      speedKmh: speed,
    });
  }
  return arrows;
}

export interface FetchSteeringOptions {
  fetchImpl?: typeof fetch;
  /** "Now" in epoch ms; injectable so tests pin the hour that gets picked. */
  nowMs?: number;
}

/**
 * Fetch steering wind for the grid points and resolve to drawable arrows.
 * Retries once on failure (matching the other Open-Meteo fetchers); callers
 * treat arrows as non-critical and swallow a final throw.
 */
export async function fetchSteeringWind(
  coords: LatLon[],
  options: FetchSteeringOptions = {},
  attempt = 1,
): Promise<WindArrow[]> {
  const { fetchImpl = fetch, nowMs = Date.now() } = options;
  if (coords.length === 0) return [];
  try {
    const res = await fetchImpl(buildSteeringWindUrl(coords));
    if (!res.ok) throw new Error(`Open-Meteo wind request failed: HTTP ${res.status}`);
    return parseSteeringResponse(await res.json(), coords, nowMs);
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) return fetchSteeringWind(coords, options, attempt + 1);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
