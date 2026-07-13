import { describe, expect, test } from 'vitest';
import { nearestFlightAirport } from './nearest';
import type { Airport } from './types';

function airport(overrides: Partial<Airport> & Pick<Airport, 'key' | 'lat' | 'lon'>): Airport {
  return {
    name: 'Test Airport',
    country: 'DE',
    iata: 'TST',
    icao: 'ETST',
    region: '',
    municipality: '',
    large: false,
    ...overrides,
  };
}

// Roughly Berlin city centre; BER is ~20 km away, Leipzig ~150 km.
const BERLIN = { lat: 52.52, lon: 13.405 };

const BER = airport({ key: 'aBER', iata: 'BER', lat: 52.3667, lon: 13.5033, name: 'Berlin Brandenburg' });
const LEJ = airport({ key: 'aLEJ', iata: 'LEJ', lat: 51.4324, lon: 12.2416, name: 'Leipzig/Halle' });
const NO_IATA = airport({ key: 'aEDDI', iata: '', icao: 'EDDI', lat: 52.51, lon: 13.4, name: 'ICAO Only' });

describe('nearestFlightAirport', () => {
  test('returns the closest airport with an IATA code and its distance', () => {
    // Arrange
    const airports = [LEJ, BER];

    // Act
    const nearest = nearestFlightAirport(BERLIN, airports);

    // Assert
    expect(nearest?.airport.iata).toBe('BER');
    expect(nearest?.distanceKm).toBeGreaterThan(10);
    expect(nearest?.distanceKm).toBeLessThan(30);
  });

  test('skips ICAO-only airports even when they are closer', () => {
    const nearest = nearestFlightAirport(BERLIN, [NO_IATA, BER]);

    expect(nearest?.airport.iata).toBe('BER');
  });

  test('returns null when nothing is within the distance cap', () => {
    const nearest = nearestFlightAirport(BERLIN, [LEJ], 100);

    expect(nearest).toBeNull();
  });

  test('returns null for an empty airport list', () => {
    expect(nearestFlightAirport(BERLIN, [])).toBeNull();
  });
});
