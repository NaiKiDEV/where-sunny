import { describe, expect, it } from 'vitest';
import { parseAirportDataset } from './loadAirports';
import { airportToPlace } from './types';

const frankfurt = ['FRA', 'EDDF', 'Frankfurt Main Airport', 50.0264, 8.5431, 'DE', 'DE-HE', 'Frankfurt am Main', 'https://www.frankfurt-airport.de/', 'https://en.wikipedia.org/wiki/Frankfurt_Airport', 1];

describe('parseAirportDataset', () => {
  it('maps a row to an airport keyed by ICAO', () => {
    const [airport] = parseAirportDataset({ v: 1, count: 1, rows: [frankfurt] });
    expect(airport).toEqual({
      key: 'aEDDF',
      iata: 'FRA',
      icao: 'EDDF',
      name: 'Frankfurt Main Airport',
      lat: 50.0264,
      lon: 8.5431,
      country: 'DE',
      region: 'DE-HE',
      municipality: 'Frankfurt am Main',
      home: 'https://www.frankfurt-airport.de/',
      wiki: 'https://en.wikipedia.org/wiki/Frankfurt_Airport',
      large: true,
    });
  });

  it('keys by IATA when ICAO is missing', () => {
    const [airport] = parseAirportDataset({
      v: 1,
      count: 1,
      rows: [['XXX', '', 'No ICAO Field', 1, 2, 'US', 'US-CA', 'Nowhere', '', '', 0]],
    });
    expect(airport.key).toBe('aXXX');
    expect(airport.large).toBe(false);
  });

  it('turns empty URL fields into undefined', () => {
    const [airport] = parseAirportDataset({
      v: 1,
      count: 1,
      rows: [['ABC', 'AAAA', 'No Links', 1, 2, 'US', 'US-CA', 'Town', '', '', 1]],
    });
    expect(airport.home).toBeUndefined();
    expect(airport.wiki).toBeUndefined();
  });

  it('skips rows with no code and rows with bad coordinates', () => {
    const airports = parseAirportDataset({
      v: 1,
      count: 3,
      rows: [
        frankfurt,
        ['', '', 'No Codes', 1, 2, 'US', 'US-CA', 'X', '', '', 0],
        ['BAD', 'BADD', 'Bad Coords', Number.NaN, 2, 'US', 'US-CA', 'X', '', '', 0],
      ],
    });
    expect(airports.map((a) => a.key)).toEqual(['aEDDF']);
  });

  it('skips airports in banned countries', () => {
    const airports = parseAirportDataset({
      v: 1,
      count: 3,
      rows: [
        frankfurt,
        ['SVO', 'UUEE', 'Sheremetyevo', 55.97, 37.41, 'RU', 'RU-MOS', 'Moscow', '', '', 1],
        ['MSQ', 'UMMS', 'Minsk National', 53.88, 28.03, 'BY', 'BY-MI', 'Minsk', '', '', 1],
      ],
    });
    expect(airports.map((a) => a.country)).toEqual(['DE']);
  });

  it('throws on an unrecognized dataset shape', () => {
    expect(() => parseAirportDataset({ nope: true })).toThrow(/Invalid airport dataset/);
    expect(() => parseAirportDataset(null)).toThrow(/Invalid airport dataset/);
  });

  it('reads elevation, runway count, and longest runway from v2 rows', () => {
    const [airport] = parseAirportDataset({
      v: 2,
      count: 1,
      rows: [['LHR', 'EGLL', 'Heathrow', 51.47, -0.4614, 'GB', 'GB-ENG', 'London', '', '', 1, 25, 2, 3902]],
    });
    expect(airport.elevation).toBe(25);
    expect(airport.runways).toBe(2);
    expect(airport.longestRunwayM).toBe(3902);
  });

  it('omits elevation when null and runway fields when zero', () => {
    const [airport] = parseAirportDataset({
      v: 2,
      count: 1,
      rows: [['ZZZ', 'ZZZZ', 'Sparse', 1, 2, 'US', 'US-CA', 'Town', '', '', 0, null, 0, 0]],
    });
    expect(airport.elevation).toBeUndefined();
    expect(airport.runways).toBeUndefined();
    expect(airport.longestRunwayM).toBeUndefined();
  });
});

describe('airportToPlace', () => {
  it('adapts an airport into an airport-kind Place carrying its metadata', () => {
    const [airport] = parseAirportDataset({ v: 1, count: 1, rows: [frankfurt] });
    const place = airportToPlace(airport);
    expect(place).toEqual({
      key: 'aEDDF',
      kind: 'airport',
      name: 'Frankfurt Main Airport',
      country: 'DE',
      lat: 50.0264,
      lon: 8.5431,
      population: 0,
      airport: {
        iata: 'FRA',
        icao: 'EDDF',
        region: 'DE-HE',
        municipality: 'Frankfurt am Main',
        home: 'https://www.frankfurt-airport.de/',
        wiki: 'https://en.wikipedia.org/wiki/Frankfurt_Airport',
        large: true,
      },
    });
  });
});
