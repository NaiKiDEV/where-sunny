import { isBannedCountryCode } from '../bannedCountries';
import type { Airport } from './types';

// Row format from scripts/build-airports.mjs (v2):
// [iata, icao, name, lat, lon, countryCode, region, municipality, home, wiki,
//  size, elevationM, runwayCount, longestRunwayM]
type AirportRow = [
  iata: string,
  icao: string,
  name: string,
  lat: number,
  lon: number,
  country: string,
  region: string,
  municipality: string,
  home: string,
  wiki: string,
  size: number,
  elevationM?: number | null,
  runwayCount?: number,
  longestRunwayM?: number,
];

interface AirportDataset {
  v: number;
  count: number;
  rows: AirportRow[];
}

function isAirportDataset(value: unknown): value is AirportDataset {
  if (typeof value !== 'object' || value === null) return false;
  const dataset = value as Partial<AirportDataset>;
  return typeof dataset.v === 'number' && dataset.v >= 1 && Array.isArray(dataset.rows);
}

export function parseAirportDataset(json: unknown): Airport[] {
  if (!isAirportDataset(json)) {
    throw new Error('Invalid airport dataset - regenerate with `pnpm setup:data`');
  }
  const airports: Airport[] = [];
  for (const row of json.rows) {
    const [iata, icao, name, lat, lon, country, region, municipality, home, wiki, size] = row;
    const [, , , , , , , , , , , elevationM, runwayCount, longestRunwayM] = row;
    if (typeof name !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = icao || iata;
    if (!id) continue;
    // Same belt-and-suspenders as candidate selection: a banned airport never
    // reaches the map, search, or a preview even if it survived the build.
    if (isBannedCountryCode(country)) continue;
    const airport: Airport = {
      key: `a${id}`,
      iata: iata ?? '',
      icao: icao ?? '',
      name,
      lat,
      lon,
      country: country ?? '',
      region: region ?? '',
      municipality: municipality ?? '',
      home: home || undefined,
      wiki: wiki || undefined,
      large: size === 1,
    };
    if (typeof elevationM === 'number' && Number.isFinite(elevationM)) airport.elevation = elevationM;
    if (typeof runwayCount === 'number' && runwayCount > 0) airport.runways = runwayCount;
    if (typeof longestRunwayM === 'number' && longestRunwayM > 0) airport.longestRunwayM = longestRunwayM;
    airports.push(airport);
  }
  return airports;
}

export async function fetchAirports(
  url = `${import.meta.env.BASE_URL}data/airports.json`,
  fetchImpl: typeof fetch = fetch,
): Promise<Airport[]> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Failed to load airport data: HTTP ${res.status}`);
  return parseAirportDataset(await res.json());
}
