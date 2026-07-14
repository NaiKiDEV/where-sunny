/**
 * Public holidays and long weekends for a country, from the free, no-key,
 * CORS-enabled Nager.Date API. Fetch functions inject `fetchImpl` for tests
 * (same pattern as core/weather/openMeteo.ts); the range/date helpers are pure
 * so they unit-test without a network.
 */

const API_BASE = 'https://date.nager.at/api/v3';

/** Public holiday, trimmed to the fields the UI needs. */
export interface PublicHoliday {
  /** YYYY-MM-DD, in the country's local calendar. */
  date: string;
  /** Name in the country's own language ("Fête nationale"). */
  localName: string;
  /** English name ("National Day"). */
  name: string;
  /** True when observed nationwide (vs. only some counties). */
  global: boolean;
  /** ISO-3166-2 subdivisions it applies to, or null when nationwide. */
  counties: string[] | null;
  /** e.g. ["Public", "Bank"]. */
  types: string[];
}

/** A run of days off around a holiday (may need a bridge day). */
export interface LongWeekend {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dayCount: number;
  needBridgeDay: boolean;
}

interface RawHoliday {
  date?: string;
  localName?: string;
  name?: string;
  global?: boolean;
  counties?: string[] | null;
  types?: string[];
}

interface RawLongWeekend {
  startDate?: string;
  endDate?: string;
  dayCount?: number;
  needBridgeDay?: boolean;
}

export interface CalendarFetchOptions {
  fetchImpl?: typeof fetch;
}

/**
 * Nager returns HTTP 404 for the ~150 countries it does not cover. That is a
 * "no data" signal, not a failure - return [] and let the UI hide itself. Only
 * genuine network/5xx errors throw, so TanStack Query still retries those.
 */
async function fetchNager<T>(path: string, fetchImpl: typeof fetch): Promise<T[]> {
  const res = await fetchImpl(`${API_BASE}/${path}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Calendar request failed: HTTP ${res.status}`);
  const json = (await res.json()) as T[] | null;
  return Array.isArray(json) ? json : [];
}

export async function fetchPublicHolidays(
  countryCode: string,
  year: number,
  opts: CalendarFetchOptions = {},
): Promise<PublicHoliday[]> {
  const { fetchImpl = fetch } = opts;
  const raw = await fetchNager<RawHoliday>(`PublicHolidays/${year}/${countryCode}`, fetchImpl);
  return raw
    .filter((h): h is RawHoliday & { date: string } => typeof h.date === 'string')
    .map((h) => ({
      date: h.date,
      localName: h.localName ?? h.name ?? '',
      name: h.name ?? h.localName ?? '',
      global: h.global ?? true,
      counties: h.counties ?? null,
      types: h.types ?? [],
    }));
}

export async function fetchLongWeekends(
  countryCode: string,
  year: number,
  opts: CalendarFetchOptions = {},
): Promise<LongWeekend[]> {
  const { fetchImpl = fetch } = opts;
  const raw = await fetchNager<RawLongWeekend>(`LongWeekend/${year}/${countryCode}`, fetchImpl);
  return raw
    .filter(
      (w): w is RawLongWeekend & { startDate: string; endDate: string } =>
        typeof w.startDate === 'string' && typeof w.endDate === 'string',
    )
    .map((w) => ({
      startDate: w.startDate,
      endDate: w.endDate,
      dayCount: w.dayCount ?? 0,
      needBridgeDay: w.needBridgeDay ?? false,
    }));
}

/** Holidays falling exactly on `isoDate`. */
export function holidaysOnDate(holidays: PublicHoliday[], isoDate: string): PublicHoliday[] {
  return holidays.filter((h) => h.date === isoDate);
}

/** Holidays within [startIso, endIso] inclusive (ISO date strings sort lexically). */
export function holidaysInRange(
  holidays: PublicHoliday[],
  startIso: string,
  endIso: string,
): PublicHoliday[] {
  const [lo, hi] = startIso <= endIso ? [startIso, endIso] : [endIso, startIso];
  return holidays.filter((h) => h.date >= lo && h.date <= hi);
}

/**
 * Long weekends not yet over on `fromIso` (an ongoing one still counts),
 * sorted by start date, capped to `limit`.
 */
export function upcomingLongWeekends(
  weekends: LongWeekend[],
  fromIso: string,
  limit: number,
): LongWeekend[] {
  return weekends
    .filter((w) => w.endDate >= fromIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, Math.max(0, limit));
}

/**
 * Years to fetch so the 7-day forecast window and the "upcoming long weekends"
 * look-ahead survive a year-end boundary: the current year plus the next.
 */
export function yearsToFetch(fromIso: string): number[] {
  const year = Number(fromIso.slice(0, 4));
  return Number.isFinite(year) ? [year, year + 1] : [new Date().getFullYear()];
}
