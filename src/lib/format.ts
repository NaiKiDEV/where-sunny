import { codeOf } from '../core/bannedCountries';
import { toLocalIsoDate } from '../core/scoring/window';

const SECONDS_PER_HOUR = 3600;
const MINUTES_PER_HOUR = 60;

/** Which system distances, speeds, and heights are shown in. Stored metric; converted on display. */
export type UnitSystem = 'metric' | 'imperial';

const KM_PER_MILE = 1.609344;
const FEET_PER_METER = 3.28084;
const CM_PER_INCH = 2.54;

export function formatDistance(km: number, system: UnitSystem): string {
  const isImperial = system === 'imperial';
  const value = isImperial ? km / KM_PER_MILE : km;
  const suffix = isImperial ? 'mi' : 'km';
  if (value < 1) return `< 1 ${suffix}`;
  return value < 10
    ? `${value.toFixed(1)} ${suffix}`
    : `${Math.round(value).toLocaleString('en-US')} ${suffix}`;
}

/** Drive-time duration: "45 min" under an hour, then "2 h" / "3 h 05 min". */
export function formatDriveTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < MINUTES_PER_HOUR) return `${total} min`;
  const h = Math.floor(total / MINUTES_PER_HOUR);
  const m = total % MINUTES_PER_HOUR;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

export function formatSunHours(seconds: number): string {
  const hours = seconds / SECONDS_PER_HOUR;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

/** Which unit temperatures are shown in. Stored raw in Celsius; converted on display. */
export type TempUnit = 'c' | 'f';

export function toDisplayTemp(celsius: number, unit: TempUnit): number {
  return unit === 'f' ? (celsius * 9) / 5 + 32 : celsius;
}

/** Rounded degrees with the degree symbol but no unit letter ("20°"). For ranges that share a unit. */
export function formatTempBare(celsius: number, unit: TempUnit): string {
  return `${Math.round(toDisplayTemp(celsius, unit))}°`;
}

/** Rounded temperature with its unit symbol ("20°C" / "68°F"). */
export function formatTemp(celsius: number, unit: TempUnit): string {
  return `${formatTempBare(celsius, unit)}${unit === 'f' ? 'F' : 'C'}`;
}

export function formatElevation(meters: number, system: UnitSystem): string {
  const isImperial = system === 'imperial';
  const value = isImperial ? meters * FEET_PER_METER : meters;
  return `${Math.round(value).toLocaleString('en-US')} ${isImperial ? 'ft' : 'm'}`;
}

export function formatWind(kmh: number, system: UnitSystem): string {
  return system === 'imperial'
    ? `${Math.round(kmh / KM_PER_MILE)} mph`
    : `${Math.round(kmh)} km/h`;
}

/** Sea heights (waves, tidal range): one decimal up to 10, whole numbers above. */
export function formatSeaHeight(meters: number, system: UnitSystem): string {
  const isImperial = system === 'imperial';
  const value = isImperial ? meters * FEET_PER_METER : meters;
  const suffix = isImperial ? 'ft' : 'm';
  return value < 10 ? `${value.toFixed(1)} ${suffix}` : `${Math.round(value)} ${suffix}`;
}

/** Snow depths: whole centimetres or inches. */
export function formatSnowDepth(cm: number, system: UnitSystem): string {
  return system === 'imperial' ? `${Math.round(cm / CM_PER_INCH)} in` : `${Math.round(cm)} cm`;
}

/** "2026-07-12T05:12" -> "05:12"; "" when the input is too short to hold a time. */
export function formatClock(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : '';
}

/** UV plain-language band (WHO scale). */
export function uvBand(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

/**
 * "Today" or a short weekday name ("Sat") - never "Tomorrow". For dated day
 * strips where the day after today needs no callout.
 */
export function shortDayLabel(isoDate: string, now = new Date()): string {
  if (isoDate === toLocalIsoDate(now)) return 'Today';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}

/** Day-of-month from an ISO date ("2026-07-15" → 15). */
export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

/** "Today", "Tomorrow", or a short weekday name ("Sat"). */
export function dayLabel(isoDate: string, now = new Date()): string {
  if (isoDate === toLocalIsoDate(now)) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isoDate === toLocalIsoDate(tomorrow)) return 'Tomorrow';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}

/**
 * A concrete calendar date with weekday ("Fri, 1 Aug"). Unlike dayLabel it never
 * collapses to "Today"/weekday-only, so dates weeks or months out stay distinct.
 */
export function formatWeekendDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Two-letter ISO country code → emoji flag. */
export function countryFlag(countryCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryCode)) return '';
  return [...countryCode.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// Lazy singleton, mirroring core/currency's Intl.DisplayNames usage.
let regionNames: Intl.DisplayNames | null = null;

/**
 * English country display name for a place ("PT" → "Portugal"). Bundled cities
 * carry the alpha-2 code (in `country`), geocoded places a full name - resolve
 * codes via Intl and pass full names through. Undefined when unresolvable.
 */
export function countryDisplayName(place: {
  country?: string;
  countryCode?: string;
}): string | undefined {
  const code = codeOf(place);
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      regionNames ??= new Intl.DisplayNames('en', { type: 'region' });
      const name = regionNames.of(code);
      if (name && name !== code) return name;
    } catch {
      // Region data unavailable - fall through to the raw name check.
    }
  }
  const raw = place.country?.trim();
  return raw && raw.length > 2 ? raw : undefined;
}

const WEATHER_LABELS: [Set<number>, string][] = [
  [new Set([0]), 'Clear sky'],
  [new Set([1]), 'Mostly clear'],
  [new Set([2]), 'Partly cloudy'],
  [new Set([3]), 'Overcast'],
  [new Set([45, 48]), 'Fog'],
  [new Set([51, 53, 55, 56, 57]), 'Drizzle'],
  [new Set([61, 63, 65, 66, 67]), 'Rain'],
  [new Set([71, 73, 75, 77]), 'Snow'],
  [new Set([80, 81, 82]), 'Rain showers'],
  [new Set([85, 86]), 'Snow showers'],
  [new Set([95, 96, 99]), 'Thunderstorm'],
];

/** Human label for a WMO weather code. See weatherVisual() for the matching icon. */
export function describeWeather(code: number): string {
  for (const [codes, label] of WEATHER_LABELS) {
    if (codes.has(code)) return label;
  }
  return 'Cloudy';
}

export function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
