import { describe, expect, it } from 'vitest';
import type { Place } from '../types';
import { selectCandidates } from './filter';
import type { TierConfig } from './tiers';
import { TRAVEL_TIERS } from './tiers';

const ORIGIN = { lat: 54.687, lon: 25.28 }; // Vilnius

// sorted by population desc, as the dataset guarantees
const CITIES: Place[] = [
  { key: 'c0', kind: 'city', name: 'Warsaw', country: 'PL', lat: 52.23, lon: 21.01, population: 1_700_000 },
  { key: 'c1', kind: 'city', name: 'Minsk', country: 'BY', lat: 53.9, lon: 27.57, population: 800_000 },
  { key: 'c2', kind: 'city', name: 'Riga', country: 'LV', lat: 56.95, lon: 24.11, population: 600_000 },
  { key: 'c3', kind: 'city', name: 'Kaunas', country: 'LT', lat: 54.897, lon: 23.89, population: 300_000 },
  { key: 'c4', kind: 'city', name: 'Trakai', country: 'LT', lat: 54.638, lon: 24.934, population: 4_500 },
];

describe('selectCandidates', () => {
  it('nearby tier keeps only places within 50 km', () => {
    const result = selectCandidates(CITIES, ORIGIN, TRAVEL_TIERS.nearby);
    expect(result.map((c) => c.place.name)).toEqual(['Trakai']);
    expect(result[0].distanceKm).toBeGreaterThan(0);
    expect(result[0].distanceKm).toBeLessThan(50);
  });

  it('day tier applies both radius and population floor', () => {
    const result = selectCandidates(CITIES, ORIGIN, TRAVEL_TIERS.day);
    // Warsaw ~390 km (too far), Minsk banned (BY), Trakai pop < 5000 (too small)
    expect(result.map((c) => c.place.name)).toEqual(['Riga', 'Kaunas']);
  });

  it('never yields a candidate in a banned country', () => {
    // Minsk (BY) is in range and above the floor, yet must be excluded.
    const result = selectCandidates(CITIES, ORIGIN, TRAVEL_TIERS.day);
    expect(result.some((c) => c.place.name === 'Minsk')).toBe(false);
    expect(result.some((c) => c.place.country === 'BY')).toBe(false);
  });

  it('respects the candidate cap, keeping the biggest places', () => {
    const tinyCap: TierConfig = { ...TRAVEL_TIERS.getaway, maxCandidates: 1 };
    const result = selectCandidates(CITIES, ORIGIN, tinyCap);
    expect(result.map((c) => c.place.name)).toEqual(['Warsaw']);
  });

  it('handles the antimeridian in the bounding-box prefilter', () => {
    const fiji: Place[] = [
      { key: 'c0', kind: 'city', name: 'AcrossTheLine', country: 'FJ', lat: -17.7, lon: -179.5, population: 80_000 },
    ];
    const origin = { lat: -17.7, lon: 179.5 };
    const tier: TierConfig = { id: 'day', label: 'Day trip', radiusKm: 300, minPopulation: 0, maxCandidates: 10 };
    const result = selectCandidates(fiji, origin, tier);
    expect(result).toHaveLength(1);
    expect(result[0].distanceKm).toBeLessThan(150);
  });
});
