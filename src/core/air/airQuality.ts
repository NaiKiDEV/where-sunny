/**
 * Air quality and pollen from the Open-Meteo Air Quality API (free, no key,
 * CORS-enabled - same vendor and conventions as the forecast client). Hourly
 * series are reduced to per-day summaries: worst AQI of the day plus the most
 * significant pollen, if any. Pollen variables are Europe-only (CAMS) - outside
 * Europe the API returns all-null series, which MUST read as "no data", never
 * as "low". Fetch injects `fetchImpl` for tests; reduction/banding are pure.
 */
import type { LatLon } from '../types';

const API_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
/** Matches the app's 7-day forecast window (verified live: 168 hourly rows). */
const DEFAULT_FORECAST_DAYS = 7;

export type AqiBand = 'good' | 'fair' | 'poor' | 'very poor';

export type PollenKind = 'birch' | 'grass' | 'olive' | 'ragweed';

export type PollenLevel = 'low' | 'moderate' | 'high';

export interface DominantPollen {
  kind: PollenKind;
  /** Only noteworthy levels surface; "low" days carry no dominantPollen. */
  level: Exclude<PollenLevel, 'low'>;
}

export interface AirDaySummary {
  /** Local calendar date (YYYY-MM-DD, API timezone=auto). */
  date: string;
  /** Worst European AQI hour of the day; null when the series has no data. */
  maxEuropeanAqi: number | null;
  /** Worst US AQI hour of the day; null when the series has no data. */
  maxUsAqi: number | null;
  /** Highest-relative pollen at moderate+; undefined when low or no data. */
  dominantPollen?: DominantPollen;
}

export interface FetchAirQualityOptions {
  forecastDays?: number;
  fetchImpl?: typeof fetch;
}

type HourlySeries = (number | null)[] | undefined;

interface AirQualityHourly {
  time?: string[];
  european_aqi?: HourlySeries;
  us_aqi?: HourlySeries;
  birch_pollen?: HourlySeries;
  grass_pollen?: HourlySeries;
  olive_pollen?: HourlySeries;
  ragweed_pollen?: HourlySeries;
}

/**
 * European AQI banding. Official EAQI level boundaries are 20/40/60/80/100;
 * this app collapses six official levels onto four travel-relevant words:
 * good (<=20), fair (<=60, official fair + moderate - health advice only
 * changes at "poor"), poor (<=80), very poor (>80, incl. extremely poor).
 */
const AQI_GOOD_MAX = 20;
const AQI_FAIR_MAX = 60;
const AQI_POOR_MAX = 80;

/**
 * Per-species grains/m3 thresholds for the day's peak hour. Allergenicity
 * differs wildly per species (ragweed triggers at counts birch shrugs off),
 * so each kind carries its own commonly cited clinical boundaries.
 */
const POLLEN_THRESHOLDS: Record<PollenKind, { moderate: number; high: number }> = {
  birch: { moderate: 20, high: 100 },
  grass: { moderate: 20, high: 50 },
  olive: { moderate: 50, high: 200 },
  ragweed: { moderate: 5, high: 20 },
};

export function aqiBand(aqi: number): AqiBand {
  if (aqi <= AQI_GOOD_MAX) return 'good';
  if (aqi <= AQI_FAIR_MAX) return 'fair';
  if (aqi <= AQI_POOR_MAX) return 'poor';
  return 'very poor';
}

export function pollenLevel(kind: PollenKind, grainsPerM3: number): PollenLevel {
  const t = POLLEN_THRESHOLDS[kind];
  if (grainsPerM3 >= t.high) return 'high';
  if (grainsPerM3 >= t.moderate) return 'moderate';
  return 'low';
}

export function buildAirQualityUrl(coords: LatLon, forecastDays: number): string {
  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    hourly: [
      'european_aqi',
      'us_aqi',
      'birch_pollen',
      'grass_pollen',
      'olive_pollen',
      'ragweed_pollen',
    ].join(','),
    forecast_days: String(forecastDays),
    timezone: 'auto',
  });
  return `${API_BASE}?${params}`;
}

/** Max of the given hour indices, or null when every value is null/missing. */
function maxAt(series: HourlySeries, indices: number[]): number | null {
  if (!series) return null;
  let max: number | null = null;
  for (const i of indices) {
    const v = series[i];
    if (typeof v !== 'number') continue;
    if (max === null || v > max) max = v;
  }
  return max;
}

/**
 * Most significant pollen for the day: every species' peak is scored relative
 * to its own "high" threshold, and only moderate+ wins. All-null series (the
 * API's "no data here" outside Europe) never produce a pick - a day with no
 * pollen data must not read as a low-pollen day.
 */
function dominantPollenAt(hourly: AirQualityHourly, indices: number[]): DominantPollen | undefined {
  const peaks: Record<PollenKind, HourlySeries> = {
    birch: hourly.birch_pollen,
    grass: hourly.grass_pollen,
    olive: hourly.olive_pollen,
    ragweed: hourly.ragweed_pollen,
  };

  let best: { kind: PollenKind; level: Exclude<PollenLevel, 'low'>; severity: number } | null =
    null;
  for (const kind of Object.keys(peaks) as PollenKind[]) {
    const peak = maxAt(peaks[kind], indices);
    if (peak === null) continue;
    const level = pollenLevel(kind, peak);
    if (level === 'low') continue;
    const severity = peak / POLLEN_THRESHOLDS[kind].high;
    if (!best || severity > best.severity) {
      best = { kind, level, severity };
    }
  }
  return best ? { kind: best.kind, level: best.level } : undefined;
}

/**
 * Reduce the hourly response to one summary per local calendar day. Pure -
 * the network layer feeds it parsed JSON. Null hours inside a series are
 * skipped; a fully null series yields null AQI / no dominant pollen.
 */
export function summarizeDaily(hourly: AirQualityHourly): AirDaySummary[] {
  const time = hourly.time ?? [];
  const indicesByDate = new Map<string, number[]>();
  time.forEach((iso, i) => {
    const date = iso.slice(0, 10);
    const existing = indicesByDate.get(date);
    if (existing) existing.push(i);
    else indicesByDate.set(date, [i]);
  });

  return [...indicesByDate.entries()].map(([date, indices]) => ({
    date,
    maxEuropeanAqi: maxAt(hourly.european_aqi, indices),
    maxUsAqi: maxAt(hourly.us_aqi, indices),
    dominantPollen: dominantPollenAt(hourly, indices),
  }));
}

export async function fetchAirQuality(
  coords: LatLon,
  opts: FetchAirQualityOptions = {},
): Promise<AirDaySummary[]> {
  const { forecastDays = DEFAULT_FORECAST_DAYS, fetchImpl = fetch } = opts;
  const res = await fetchImpl(buildAirQualityUrl(coords, forecastDays));
  if (!res.ok) throw new Error(`Air quality fetch failed: HTTP ${res.status}`);
  const json = (await res.json()) as { hourly?: AirQualityHourly };
  return summarizeDaily(json.hourly ?? {});
}
