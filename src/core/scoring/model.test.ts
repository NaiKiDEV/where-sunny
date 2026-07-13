import { describe, expect, it } from 'vitest';
import type { ScorePartId } from './explain';
import { SCORE_FACTORS, SCORE_NORM } from './model';
import { SCORE_WEIGHTS } from './score';

describe('SCORE_FACTORS', () => {
  it('describes every scored factor exactly once', () => {
    const ids = SCORE_FACTORS.map((f) => f.id).sort();
    const expected: ScorePartId[] = ['cloud', 'rain', 'sun', 'warmth', 'wind'];
    expect(ids).toEqual(expected);
  });

  it('marks sunshine and warmth as boosts and the rest as penalties', () => {
    const byId = Object.fromEntries(SCORE_FACTORS.map((f) => [f.id, f.direction]));
    expect(byId.sun).toBe('boost');
    expect(byId.warmth).toBe('boost');
    expect(byId.cloud).toBe('penalty');
    expect(byId.rain).toBe('penalty');
    expect(byId.wind).toBe('penalty');
  });

  it('is ordered strongest lever first', () => {
    const influences = SCORE_FACTORS.map((f) => f.influence);
    const descending = [...influences].sort((a, b) => b - a);
    expect(influences).toEqual(descending);
  });

  // The whole point of the explainer is honesty: each factor's influence must be
  // the actual weight the scorer uses, or the "how it works" screen would lie.
  it('derives every influence from SCORE_WEIGHTS, not a hardcoded copy', () => {
    const weightOf: Record<ScorePartId, number> = {
      sun: SCORE_WEIGHTS.sun,
      warmth: SCORE_WEIGHTS.temp,
      cloud: SCORE_WEIGHTS.cloud,
      rain: SCORE_WEIGHTS.rain,
      wind: SCORE_WEIGHTS.wind,
    };
    for (const factor of SCORE_FACTORS) {
      expect(factor.influence).toBe(Math.round((weightOf[factor.id] / SCORE_NORM) * 100));
    }
  });

  it('lets the two boosts reach a perfect 100 on a flawless day', () => {
    const boostShare = SCORE_FACTORS.filter((f) => f.direction === 'boost').reduce(
      (sum, f) => sum + weightById(f.id) / SCORE_NORM,
      0,
    );
    expect(boostShare * 100).toBeCloseTo(100);
  });
});

function weightById(id: ScorePartId): number {
  switch (id) {
    case 'sun':
      return SCORE_WEIGHTS.sun;
    case 'warmth':
      return SCORE_WEIGHTS.temp;
    case 'cloud':
      return SCORE_WEIGHTS.cloud;
    case 'rain':
      return SCORE_WEIGHTS.rain;
    case 'wind':
      return SCORE_WEIGHTS.wind;
  }
}
