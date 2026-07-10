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

export function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`;
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

interface WeatherDescription {
  emoji: string;
  label: string;
}

const WEATHER_CODES: [Set<number>, WeatherDescription][] = [
  [new Set([0]), { emoji: '☀️', label: 'Clear sky' }],
  [new Set([1]), { emoji: '🌤️', label: 'Mostly clear' }],
  [new Set([2]), { emoji: '⛅', label: 'Partly cloudy' }],
  [new Set([3]), { emoji: '☁️', label: 'Overcast' }],
  [new Set([45, 48]), { emoji: '🌫️', label: 'Fog' }],
  [new Set([51, 53, 55, 56, 57]), { emoji: '🌦️', label: 'Drizzle' }],
  [new Set([61, 63, 65, 66, 67]), { emoji: '🌧️', label: 'Rain' }],
  [new Set([71, 73, 75, 77]), { emoji: '🌨️', label: 'Snow' }],
  [new Set([80, 81, 82]), { emoji: '🌧️', label: 'Rain showers' }],
  [new Set([85, 86]), { emoji: '🌨️', label: 'Snow showers' }],
  [new Set([95, 96, 99]), { emoji: '⛈️', label: 'Thunderstorm' }],
];

export function describeWeather(code: number): WeatherDescription {
  for (const [codes, description] of WEATHER_CODES) {
    if (codes.has(code)) return description;
  }
  return { emoji: '☁️', label: 'Cloudy' };
}

export function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
