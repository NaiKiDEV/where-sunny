import { isBannedCountryCode, isBannedCountryName } from '../bannedCountries';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const MIN_QUERY_LENGTH = 2;

export interface GeoMatch {
  id: number;
  name: string;
  country: string;
  /** ISO 3166-1 alpha-2 code, uppercased (undefined if the API omits it). */
  countryCode?: string;
  admin1?: string;
  lat: number;
  lon: number;
  population?: number;
  elevation?: number;
}

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  population?: number;
  elevation?: number;
}

export async function searchPlaces(
  query: string,
  options: { count?: number; fetchImpl?: typeof fetch } = {},
): Promise<GeoMatch[]> {
  const { count = 8, fetchImpl = fetch } = options;
  const name = query.trim();
  if (name.length < MIN_QUERY_LENGTH) return [];

  const params = new URLSearchParams({ name, count: String(count), language: 'en', format: 'json' });
  const res = await fetchImpl(`${GEOCODING_URL}?${params}`);
  if (!res.ok) throw new Error(`Geocoding request failed: HTTP ${res.status}`);

  const json = (await res.json()) as { results?: GeocodingResult[] };
  return (json.results ?? [])
    .map(
      (r): GeoMatch => ({
        id: r.id,
        name: r.name,
        country: r.country ?? r.country_code ?? '',
        countryCode: r.country_code?.toUpperCase(),
        admin1: r.admin1,
        lat: r.latitude,
        lon: r.longitude,
        population: r.population,
        elevation: Number.isFinite(r.elevation) ? r.elevation : undefined,
      }),
    )
    // Never surface a banned country, whatever the upstream API returns.
    .filter((m) => !isBannedCountryCode(m.countryCode) && !isBannedCountryName(m.country));
}
