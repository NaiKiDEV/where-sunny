import type { AirportMeta, LatLon, Place } from '../types';

/**
 * A bundled airport from the OurAirports dataset (Public Domain). Kept to
 * scheduled-service large + medium airports - the places you'd actually fly to.
 */
export interface Airport extends LatLon, AirportMeta {
  /** Namespaced unique key `a{icao|iata}` - matches the key {@link airportToPlace} emits. */
  key: string;
  name: string;
  /** ISO 3166-1 alpha-2 country code (e.g. `DE`). */
  country: string;
  /** Metres above sea level (converted from OurAirports feet). Undefined when unknown. */
  elevation?: number;
}

/**
 * Adapt an airport into a {@link Place} so it flows through the same preview →
 * forecast → detail machinery as any city or pin. Airports carry no population;
 * elevation rides the standard `Place.elevation`, while codes, links, and
 * runway facts live on `place.airport`.
 */
export function airportToPlace(airport: Airport): Place {
  const { key, name, country, lat, lon, elevation } = airport;
  const { iata, icao, region, municipality, home, wiki, large, runways, longestRunwayM } = airport;
  const place: Place = {
    key,
    kind: 'airport',
    name,
    country,
    lat,
    lon,
    population: 0,
    airport: { iata, icao, region, municipality, home, wiki, large, runways, longestRunwayM },
  };
  if (elevation !== undefined) place.elevation = elevation;
  return place;
}
