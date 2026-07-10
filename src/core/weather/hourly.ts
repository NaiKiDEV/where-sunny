import type { LatLon } from '../types';
import { FORECAST_DAYS, systemTimeZone } from './openMeteo';

const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const HOURLY_VARS = ['temperature_2m', 'cloud_cover', 'precipitation_probability', 'is_day'] as const;

export interface HourPoint {
  date: string; // YYYY-MM-DD
  hour: number; // 0–23
  temp: number;
  cloud: number; // 0–100
  precipProb: number; // 0–100
  isDay: boolean;
}

interface OpenMeteoHourly {
  time?: string[];
  temperature_2m?: (number | null)[];
  cloud_cover?: (number | null)[];
  precipitation_probability?: (number | null)[];
  is_day?: (number | null)[];
}

export interface FetchHourlyOptions {
  fetchImpl?: typeof fetch;
  days?: number;
  timezone?: string;
}

export function buildHourlyUrl(coord: LatLon, days = FORECAST_DAYS, timezone = 'auto'): string {
  const params = new URLSearchParams({
    latitude: coord.lat.toFixed(3),
    longitude: coord.lon.toFixed(3),
    hourly: HOURLY_VARS.join(','),
    forecast_days: String(days),
    timezone,
  });
  return `${API_BASE}?${params}`;
}

export function parseHourlyResponse(json: unknown): HourPoint[] {
  const hourly = ((json as { hourly?: OpenMeteoHourly }).hourly ?? {}) as OpenMeteoHourly;
  const time = hourly.time ?? [];
  const points: HourPoint[] = [];
  for (let i = 0; i < time.length; i++) {
    points.push({
      date: time[i].slice(0, 10),
      hour: Number(time[i].slice(11, 13)),
      temp: hourly.temperature_2m?.[i] ?? 15,
      cloud: hourly.cloud_cover?.[i] ?? 50,
      precipProb: hourly.precipitation_probability?.[i] ?? 0,
      isDay: (hourly.is_day?.[i] ?? 0) === 1,
    });
  }
  return points;
}

export async function fetchHourly(coord: LatLon, options: FetchHourlyOptions = {}): Promise<HourPoint[]> {
  const { fetchImpl = fetch, days = FORECAST_DAYS, timezone = systemTimeZone() } = options;
  const res = await fetchImpl(buildHourlyUrl(coord, days, timezone));
  if (!res.ok) throw new Error(`Hourly forecast request failed: HTTP ${res.status}`);
  return parseHourlyResponse(await res.json());
}
