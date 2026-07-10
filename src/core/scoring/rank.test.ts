import { describe, expect, it } from 'vitest';
import type { Candidate, DayForecast } from '../types';
import { rankPlaces, scorePlace } from './rank';

function candidate(id: number, name: string, distanceKm: number): Candidate {
  return {
    place: { key: `c${id}`, kind: 'city' as const, name, country: 'LT', lat: 55, lon: 24, population: 10_000 },
    distanceKm,
  };
}

function forecastDay(date: string, sunshineRatio: number): DayForecast {
  return {
    date,
    sunshineDuration: sunshineRatio * 50_000,
    daylightDuration: 50_000,
    cloudCoverMean: (1 - sunshineRatio) * 100,
    precipProbMax: 0,
    tempMax: 22,
    tempMin: 14,
    weatherCode: 1,
  };
}

const WEEKEND = ['2026-07-11', '2026-07-12'];

describe('scorePlace', () => {
  it('picks the best day within the window and reports its date', () => {
    const forecast = [
      forecastDay('2026-07-10', 1), // outside window — must be ignored
      forecastDay('2026-07-11', 0.3),
      forecastDay('2026-07-12', 0.9),
    ];
    const scored = scorePlace(candidate(1, 'Nida', 120), forecast, WEEKEND);
    expect(scored).not.toBeNull();
    expect(scored!.best.date).toBe('2026-07-12');
    expect(scored!.windowDays).toHaveLength(2);
    expect(scored!.days).toHaveLength(3);
  });

  it('returns null when no forecast days fall inside the window', () => {
    const forecast = [forecastDay('2026-07-01', 1)];
    expect(scorePlace(candidate(1, 'Nida', 120), forecast, WEEKEND)).toBeNull();
    expect(scorePlace(candidate(1, 'Nida', 120), undefined, WEEKEND)).toBeNull();
  });
});

describe('rankPlaces', () => {
  it('orders by best-day score descending', () => {
    const candidates = [candidate(1, 'Cloudy', 50), candidate(2, 'Sunny', 200)];
    const forecasts = [
      [forecastDay('2026-07-11', 0.2)],
      [forecastDay('2026-07-11', 0.95)],
    ];
    const ranked = rankPlaces(candidates, forecasts, WEEKEND);
    expect(ranked.map((r) => r.place.name)).toEqual(['Sunny', 'Cloudy']);
  });

  it('breaks score ties by distance, closer first', () => {
    const candidates = [candidate(1, 'Far', 400), candidate(2, 'Near', 40)];
    const forecasts = [
      [forecastDay('2026-07-11', 0.8)],
      [forecastDay('2026-07-11', 0.8)],
    ];
    const ranked = rankPlaces(candidates, forecasts, WEEKEND);
    expect(ranked.map((r) => r.place.name)).toEqual(['Near', 'Far']);
  });

  it('drops candidates with no usable forecast', () => {
    const candidates = [candidate(1, 'HasData', 50), candidate(2, 'NoData', 60)];
    const forecasts: DayForecast[][] = [[forecastDay('2026-07-11', 0.5)], []];
    const ranked = rankPlaces(candidates, forecasts, WEEKEND);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].place.name).toBe('HasData');
  });
});
