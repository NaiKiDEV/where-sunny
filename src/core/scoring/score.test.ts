import { describe, expect, it } from 'vitest';
import type { DayForecast } from '../types';
import { scoreDay, temperatureComfort } from './score';

function day(overrides: Partial<DayForecast> = {}): DayForecast {
  return {
    date: '2026-07-10',
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

describe('temperatureComfort', () => {
  it('is 1 across the 18–26 °C plateau', () => {
    expect(temperatureComfort(18)).toBe(1);
    expect(temperatureComfort(22)).toBe(1);
    expect(temperatureComfort(26)).toBe(1);
  });

  it('falls to 0 at the cold and hot limits', () => {
    expect(temperatureComfort(0)).toBe(0);
    expect(temperatureComfort(-10)).toBe(0);
    expect(temperatureComfort(38)).toBe(0);
    expect(temperatureComfort(45)).toBe(0);
  });

  it('is halfway between limit and plateau at the midpoint', () => {
    expect(temperatureComfort(9)).toBeCloseTo(0.5, 5);
    expect(temperatureComfort(32)).toBeCloseTo(0.5, 5);
  });
});

describe('scoreDay', () => {
  it('gives a perfect day 100', () => {
    const perfect = day({
      sunshineDuration: 50_000,
      daylightDuration: 50_000,
      cloudCoverMean: 0,
      precipProbMax: 0,
      tempMax: 22,
    });
    expect(scoreDay(perfect)).toBe(100);
  });

  it('gives a fully overcast rainy day 0', () => {
    const miserable = day({
      sunshineDuration: 0,
      cloudCoverMean: 100,
      precipProbMax: 100,
      tempMax: 8,
    });
    expect(scoreDay(miserable)).toBe(0);
  });

  it('rewards more sunshine, all else equal', () => {
    const cloudy = scoreDay(day({ sunshineDuration: 10_000 }));
    const sunny = scoreDay(day({ sunshineDuration: 45_000 }));
    expect(sunny).toBeGreaterThan(cloudy);
  });

  it('penalizes rain probability', () => {
    const dry = scoreDay(day({ precipProbMax: 0 }));
    const wet = scoreDay(day({ precipProbMax: 80 }));
    expect(dry).toBeGreaterThan(wet);
  });

  it('penalizes uncomfortable temperatures', () => {
    const mild = scoreDay(day({ tempMax: 22 }));
    const freezing = scoreDay(day({ tempMax: -5 }));
    const scorching = scoreDay(day({ tempMax: 41 }));
    expect(mild).toBeGreaterThan(freezing);
    expect(mild).toBeGreaterThan(scorching);
  });

  it('handles zero daylight (polar night) without NaN', () => {
    const polar = day({ daylightDuration: 0, sunshineDuration: 0 });
    const score = scoreDay(polar);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('stays within 0–100', () => {
    for (let cloud = 0; cloud <= 100; cloud += 25) {
      for (let rain = 0; rain <= 100; rain += 25) {
        const score = scoreDay(day({ cloudCoverMean: cloud, precipProbMax: rain }));
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});
