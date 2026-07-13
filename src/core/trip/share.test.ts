import { describe, expect, it } from 'vitest';
import { addStop, type Trip } from './trip';
import { decodeSharedTrip, encodeTrip } from './share';
import type { Place } from '../types';

function place(key: string, name: string, lat: number, lon: number, elevation?: number): Place {
  return { key, kind: 'city', name, country: 'CH', lat, lon, population: 1000, elevation };
}

function makeTrip(): Trip {
  let t: Trip = {
    id: 't1',
    name: 'Alpine loop',
    origin: { lat: 47.37, lon: 8.54, label: 'Zürich' },
    stops: [],
    createdAt: '2026-07-12T00:00:00Z',
  };
  t = addStop(t, place('c1', 'Davos', 46.8, 9.83, 1560));
  t = addStop(t, place('c2', 'Café Bär', 46.0, 7.75)); // unicode + no elevation
  return t;
}

describe('encodeTrip / decodeSharedTrip', () => {
  it('round-trips name, origin, and stops through a URL-safe string', () => {
    const encoded = encodeTrip(makeTrip());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe, no padding

    const decoded = decodeSharedTrip(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Alpine loop');
    expect(decoded!.origin?.label).toBe('Zürich');
    expect(decoded!.stops.map((s) => s.place.name)).toEqual(['Davos', 'Café Bär']);
    expect(decoded!.stops[0].place.elevation).toBe(1560);
    expect(decoded!.stops[1].place.elevation).toBeUndefined();
    expect(decoded!.stops[0].place.lat).toBeCloseTo(46.8, 3);
    // Backward compatible: stops encoded without `cc` decode with no countryCode.
    expect(decoded!.stops[0].place.countryCode).toBeUndefined();
  });

  it('round-trips countryCode when a stop carries one', () => {
    const withCode: Place = {
      key: 'p1',
      kind: 'pin',
      name: 'Nice',
      country: 'France',
      countryCode: 'FR',
      lat: 43.7,
      lon: 7.26,
      population: 340000,
    };
    let trip: Trip = { id: 't2', name: 'Riviera', stops: [], createdAt: '2026-07-12T00:00:00Z' };
    trip = addStop(trip, withCode);

    const decoded = decodeSharedTrip(encodeTrip(trip));
    expect(decoded).not.toBeNull();
    expect(decoded!.stops[0].place.countryCode).toBe('FR');
    expect(decoded!.stops[0].place.country).toBe('France');
  });

  it('returns null for garbage input', () => {
    expect(decodeSharedTrip('not-valid-base64!!')).toBeNull();
    expect(decodeSharedTrip('')).toBeNull();
  });

  it('rejects a payload with no stops', () => {
    const empty: Trip = { id: 'x', name: 'Empty', stops: [], createdAt: '2026-07-12T00:00:00Z' };
    expect(decodeSharedTrip(encodeTrip(empty))).toBeNull();
  });
});
