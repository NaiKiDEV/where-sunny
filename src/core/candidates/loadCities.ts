import type { Place } from '../types';

// v1: [name, country, lat, lon, population]; v2 appends elevation (metres).
type CityRow = [
  name: string,
  country: string,
  lat: number,
  lon: number,
  population: number,
  elevation?: number,
];

interface CityDataset {
  v: number;
  count: number;
  rows: CityRow[];
}

function isCityDataset(value: unknown): value is CityDataset {
  if (typeof value !== 'object' || value === null) return false;
  const dataset = value as Partial<CityDataset>;
  return typeof dataset.v === 'number' && dataset.v >= 1 && Array.isArray(dataset.rows);
}

export function parseCityDataset(json: unknown): Place[] {
  if (!isCityDataset(json)) {
    throw new Error('Invalid city dataset - regenerate with `pnpm setup:data`');
  }
  const places: Place[] = [];
  for (let i = 0; i < json.rows.length; i++) {
    const [name, country, lat, lon, population, elevation] = json.rows[i];
    if (typeof name !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const place: Place = { key: `c${i}`, kind: 'city', name, country, lat, lon, population };
    if (typeof elevation === 'number' && Number.isFinite(elevation)) place.elevation = elevation;
    places.push(place);
  }
  return places;
}

export async function fetchCities(
  url = `${import.meta.env.BASE_URL}data/cities.json`,
  fetchImpl: typeof fetch = fetch,
): Promise<Place[]> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Failed to load city data: HTTP ${res.status}`);
  return parseCityDataset(await res.json());
}
