import { describe, expect, it } from 'vitest';
import { parseCityDataset } from './loadCities';

describe('parseCityDataset', () => {
  it('maps rows to places with index ids', () => {
    const places = parseCityDataset({
      v: 1,
      count: 2,
      rows: [
        ['Vilnius', 'LT', 54.687, 25.28, 590_000],
        ['Kaunas', 'LT', 54.897, 23.89, 300_000],
      ],
    });
    expect(places).toHaveLength(2);
    expect(places[0]).toEqual({
      key: 'c0',
      kind: 'city',
      name: 'Vilnius',
      country: 'LT',
      lat: 54.687,
      lon: 25.28,
      population: 590_000,
    });
  });

  it('reads elevation from v2 rows', () => {
    const places = parseCityDataset({
      v: 2,
      count: 2,
      rows: [
        ['Davos', 'CH', 46.8, 9.83, 11_000, 1560],
        ['Amsterdam', 'NL', 52.37, 4.9, 900_000, 2],
      ],
    });
    expect(places[0].elevation).toBe(1560);
    expect(places[1].elevation).toBe(2);
  });

  it('omits elevation for v1 rows', () => {
    const places = parseCityDataset({
      v: 1,
      count: 1,
      rows: [['Vilnius', 'LT', 54.687, 25.28, 590_000]],
    });
    expect(places[0].elevation).toBeUndefined();
  });

  it('skips malformed rows instead of failing the whole dataset', () => {
    const places = parseCityDataset({
      v: 1,
      count: 2,
      rows: [
        ['Vilnius', 'LT', 54.687, 25.28, 590_000],
        ['Broken', 'XX', Number.NaN, 25.28, 1000],
      ],
    });
    expect(places).toHaveLength(1);
  });

  it('throws on an unrecognized dataset shape', () => {
    expect(() => parseCityDataset({ hello: 'world' })).toThrow(/Invalid city dataset/);
    expect(() => parseCityDataset(null)).toThrow(/Invalid city dataset/);
  });

  it('skips rows in banned countries so they never become places', () => {
    const places = parseCityDataset({
      v: 1,
      count: 4,
      rows: [
        ['Vilnius', 'LT', 54.687, 25.28, 590_000],
        ['Moscow', 'RU', 55.75, 37.62, 12_000_000],
        ['Minsk', 'BY', 53.9, 27.57, 2_000_000],
        ['Riga', 'LV', 56.95, 24.11, 600_000],
      ],
    });
    expect(places.map((p) => p.name)).toEqual(['Vilnius', 'Riga']);
    expect(places.some((p) => p.country === 'RU' || p.country === 'BY')).toBe(false);
  });
});
