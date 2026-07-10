import type { DayForecast } from '../types';
import type { ComfortPrefs } from './score';
import { clamp, DEFAULT_COMFORT, SCORE_WEIGHTS, scoreDay, temperatureComfort } from './score';

const NORM = SCORE_WEIGHTS.sun + SCORE_WEIGHTS.temp;

export type ScorePartId = 'sun' | 'warmth' | 'cloud' | 'rain';

export interface ScorePart {
  id: ScorePartId;
  /** Display integer. All parts sum exactly to `score` unless `isCapped`. */
  points: number;
  /** Theoretical extent of this factor (negative for penalties). */
  maxPoints: number;
}

export interface ScoreBreakdown {
  parts: ScorePart[];
  /** Same value scoreDay returns. */
  score: number;
  /** Unclamped float sum — negative on truly miserable days. */
  raw: number;
  /** True when raw < 0: the score bottomed out at 0 and parts exceed it. */
  isCapped: boolean;
  sunshineRatio: number;
  comfort: number;
}

/**
 * Decompose scoreDay's exact formula into user-facing point contributions.
 * Rounding uses the largest-remainder method so the displayed parts always
 * add up to the displayed score — a receipt that doesn't sum reads as broken.
 */
export function explainScore(day: DayForecast, prefs: ComfortPrefs = DEFAULT_COMFORT): ScoreBreakdown {
  const sunshineRatio =
    day.daylightDuration > 0 ? clamp(day.sunshineDuration / day.daylightDuration, 0, 1) : 0;
  const comfort = temperatureComfort(day.tempMax, prefs);

  const floats: { id: ScorePartId; value: number; max: number }[] = [
    { id: 'sun', value: ((SCORE_WEIGHTS.sun * sunshineRatio) / NORM) * 100, max: (SCORE_WEIGHTS.sun / NORM) * 100 },
    { id: 'warmth', value: ((SCORE_WEIGHTS.temp * comfort) / NORM) * 100, max: (SCORE_WEIGHTS.temp / NORM) * 100 },
    {
      id: 'cloud',
      value: -((SCORE_WEIGHTS.cloud * (day.cloudCoverMean / 100)) / NORM) * 100,
      max: -(SCORE_WEIGHTS.cloud / NORM) * 100,
    },
    {
      id: 'rain',
      value: -((SCORE_WEIGHTS.rain * (day.precipProbMax / 100)) / NORM) * 100,
      max: -(SCORE_WEIGHTS.rain / NORM) * 100,
    },
  ];

  const raw = floats.reduce((sum, f) => sum + f.value, 0);
  const score = scoreDay(day, prefs);
  const isCapped = raw < 0;

  const parts: ScorePart[] = floats.map((f) => ({
    id: f.id,
    points: Math.round(f.value),
    maxPoints: Math.round(f.max),
  }));

  if (!isCapped) {
    // nudge the parts with the largest rounding remainders until they sum to the score
    let diff = score - parts.reduce((sum, p) => sum + p.points, 0);
    const byRemainder = floats
      .map((f, i) => ({ i, remainder: f.value - Math.round(f.value) }))
      .sort((a, b) => (diff > 0 ? b.remainder - a.remainder : a.remainder - b.remainder));
    for (let k = 0; diff !== 0; k = (k + 1) % byRemainder.length) {
      parts[byRemainder[k].i].points += Math.sign(diff);
      diff -= Math.sign(diff);
    }
  }

  return { parts, score, raw, isCapped, sunshineRatio, comfort };
}
