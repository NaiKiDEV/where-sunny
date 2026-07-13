import { describe, expect, it } from 'vitest';
import { searchPlaces } from './geocoding';

function fakeFetch(results: unknown[]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('searchPlaces', () => {
  it('drops results from banned countries and keeps allowed ones', async () => {
    const fetchImpl = fakeFetch([
      { id: 1, name: 'Vilnius', country: 'Lithuania', country_code: 'lt', latitude: 54.687, longitude: 25.28 },
      { id: 2, name: 'Moscow', country: 'Russia', country_code: 'RU', latitude: 55.75, longitude: 37.62 },
      { id: 3, name: 'Minsk', country: 'Belarus', country_code: 'BY', latitude: 53.9, longitude: 27.57 },
      { id: 4, name: 'Riga', country: 'Latvia', country_code: 'lv', latitude: 56.95, longitude: 24.11 },
    ]);

    const matches = await searchPlaces('city', { fetchImpl });

    expect(matches.map((m) => m.name)).toEqual(['Vilnius', 'Riga']);
    expect(matches.some((m) => m.country === 'Russia' || m.country === 'Belarus')).toBe(false);
    expect(matches.some((m) => m.countryCode === 'RU' || m.countryCode === 'BY')).toBe(false);
  });

  it('populates countryCode as an uppercased alpha-2 code', async () => {
    const fetchImpl = fakeFetch([
      { id: 1, name: 'Vilnius', country: 'Lithuania', country_code: 'lt', latitude: 54.687, longitude: 25.28 },
    ]);

    const [match] = await searchPlaces('vil', { fetchImpl });

    expect(match.countryCode).toBe('LT');
    expect(match.country).toBe('Lithuania');
  });
});
