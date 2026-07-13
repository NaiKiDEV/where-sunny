import { isBannedPlace } from '../bannedCountries';
import { haversineKm } from '../geo';
import type { Candidate, LatLon, Place } from '../types';
import type { TierConfig } from './tiers';

const KM_PER_DEG_LAT = 111.32;

/**
 * Pick the places to score for a tier: within radius, above the population
 * floor, capped at maxCandidates.
 *
 * Precondition: `cities` is sorted by population descending (the dataset is
 * built that way), so the cap keeps the most significant places.
 */
export function selectCandidates(cities: Place[], origin: LatLon, tier: TierConfig): Candidate[] {
  const latDelta = tier.radiusKm / KM_PER_DEG_LAT;
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const lonDelta = cosLat > 0.01 ? tier.radiusKm / (KM_PER_DEG_LAT * cosLat) : 360;

  const within: Candidate[] = [];
  for (const place of cities) {
    // Belt-and-suspenders: even an unfiltered list can never yield a banned place.
    if (isBannedPlace(place)) continue;
    if (place.population < tier.minPopulation) continue;
    // cheap bounding-box reject (antimeridian-aware) before the exact distance
    if (Math.abs(place.lat - origin.lat) > latDelta) continue;
    const lonDiff = Math.abs(place.lon - origin.lon);
    if (Math.min(lonDiff, 360 - lonDiff) > lonDelta) continue;

    const distanceKm = haversineKm(origin, place);
    if (distanceKm > tier.radiusKm) continue;

    within.push({ place, distanceKm });
    if (within.length >= tier.maxCandidates) break;
  }
  return within;
}
