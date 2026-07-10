import type { TierId } from '../types';

export interface TierConfig {
  id: TierId;
  label: string;
  radiusKm: number;
  minPopulation: number;
  maxCandidates: number;
}

export const TRAVEL_TIERS: Record<TierId, TierConfig> = {
  nearby: { id: 'nearby', label: 'Nearby', radiusKm: 50, minPopulation: 0, maxCandidates: 60 },
  day: { id: 'day', label: 'Day trip', radiusKm: 300, minPopulation: 5000, maxCandidates: 220 },
  getaway: { id: 'getaway', label: 'Getaway', radiusKm: 1000, minPopulation: 20000, maxCandidates: 300 },
  flight: { id: 'flight', label: 'Flight', radiusKm: 3000, minPopulation: 100000, maxCandidates: 300 },
};

export const TIER_ORDER: TierId[] = ['nearby', 'day', 'getaway', 'flight'];
