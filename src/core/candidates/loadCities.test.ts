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
});
