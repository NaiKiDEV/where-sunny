/**
 * Climate normals from the Open-Meteo Archive API (free, no key, CORS).
 * One fetch covers the last ten full calendar years of daily tmax,
 * precipitation and sunshine (~115 kB, ~1 s); pure reducers turn it into
 * monthly normals, a typical tmax for any calendar date, an anomaly band for
 * "is this normal?" notes, and a best-months-to-visit blend. Fetch injects
 * `fetchImpl` for tests; everything below the fetch is pure.
 */
import type { LatLon } from '../types';

const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';
const ARCHIVE_YEARS = 10;
/** WMO "wet day": at least 1 mm of precipitation. */
const RAIN_DAY_MM = 1;
/** Forecast-vs-normal differences smaller than this are noise, not a story. */
const ANOMALY_MIN_C = 3;
/** Above this the anomaly stops being "notable" and becomes "strong". */
const ANOMALY_STRONG_C = 6;
/** Days pooled on each side of a calendar date for its typical tmax. */
const DATE_WINDOW_DAYS = 7;
const SECONDS_PER_HOUR = 3600;
const MONTHS_PER_YEAR = 12;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface MonthlyNormal {
  /** Calendar month, 1–12. */
  month: number;
  /** Mean daily maximum temperature, °C. */
  avgTmax: number;
  /** Average count of wet days (≥1 mm) in this month per year. */
  rainDays: number;
  /** Mean sunshine per day, hours. */
  sunshineHoursPerDay: number;
}

export interface ClimateNormals {
  /** Always 12 entries, January first. */
  monthly: MonthlyNormal[];
  /** Mean tmax per calendar day across the archive years, keyed `MM-DD`. */
  tmaxByDay: Record<string, number>;
  /** First and last archive year reduced from, or null for an empty series. */
  years: { start: number; end: number } | null;
}

export interface TempAnomaly {
  /** Signed forecast − typical difference, °C, unrounded. */
  deltaC: number;
  direction: 'warmer' | 'cooler';
  band: 'notable' | 'strong';
}

/** Daily block of an Open-Meteo archive response (verified live 2026-07). */
interface ArchiveDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  precipitation_sum: (number | null)[];
  sunshine_duration: (number | null)[];
}

export interface FetchNormalsOptions {
  fetchImpl?: typeof fetch;
  /** Injected clock for tests; the range always ends last calendar year. */
  now?: Date;
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

export function monthShortName(month: number): string {
  return monthName(month).slice(0, 3);
}

/** The last ten full calendar years before `now` (normals want closed years). */
export function archiveRange(now = new Date()): { startDate: string; endDate: string } {
  const endYear = now.getFullYear() - 1;
  return {
    startDate: `${endYear - ARCHIVE_YEARS + 1}-01-01`,
    endDate: `${endYear}-12-31`,
  };
}

export function buildArchiveUrl(coords: LatLon, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    start_date: startDate,
    end_date: endDate,
    daily: 'temperature_2m_max,precipitation_sum,sunshine_duration',
    timezone: 'auto',
  });
  return `${ARCHIVE_BASE}?${params}`;
}

/**
 * Reduce a daily archive series to monthly normals plus a per-calendar-day
 * typical tmax. Null rows are skipped per variable; months absent from the
 * series (impossible with full-year fetches) come back zeroed.
 */
export function reduceNormals(daily: ArchiveDaily): ClimateNormals {
  const tmaxSum = new Array<number>(MONTHS_PER_YEAR).fill(0);
  const tmaxCount = new Array<number>(MONTHS_PER_YEAR).fill(0);
  const sunSum = new Array<number>(MONTHS_PER_YEAR).fill(0);
  const sunCount = new Array<number>(MONTHS_PER_YEAR).fill(0);
  const wetDays = new Array<number>(MONTHS_PER_YEAR).fill(0);
  const yearsPerMonth: Set<string>[] = Array.from({ length: MONTHS_PER_YEAR }, () => new Set());
  const daySum: Record<string, number> = {};
  const dayCount: Record<string, number> = {};

  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i];
    const monthIdx = Number(date.slice(5, 7)) - 1;
    if (monthIdx < 0 || monthIdx >= MONTHS_PER_YEAR) continue;

    yearsPerMonth[monthIdx].add(date.slice(0, 4));

    const tmax = daily.temperature_2m_max[i];
    if (tmax != null) {
      tmaxSum[monthIdx] += tmax;
      tmaxCount[monthIdx] += 1;
      const dayKey = date.slice(5, 10);
      daySum[dayKey] = (daySum[dayKey] ?? 0) + tmax;
      dayCount[dayKey] = (dayCount[dayKey] ?? 0) + 1;
    }

    const precip = daily.precipitation_sum[i];
    if (precip != null && precip >= RAIN_DAY_MM) wetDays[monthIdx] += 1;

    const sun = daily.sunshine_duration[i];
    if (sun != null) {
      sunSum[monthIdx] += sun / SECONDS_PER_HOUR;
      sunCount[monthIdx] += 1;
    }
  }

  const monthly = Array.from({ length: MONTHS_PER_YEAR }, (_, idx) => ({
    month: idx + 1,
    avgTmax: tmaxCount[idx] > 0 ? tmaxSum[idx] / tmaxCount[idx] : 0,
    rainDays: yearsPerMonth[idx].size > 0 ? wetDays[idx] / yearsPerMonth[idx].size : 0,
    sunshineHoursPerDay: sunCount[idx] > 0 ? sunSum[idx] / sunCount[idx] : 0,
  }));

  const tmaxByDay = Object.fromEntries(
    Object.keys(daySum).map((key) => [key, daySum[key] / dayCount[key]]),
  );

  const allYears = [...new Set(daily.time.map((d) => Number(d.slice(0, 4))))];
  const years =
    allYears.length > 0 ? { start: Math.min(...allYears), end: Math.max(...allYears) } : null;

  return { monthly, tmaxByDay, years };
}

/**
 * Typical tmax for a calendar date: the mean over a ±7-day window around it.
 * Date arithmetic runs in UTC so early January's window correctly reaches
 * back into late December (and vice versa). Null when no samples exist.
 */
export function dateNormal(normals: ClimateNormals, isoDate: string): number | null {
  const base = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;

  let sum = 0;
  let count = 0;
  for (let offset = -DATE_WINDOW_DAYS; offset <= DATE_WINDOW_DAYS; offset++) {
    const day = new Date(base);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = day.toISOString().slice(5, 10);
    const value = normals.tmaxByDay[key];
    if (value != null) {
      sum += value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Band a forecast tmax against the typical tmax for that date. Returns null
 * (suppressed) when the difference is under ±3 °C or no normal is available —
 * ordinary weather wobble is not worth a note.
 */
export function anomaly(forecastTmax: number, typicalTmax: number | null): TempAnomaly | null {
  if (typicalTmax == null) return null;
  const deltaC = forecastTmax - typicalTmax;
  if (Math.abs(deltaC) < ANOMALY_MIN_C) return null;
  return {
    deltaC,
    direction: deltaC > 0 ? 'warmer' : 'cooler',
    band: Math.abs(deltaC) >= ANOMALY_STRONG_C ? 'strong' : 'notable',
  };
}

/**
 * 0–1 visit appeal for a month: a simple blend of sunshine (40%), pleasant
 * daytime warmth peaking around 24 °C tmax (30%) and dryness (30%).
 */
export function monthScore(normal: MonthlyNormal): number {
  const sun = clamp01(normal.sunshineHoursPerDay / 10);
  const temp = clamp01(1 - Math.abs(normal.avgTmax - 24) / 12);
  const dry = clamp01(1 - normal.rainDays / 15);
  return 0.4 * sun + 0.3 * temp + 0.3 * dry;
}

/** The top `count` months to visit, in calendar order. */
export function bestMonths(monthly: MonthlyNormal[], count = 3): number[] {
  return [...monthly]
    .sort((a, b) => monthScore(b) - monthScore(a))
    .slice(0, count)
    .map((m) => m.month)
    .sort((a, b) => a - b);
}

/**
 * Compact human summary of a month list: consecutive months collapse into
 * ranges and a December–January run wraps across the new year
 * (e.g. [5,6,9] → "May–Jun & Sep", [1,11,12] → "Nov–Jan").
 */
export function formatMonthRanges(months: number[]): string {
  if (months.length === 0) return '';
  const sorted = [...new Set(months)].sort((a, b) => a - b);

  const ranges: { start: number; end: number }[] = [];
  for (const month of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && month === last.end + 1) ranges[ranges.length - 1] = { ...last, end: month };
    else ranges.push({ start: month, end: month });
  }

  // Wrap a trailing December run into a leading January run (Nov–Jan).
  if (ranges.length > 1) {
    const first = ranges[0];
    const last = ranges[ranges.length - 1];
    if (first.start === 1 && last.end === MONTHS_PER_YEAR) {
      ranges.shift();
      ranges[ranges.length - 1] = { start: last.start, end: first.end };
    }
  }

  const parts = ranges.map((r) =>
    r.start === r.end
      ? monthShortName(r.start)
      : `${monthShortName(r.start)}–${monthShortName(r.end)}`,
  );
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
}

/** "mid-July"-style phrase for anomaly notes: early/mid/late plus the month. */
export function describeDatePart(isoDate: string): string {
  const day = Number(isoDate.slice(8, 10));
  const name = monthName(Number(isoDate.slice(5, 7)));
  if (day <= 10) return `early ${name}`;
  if (day <= 20) return `mid-${name}`;
  return `late ${name}`;
}

export async function fetchClimateNormals(
  coords: LatLon,
  opts: FetchNormalsOptions = {},
): Promise<ClimateNormals> {
  const { fetchImpl = fetch, now } = opts;
  const { startDate, endDate } = archiveRange(now);

  const res = await fetchImpl(buildArchiveUrl(coords, startDate, endDate));
  if (!res.ok) throw new Error(`Open-Meteo archive failed: HTTP ${res.status}`);

  const json = (await res.json()) as { daily?: Partial<ArchiveDaily> };
  const daily = json.daily;
  if (
    !daily ||
    !Array.isArray(daily.time) ||
    !Array.isArray(daily.temperature_2m_max) ||
    !Array.isArray(daily.precipitation_sum) ||
    !Array.isArray(daily.sunshine_duration)
  ) {
    throw new Error('Open-Meteo archive returned malformed daily data');
  }

  return reduceNormals(daily as ArchiveDaily);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
