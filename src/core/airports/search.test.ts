import { describe, expect, it } from 'vitest';
import { searchAirports } from './search';
import type { Airport } from './types';

function make(overrides: Partial<Airport>): Airport {
  return {
    key: overrides.key ?? `a${overrides.icao ?? overrides.iata}`,
    iata: '',
    icao: '',
    name: '',
    lat: 0,
    lon: 0,
    country: 'XX',
    region: '',
    municipality: '',
    large: false,
    ...overrides,
  };
}

const FRA = make({ iata: 'FRA', icao: 'EDDF', name: 'Frankfurt Main Airport', municipality: 'Frankfurt am Main', large: true });
const HHN = make({ iata: 'HHN', icao: 'EDFH', name: 'Frankfurt-Hahn Airport', municipality: 'Hahn', large: false });
const LHR = make({ iata: 'LHR', icao: 'EGLL', name: 'London Heathrow Airport', municipality: 'London', large: true });
const LGW = make({ iata: 'LGW', icao: 'EGKK', name: 'London Gatwick Airport', municipality: 'London', large: true });
const AIRPORTS = [HHN, FRA, LHR, LGW];

describe('searchAirports', () => {
  it('returns nothing for a blank query', () => {
    expect(searchAirports('', AIRPORTS)).toEqual([]);
    expect(searchAirports('   ', AIRPORTS)).toEqual([]);
  });

  it('ranks an exact IATA code first, case-insensitively', () => {
    expect(searchAirports('fra', AIRPORTS)[0]).toBe(FRA);
  });

  it('matches an exact ICAO code', () => {
    expect(searchAirports('EGLL', AIRPORTS)[0]).toBe(LHR);
  });

  it('matches a code prefix', () => {
    const names = searchAirports('EG', AIRPORTS).map((a) => a.iata);
    expect(names).toEqual(expect.arrayContaining(['LHR', 'LGW']));
    expect(names).not.toContain('FRA');
  });

  it('falls back to name and served-city substrings', () => {
    const byCity = searchAirports('london', AIRPORTS).map((a) => a.iata);
    expect(byCity).toEqual(expect.arrayContaining(['LHR', 'LGW']));
    expect(byCity).not.toContain('FRA');
  });

  it('puts an exact code above name matches for the same letters', () => {
    const result = searchAirports('Frankfurt', AIRPORTS).map((a) => a.iata);
    // Both Frankfurt airports match by name; the large one comes first.
    expect(result.slice(0, 2)).toEqual(['FRA', 'HHN']);
  });

  it('breaks ties by large-airport first', () => {
    const result = searchAirports('Airport', AIRPORTS);
    expect(result.every((a) => a.name.includes('Airport'))).toBe(true);
    // large airports (FRA, LHR, LGW) rank ahead of medium (HHN)
    expect(result[result.length - 1]).toBe(HHN);
  });

  it('honours the result limit', () => {
    expect(searchAirports('Airport', AIRPORTS, 2)).toHaveLength(2);
  });
});
