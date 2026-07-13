import type { Airport } from './types';

const DEFAULT_LIMIT = 8;

// Lower rank = better match. Exact code beats prefix beats name/city substring,
// so typing a code you know ("FRA") surfaces that airport first even though the
// letters also appear inside many airport names.
const RANK = {
  iataExact: 0,
  icaoExact: 1,
  iataPrefix: 2,
  icaoPrefix: 3,
  nameSubstring: 4,
  citySubstring: 5,
  miss: Infinity,
} as const;

function rank(airport: Airport, upper: string, lower: string): number {
  const iata = airport.iata.toUpperCase();
  const icao = airport.icao.toUpperCase();
  if (iata && iata === upper) return RANK.iataExact;
  if (icao && icao === upper) return RANK.icaoExact;
  if (iata && iata.startsWith(upper)) return RANK.iataPrefix;
  if (icao && icao.startsWith(upper)) return RANK.icaoPrefix;
  if (airport.name.toLowerCase().includes(lower)) return RANK.nameSubstring;
  if (airport.municipality.toLowerCase().includes(lower)) return RANK.citySubstring;
  return RANK.miss;
}

/**
 * Search bundled airports by IATA/ICAO code, name, or served city. Results are
 * ordered by match quality, then large airports first, then alphabetically.
 * Pure and synchronous - the whole dataset is in memory.
 */
export function searchAirports(
  query: string,
  airports: Airport[],
  limit = DEFAULT_LIMIT,
): Airport[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  const scored: { airport: Airport; rank: number }[] = [];
  for (const airport of airports) {
    const r = rank(airport, upper, lower);
    if (r !== RANK.miss) scored.push({ airport, rank: r });
  }
  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(b.airport.large) - Number(a.airport.large) ||
      a.airport.name.localeCompare(b.airport.name),
  );
  return scored.slice(0, limit).map((s) => s.airport);
}
