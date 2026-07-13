import { haversineKm } from '../geo';
import type { LatLon } from '../types';
import type { Airport } from './types';

/** Beyond this, an airport stops being a sane default for "your" airport. */
export const MAX_FLIGHT_AIRPORT_KM = 300;

export interface AirportDistance {
  airport: Airport;
  distanceKm: number;
}

/**
 * The nearest airport usable for flight deep-links: it must carry an IATA code
 * (Skyscanner/Kayak require one) and sit within `maxKm`. Purely a default -
 * the UI lets the user override it by searching, since the closest airport
 * isn't always the one you'd actually fly from.
 */
export function nearestFlightAirport(
  from: LatLon,
  airports: Airport[],
  maxKm = MAX_FLIGHT_AIRPORT_KM,
): AirportDistance | null {
  let best: AirportDistance | null = null;
  for (const airport of airports) {
    if (!airport.iata) continue;
    const distanceKm = haversineKm(from, airport);
    if (distanceKm > maxKm) continue;
    if (!best || distanceKm < best.distanceKm) best = { airport, distanceKm };
  }
  return best;
}
