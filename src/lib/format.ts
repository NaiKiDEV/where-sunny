import { toLocalIsoDate } from '../core/scoring/window';

const SECONDS_PER_HOUR = 3600;

export function formatDistance(km: number): string {
  if (km < 1) return '< 1 km';
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
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

export function formatElevation(meters: number): string {
  return `${Math.round(meters).toLocaleString()} m`;
}

export function formatWind(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
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

/** "Today", "Tomorrow", or a short weekday name ("Sat"). */
export function dayLabel(isoDate: string, now = new Date()): string {
  if (isoDate === toLocalIsoDate(now)) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isoDate === toLocalIsoDate(tomorrow)) return 'Tomorrow';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}

/** Two-letter ISO country code → emoji flag. */
export function countryFlag(countryCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryCode)) return '';
  return [...countryCode.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
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
