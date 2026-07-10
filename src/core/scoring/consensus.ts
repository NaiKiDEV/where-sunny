import type { ModelForecast } from '../weather/models';
import type { ComfortPrefs } from './score';
import { DEFAULT_COMFORT, scoreDay } from './score';

export type AgreementLevel = 'high' | 'medium' | 'low';

const MEDIUM_SPREAD = 15;
const LOW_SPREAD = 30;

export interface ModelScore {
  model: string;
  label: string;
  score: number;
}

export interface DayConsensus {
  date: string;
  scores: ModelScore[];
  min: number;
  max: number;
  spread: number;
  level: AgreementLevel;
}

function levelForSpread(spread: number): AgreementLevel {
  if (spread <= MEDIUM_SPREAD) return 'high';
  if (spread <= LOW_SPREAD) return 'medium';
  return 'low';
}

/**
 * Per-date sun-score agreement across independent forecast models. Dates are
 * taken from the first model and matched by string in the others, so a model
 * with missing days simply doesn't vote for those dates.
 */
export function modelConsensus(
  models: ModelForecast[],
  prefs: ComfortPrefs = DEFAULT_COMFORT,
): DayConsensus[] {
  const [reference, ...rest] = models.filter((m) => m.days.length > 0);
  if (!reference) return [];

  return reference.days.map((refDay) => {
    const scores: ModelScore[] = [
      { model: reference.model, label: reference.label, score: scoreDay(refDay, prefs) },
    ];
    for (const other of rest) {
      const match = other.days.find((d) => d.date === refDay.date);
      if (match) scores.push({ model: other.model, label: other.label, score: scoreDay(match, prefs) });
    }
    const values = scores.map((s) => s.score);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { date: refDay.date, scores, min, max, spread: max - min, level: levelForSpread(max - min) };
  });
}
