import type { DayForecast, ScoredDay } from '../types';

export const SCORE_WEIGHTS = { sun: 0.5, temp: 0.3, cloud: 0.1, rain: 0.4, wind: 0.12 } as const;

// Wind comfort: nothing below WIND_CALM, fully unpleasant by WIND_STRONG (km/h).
const WIND_CALM_KMH = 20;
const WIND_STRONG_KMH = 55;

/** User-adjustable temperature comfort plateau (°C, by daily max). */
export interface ComfortPrefs {
  idealMin: number;
  idealMax: number;
}

export const DEFAULT_COMFORT: ComfortPrefs = { idealMin: 18, idealMax: 26 };

export interface ComfortPreset extends ComfortPrefs {
  id: string;
  /** Short name; the range is rendered alongside so it can follow the active unit. */
  name: string;
}

/** Sentinel preset that ignores temperature entirely (sun-only ranking). */
export const ANY_COMFORT_ID = 'any';

export const COMFORT_PRESETS: ComfortPreset[] = [
  { id: 'cool', name: 'Cool', idealMin: 10, idealMax: 22 },
  { id: 'mild', name: 'Mild', idealMin: 18, idealMax: 26 },
  { id: 'hot', name: 'Hot', idealMin: 24, idealMax: 32 },
  { id: ANY_COMFORT_ID, name: 'Any temp', idealMin: -60, idealMax: 60 },
];

// comfort falls linearly from the plateau edges to 0 over these spans
const COLD_SPAN = 18;
const HOT_SPAN = 12;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 1 inside the [idealMin, idealMax] plateau, falling linearly to 0 outside. */
export function temperatureComfort(tempMax: number, prefs: ComfortPrefs = DEFAULT_COMFORT): number {
  if (Number.isNaN(tempMax)) return 0.5;
  if (tempMax >= prefs.idealMin && tempMax <= prefs.idealMax) return 1;
  if (tempMax < prefs.idealMin) return clamp(1 - (prefs.idealMin - tempMax) / COLD_SPAN, 0, 1);
  return clamp(1 - (tempMax - prefs.idealMax) / HOT_SPAN, 0, 1);
}

/**
 * 0 when calm, ramping to 1 in a stiff wind. Undefined wind = 0 penalty: no
 * data must never fabricate a penalty (keeps pre-enrichment cache neutral).
 */
export function windPenaltyFactor(windMax: number | undefined): number {
  if (windMax === undefined || !Number.isFinite(windMax)) return 0;
  return clamp((windMax - WIND_CALM_KMH) / (WIND_STRONG_KMH - WIND_CALM_KMH), 0, 1);
}

/** The temperature the comfort curve reads - "feels like" when available, else dry-bulb. */
export function comfortTemp(day: DayForecast): number {
  return day.apparentTempMax ?? day.tempMax;
}

/**
 * Sun score 0–100. Sunshine ratio (sunshine/daylight, self-correcting for
 * latitude and season) and temperature comfort push up; cloud cover, rain
 * probability, and strong wind pull down. Comfort reads "feels like"
 * temperature when the forecast supplies it. Normalized so a perfect day
 * reaches 100.
 */
export function scoreDay(day: DayForecast, prefs: ComfortPrefs = DEFAULT_COMFORT): number {
  const sunshineRatio =
    day.daylightDuration > 0 ? clamp(day.sunshineDuration / day.daylightDuration, 0, 1) : 0;
  const positive =
    SCORE_WEIGHTS.sun * sunshineRatio + SCORE_WEIGHTS.temp * temperatureComfort(comfortTemp(day), prefs);
  const penalty =
    SCORE_WEIGHTS.cloud * (day.cloudCoverMean / 100) +
    SCORE_WEIGHTS.rain * (day.precipProbMax / 100) +
    SCORE_WEIGHTS.wind * windPenaltyFactor(day.windMax);
  const normalized = (positive - penalty) / (SCORE_WEIGHTS.sun + SCORE_WEIGHTS.temp);
  return Math.round(clamp(normalized, 0, 1) * 100);
}

export function scoreDays(days: DayForecast[], prefs: ComfortPrefs = DEFAULT_COMFORT): ScoredDay[] {
  return days.map((day) => ({ ...day, score: scoreDay(day, prefs) }));
}
