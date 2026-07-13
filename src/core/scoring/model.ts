import type { ScorePartId } from './explain';
import { SCORE_WEIGHTS } from './score';

/**
 * The positive weights (sunshine + temperature) normalise the whole formula, so
 * a flawless day - full sun, ideal warmth, no penalties - lands on exactly 100.
 */
export const SCORE_NORM = SCORE_WEIGHTS.sun + SCORE_WEIGHTS.temp;

export type FactorDirection = 'boost' | 'penalty';

export interface ScoreFactor {
  id: ScorePartId;
  direction: FactorDirection;
  /** The most points this factor can move the 0-100 score, as a magnitude. */
  influence: number;
  /** One plain sentence on what it measures and why it matters. */
  blurb: string;
}

/** Points a factor is worth on the 0-100 scale: its weight relative to NORM. */
function influenceOf(weight: number): number {
  return Math.round((weight / SCORE_NORM) * 100);
}

/**
 * Copy for each factor, keyed by the breakdown's part id. `weight` points back
 * at the exact SCORE_WEIGHTS entry that drives it (note 'warmth' reads the
 * `temp` weight) so the numbers shown to users are the numbers the code uses.
 */
const FACTOR_COPY: Record<ScorePartId, { direction: FactorDirection; weight: number; blurb: string }> = {
  sun: {
    direction: 'boost',
    weight: SCORE_WEIGHTS.sun,
    blurb:
      'Hours of real sunshine measured against the daylight the day actually offers, so a short winter day and a long summer one are judged fairly.',
  },
  warmth: {
    direction: 'boost',
    weight: SCORE_WEIGHTS.temp,
    blurb:
      'How close the feels-like high sits to your comfortable-temperature band. You choose the band in Settings.',
  },
  rain: {
    direction: 'penalty',
    weight: SCORE_WEIGHTS.rain,
    blurb: "The day's highest chance of rain - the single biggest thing that can sink a score.",
  },
  wind: {
    direction: 'penalty',
    weight: SCORE_WEIGHTS.wind,
    blurb: 'Whether the day stays calm or turns blustery. Only a genuinely stiff wind costs much.',
  },
  cloud: {
    direction: 'penalty',
    weight: SCORE_WEIGHTS.cloud,
    blurb: 'Average cloud cover across the day - a gentle nudge on top of the sunshine reading.',
  },
};

/**
 * A plain-language, transparent description of the exact scoreDay formula.
 * Every figure is derived from SCORE_WEIGHTS and the list is sorted by influence,
 * so the explainer can never drift from the code that computes the score.
 */
export const SCORE_FACTORS: ScoreFactor[] = (Object.keys(FACTOR_COPY) as ScorePartId[])
  .map((id) => ({
    id,
    direction: FACTOR_COPY[id].direction,
    influence: influenceOf(FACTOR_COPY[id].weight),
    blurb: FACTOR_COPY[id].blurb,
  }))
  .sort((a, b) => b.influence - a.influence);
