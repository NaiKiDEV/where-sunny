import { describe, expect, test } from 'vitest';
import {
  buildFlightLinks,
  buildGoogleFlightsUrl,
  buildKayakUrl,
  buildSkyscannerUrl,
  isIataCode,
  type FlightQuery,
} from './flightLinks';

const ONE_WAY: FlightQuery = {
  origin: 'JFK',
  destination: 'LHR',
  departDate: '2026-08-01',
};

const ROUND_TRIP: FlightQuery = {
  ...ONE_WAY,
  returnDate: '2026-08-08',
};

describe('isIataCode', () => {
  test('accepts three-letter codes of any case', () => {
    expect(isIataCode('JFK')).toBe(true);
    expect(isIataCode('lhr')).toBe(true);
    expect(isIataCode(' fra ')).toBe(true);
  });

  test('rejects names, ICAO codes, and empty strings', () => {
    expect(isIataCode('New York')).toBe(false);
    expect(isIataCode('EDDF')).toBe(false);
    expect(isIataCode('')).toBe(false);
  });
});

describe('buildGoogleFlightsUrl', () => {
  test('builds an encoded one-way natural-language query', () => {
    const url = buildGoogleFlightsUrl(ONE_WAY);

    expect(url).toBe(
      'https://www.google.com/travel/flights?q=Flights%20from%20JFK%20to%20LHR%20on%202026-08-01%20one%20way',
    );
  });

  test('appends the return date for round-trips', () => {
    const url = buildGoogleFlightsUrl(ROUND_TRIP);

    expect(url).toContain(encodeURIComponent('returning 2026-08-08'));
    expect(url).not.toContain(encodeURIComponent('one way'));
  });

  test('uppercases IATA codes but leaves place names untouched', () => {
    const url = buildGoogleFlightsUrl({ ...ONE_WAY, origin: 'jfk', destination: 'Faro' });

    expect(url).toContain(encodeURIComponent('from JFK to Faro'));
  });

  test('adds passengers, cabin phrase, and currency when set', () => {
    const url = buildGoogleFlightsUrl({
      ...ONE_WAY,
      adults: 2,
      cabin: 'business',
      currency: 'usd',
    });

    expect(url).toContain(encodeURIComponent('2 passengers'));
    expect(url).toContain(encodeURIComponent('business class'));
    expect(url).toContain('&curr=USD');
  });

  test('omits passenger count and cabin for the defaults', () => {
    const url = buildGoogleFlightsUrl({ ...ONE_WAY, adults: 1, cabin: 'economy' });

    expect(url).not.toContain(encodeURIComponent('passengers'));
    expect(url).not.toContain(encodeURIComponent('class'));
    expect(url).not.toContain('curr=');
  });
});

describe('buildSkyscannerUrl', () => {
  test('builds the referral day-view URL for a round-trip', () => {
    const url = buildSkyscannerUrl(ROUND_TRIP);

    expect(url).toBe(
      'https://www.skyscanner.net/g/referrals/v1/flights/day-view/' +
        '?origin=JFK&destination=LHR&outboundDate=2026-08-01&inboundDate=2026-08-08' +
        '&adults=1&cabinClass=economy',
    );
  });

  test('omits inboundDate for one-way trips', () => {
    const url = buildSkyscannerUrl(ONE_WAY);

    expect(url).not.toContain('inboundDate');
  });

  test('maps premium-economy to the hyphen-less cabinClass value', () => {
    const url = buildSkyscannerUrl({ ...ONE_WAY, cabin: 'premium-economy' });

    expect(url).toContain('cabinClass=premiumeconomy');
  });

  test('includes currency and market only when provided', () => {
    const withBoth = buildSkyscannerUrl({ ...ONE_WAY, currency: 'eur', market: 'de' });
    const without = buildSkyscannerUrl(ONE_WAY);

    expect(withBoth).toContain('currency=EUR');
    expect(withBoth).toContain('market=DE');
    expect(without).not.toContain('currency=');
    expect(without).not.toContain('market=');
  });

  test('uppercases lowercase IATA codes', () => {
    const url = buildSkyscannerUrl({ ...ONE_WAY, origin: 'jfk', destination: 'lhr' });

    expect(url).toContain('origin=JFK&destination=LHR');
  });

  test('throws when an endpoint is not an IATA code', () => {
    expect(() => buildSkyscannerUrl({ ...ONE_WAY, destination: 'Faro' })).toThrow(/IATA/);
  });
});

describe('buildKayakUrl', () => {
  test('builds a one-way search sorted by price', () => {
    const url = buildKayakUrl(ONE_WAY);

    expect(url).toBe('https://www.kayak.com/flights/JFK-LHR/2026-08-01?sort=price_a');
  });

  test('appends the return date segment for round-trips', () => {
    const url = buildKayakUrl(ROUND_TRIP);

    expect(url).toBe('https://www.kayak.com/flights/JFK-LHR/2026-08-01/2026-08-08?sort=price_a');
  });

  test('throws when an endpoint is not an IATA code', () => {
    expect(() => buildKayakUrl({ ...ONE_WAY, origin: 'New York' })).toThrow(/IATA/);
  });
});

describe('input validation', () => {
  test('throws on malformed dates', () => {
    expect(() => buildGoogleFlightsUrl({ ...ONE_WAY, departDate: '01/08/2026' })).toThrow(
      /departDate/,
    );
    expect(() => buildGoogleFlightsUrl({ ...ROUND_TRIP, returnDate: 'next week' })).toThrow(
      /returnDate/,
    );
  });

  test('throws on empty endpoints', () => {
    expect(() => buildGoogleFlightsUrl({ ...ONE_WAY, origin: '  ' })).toThrow(/origin/);
  });

  test('clamps adults to at least 1', () => {
    const url = buildSkyscannerUrl({ ...ONE_WAY, adults: 0 });

    expect(url).toContain('adults=1');
  });
});

describe('buildFlightLinks', () => {
  test('returns all three providers in display order when both ends have codes', () => {
    const links = buildFlightLinks(ROUND_TRIP);

    expect(links.map((l) => l.provider)).toEqual(['google', 'skyscanner', 'kayak']);
    expect(links.map((l) => l.label)).toEqual(['Google Flights', 'Skyscanner', 'Kayak']);
  });

  test('falls back to Google only when an endpoint is a place name', () => {
    const links = buildFlightLinks({ ...ONE_WAY, destination: 'Faro' });

    expect(links.map((l) => l.provider)).toEqual(['google']);
    expect(links[0].url).toContain(encodeURIComponent('to Faro'));
  });

  test('respects an explicit provider subset and its order', () => {
    const links = buildFlightLinks(ONE_WAY, ['kayak', 'google']);

    expect(links.map((l) => l.provider)).toEqual(['kayak', 'google']);
  });
});
