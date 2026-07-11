import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export interface WeatherVisual {
  Icon: LucideIcon;
  /** Tone color (CSS custom property) so the glyph reads at a glance. */
  color: string;
}

const SUN = 'var(--color-sun-600)';
const SKY = 'var(--color-sky)';
const CLOUD = 'var(--color-ink-faint)';

// WMO weather codes → line icon + tone. Grouped the same way as describeWeather.
const WEATHER_VISUALS: [Set<number>, WeatherVisual][] = [
  [new Set([0]), { Icon: Sun, color: SUN }],
  [new Set([1, 2]), { Icon: CloudSun, color: SUN }],
  [new Set([3]), { Icon: Cloud, color: CLOUD }],
  [new Set([45, 48]), { Icon: CloudFog, color: CLOUD }],
  [new Set([51, 53, 55, 56, 57]), { Icon: CloudDrizzle, color: SKY }],
  [new Set([61, 63, 65, 66, 67, 80, 81, 82]), { Icon: CloudRain, color: SKY }],
  [new Set([71, 73, 75, 77, 85, 86]), { Icon: CloudSnow, color: SKY }],
  [new Set([95, 96, 99]), { Icon: CloudLightning, color: SKY }],
];

export function weatherVisual(code: number): WeatherVisual {
  for (const [codes, visual] of WEATHER_VISUALS) {
    if (codes.has(code)) return visual;
  }
  return { Icon: Cloud, color: CLOUD };
}
