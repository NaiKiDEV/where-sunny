import { describe, expect, it } from 'vitest';
import type { DayForecast } from '../types';
import { explainScore } from './explain';
import { scoreDay } from './score';

function day(overrides: Partial<DayForecast> = {}): DayForecast {
  return {
    date: '2026-07-11',
    sunshineDuration: 40_000,
    daylightDuration: 50_000,
    cloudCoverMean: 20,
    precipProbMax: 10,
    tempMax: 22,
    tempMin: 14,
    weatherCode: 1,
    ...overrides,
  };
}

function partsSum(breakdown: ReturnType<typeof explainScore>): number {
  return breakdown.parts.reduce((sum, p) => sum + p.points, 0);
}

describe('explainScore', () => {
  it('parts sum to exactly 100 on a perfect day', () => {
    const breakdown = explainScore(
      day({ sunshineDuration: 50_000, cloudCoverMean: 0, precipProbMax: 0, tempMax: 22 }),
    );
    expect(breakdown.score).toBe(100);
    expect(partsSum(breakdown)).toBe(100);
    expect(breakdown.isCapped).toBe(false);
  });

  it('parts sum to the displayed score across a grid of ordinary days', () => {
    for (let sun = 0; sun <= 50_000; sun += 12_500) {
      for (let rain = 0; rain <= 80; rain += 20) {
        for (const temp of [5, 18, 30, 40]) {
          const d = day({ sunshineDuration: sun, precipProbMax: rain, tempMax: temp });
          const breakdown = explainScore(d);
          if (!breakdown.isCapped) {
            expect(partsSum(breakdown)).toBe(scoreDay(d));
          }
        }
      }
    }
  });

  it('flags capped days instead of pretending parts sum to zero', () => {
    const miserable = day({
      sunshineDuration: 0,
      cloudCoverMean: 100,
      precipProbMax: 100,
      tempMax: -5,
    });
    const breakdown = explainScore(miserable);
    expect(breakdown.score).toBe(0);
    expect(breakdown.isCapped).toBe(true);
    expect(breakdown.raw).toBeLessThan(0);
  });

  it('penalty parts are never positive and gain parts never negative', () => {
    const breakdown = explainScore(day({ precipProbMax: 60, cloudCoverMean: 70 }));
    const byId = Object.fromEntries(breakdown.parts.map((p) => [p.id, p]));
    expect(byId.sun.points).toBeGreaterThanOrEqual(0);
    expect(byId.warmth.points).toBeGreaterThanOrEqual(0);
    expect(byId.cloud.points).toBeLessThanOrEqual(0);
    expect(byId.rain.points).toBeLessThanOrEqual(0);
  });

  it('omits the wind part when the forecast has no wind data', () => {
    const breakdown = explainScore(day());
    expect(breakdown.parts.some((p) => p.id === 'wind')).toBe(false);
    expect(breakdown.parts).toHaveLength(4);
  });

  it('adds a non-positive wind part and still sums to the score when wind is present', () => {
    const d = day({ windMax: 60, sunshineDuration: 30_000, precipProbMax: 20 });
    const breakdown = explainScore(d);
    const wind = breakdown.parts.find((p) => p.id === 'wind');
    expect(wind).toBeDefined();
    expect(wind!.points).toBeLessThanOrEqual(0);
    if (!breakdown.isCapped) expect(partsSum(breakdown)).toBe(scoreDay(d));
  });

  it('respects comfort prefs in the warmth part', () => {
    const cold = explainScore(day({ tempMax: 12 }), { idealMin: 18, idealMax: 26 });
    const fine = explainScore(day({ tempMax: 12 }), { idealMin: 10, idealMax: 22 });
    const coldWarmth = cold.parts.find((p) => p.id === 'warmth')!.points;
    const fineWarmth = fine.parts.find((p) => p.id === 'warmth')!.points;
    expect(fineWarmth).toBeGreaterThan(coldWarmth);
  });
});
