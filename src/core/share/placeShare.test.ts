import { describe, expect, it } from 'vitest';
import { decodeSharedPlace, encodePlace } from './placeShare';
import type { Place } from '../types';

function place(overrides: Partial<Place> = {}): Place {
  return {
    key: 'p1',
    kind: 'pin',
    name: 'Nice',
    country: 'France',
    countryCode: 'FR',
    lat: 43.7,
    lon: 7.26,
    population: 340000,
    elevation: 15,
    ...overrides,
  };
}

describe('encodePlace / decodeSharedPlace', () => {
  it('round-trips name, country, coords, elevation, and countryCode', () => {
    const encoded = encodePlace(place());
    const decoded = decodeSharedPlace(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Nice');
    expect(decoded!.country).toBe('France');
    expect(decoded!.countryCode).toBe('FR');
    expect(decoded!.lat).toBeCloseTo(43.7, 3);
    expect(decoded!.lon).toBeCloseTo(7.26, 3);
    expect(decoded!.elevation).toBe(15);
    expect(decoded!.kind).toBe('pin');
  });

  it('produces a URL-safe string (no + / =)', () => {
    const encoded = encodePlace(place({ name: 'Café Bär', country: 'Österreich' }));
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('preserves unicode names and omits absent optional fields', () => {
    const decoded = decodeSharedPlace(
      encodePlace(place({ name: 'Café Bär', countryCode: undefined, elevation: undefined })),
    );
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Café Bär');
    expect(decoded!.countryCode).toBeUndefined();
    expect(decoded!.elevation).toBeUndefined();
  });

  it('returns null for garbage input', () => {
    expect(decodeSharedPlace('not-valid-base64!!')).toBeNull();
    expect(decodeSharedPlace('')).toBeNull();
    expect(decodeSharedPlace('random-text')).toBeNull();
  });

  it('returns null for a non-finite coordinate payload', () => {
    // A payload with a NaN latitude must be rejected.
    const bad = encodePlace(place());
    // Hand-craft a payload with a non-finite coord by encoding invalid JSON shape.
    const encoded = btoa(JSON.stringify({ v: 1, n: 'X', c: 'FR', la: 'nope', lo: 7 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeSharedPlace(encoded)).toBeNull();
    expect(decodeSharedPlace(bad)).not.toBeNull(); // sanity: valid still decodes
  });

  it('returns null for an empty name', () => {
    const encoded = btoa(JSON.stringify({ v: 1, n: '   ', c: 'FR', la: 43.7, lo: 7.26 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeSharedPlace(encoded)).toBeNull();
  });
});
