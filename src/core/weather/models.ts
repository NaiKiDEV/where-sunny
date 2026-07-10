import type { DayForecast, LatLon } from '../types';
import { DAILY_VARS, FORECAST_DAYS, mapDaily, systemTimeZone, type OpenMeteoDaily } from './openMeteo';

const API_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Independent global forecast models, queried per-place for the detail view.
 * When they agree, the forecast is trustworthy; when they don't, no single
 * provider (including a local one) deserves blind trust.
 */
export const FORECAST_MODELS = [
  { id: 'ecmwf_ifs025', label: 'ECMWF' },
  { id: 'gfs_seamless', label: 'GFS' },
  { id: 'icon_seamless', label: 'ICON' },
] as const;

export type ModelId = (typeof FORECAST_MODELS)[number]['id'];

export interface ModelForecast {
  model: ModelId;
  label: string;
  days: DayForecast[];
}

export interface FetchModelOptions {
  fetchImpl?: typeof fetch;
  days?: number;
  timezone?: string;
}

export function buildModelsUrl(coord: LatLon, days = FORECAST_DAYS, timezone = 'auto'): string {
  const params = new URLSearchParams({
    latitude: coord.lat.toFixed(3),
    longitude: coord.lon.toFixed(3),
    daily: DAILY_VARS.join(','),
    models: FORECAST_MODELS.map((m) => m.id).join(','),
    forecast_days: String(days),
    timezone,
  });
  return `${API_BASE}?${params}`;
}

/** Multi-model responses suffix every daily array with the model id. */
export function parseModelsResponse(json: unknown): ModelForecast[] {
  const daily = (json as { daily?: Record<string, unknown> }).daily ?? {};
  return FORECAST_MODELS.map(({ id, label }) => {
    const forModel: Record<string, unknown> = { time: daily.time };
    for (const variable of DAILY_VARS) {
      forModel[variable] = daily[`${variable}_${id}`];
    }
    return { model: id, label, days: mapDaily(forModel as OpenMeteoDaily) };
  });
}

export async function fetchModelForecasts(
  coord: LatLon,
  options: FetchModelOptions = {},
): Promise<ModelForecast[]> {
  const { fetchImpl = fetch, days = FORECAST_DAYS, timezone = systemTimeZone() } = options;
  const res = await fetchImpl(buildModelsUrl(coord, days, timezone));
  if (!res.ok) throw new Error(`Model comparison request failed: HTTP ${res.status}`);
  return parseModelsResponse(await res.json());
}
