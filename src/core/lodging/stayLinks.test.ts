import { describe, expect, test } from 'vitest';
import {
  buildAirbnbUrl,
  buildBookingUrl,
  buildGoogleHotelsUrl,
  buildStayLinks,
  type StayQuery,
} from './stayLinks';

const FARO: StayQuery = {
  placeName: 'Faro',
  countryName: 'Portugal',
  checkIn: '2026-08-01',
  checkOut: '2026-08-04',
};

const NO_COUNTRY: StayQuery = {
  placeName: 'Faro',
  checkIn: '2026-08-01',
  checkOut: '2026-08-04',
};

describe('buildBookingUrl', () => {
  test('builds the search URL with dates and double occupancy', () => {
    const url = buildBookingUrl(FARO);

    expect(url).toBe(
      'https://www.booking.com/searchresults.html' +
        '?ss=Faro%2C+Portugal&checkin=2026-08-01&checkout=2026-08-04&group_adults=2',
    );
  });

  test('drops the country from ss when unknown', () => {
    const url = buildBookingUrl(NO_COUNTRY);

    expect(url).toContain('ss=Faro&checkin=');
  });

  test('includes selected_currency only when provided, uppercased', () => {
    const withCurrency = buildBookingUrl({ ...FARO, currency: 'eur' });
    const without = buildBookingUrl(FARO);

    expect(withCurrency).toContain('selected_currency=EUR');
    expect(without).not.toContain('selected_currency');
  });

  test('percent-encodes diacritics and spaces in the place name', () => {
    const url = buildBookingUrl({ ...FARO, placeName: 'Málaga', countryName: 'Spain' });

    expect(url).toContain('ss=M%C3%A1laga%2C+Spain');
  });

  test('escapes ampersands so the place cannot split the query string', () => {
    const url = buildBookingUrl({ ...NO_COUNTRY, placeName: 'Mull & Iona' });

    expect(url).toContain('ss=Mull+%26+Iona&');
  });
});

describe('buildAirbnbUrl', () => {
  test('builds the path-encoded homes search with dates', () => {
    const url = buildAirbnbUrl(FARO);

    expect(url).toBe(
      'https://www.airbnb.com/s/Faro%2C%20Portugal/homes?checkin=2026-08-01&checkout=2026-08-04',
    );
  });

  test('encodes slashes so the place stays a single path segment', () => {
    const url = buildAirbnbUrl({ ...NO_COUNTRY, placeName: 'Sóller/Port' });

    expect(url).toContain('/s/S%C3%B3ller%2FPort/homes');
  });
});

describe('buildGoogleHotelsUrl', () => {
  test('builds an encoded natural-language query with country and dates', () => {
    const url = buildGoogleHotelsUrl(FARO);

    expect(url).toBe(
      'https://www.google.com/travel/search' +
        '?q=hotels%20in%20Faro%20Portugal%20from%202026-08-01%20to%202026-08-04',
    );
  });

  test('drops the country from the phrase when unknown', () => {
    const url = buildGoogleHotelsUrl(NO_COUNTRY);

    expect(url).toContain(encodeURIComponent('hotels in Faro from'));
  });

  test('keeps dates in the phrase - no undocumented checkin/checkout params', () => {
    const url = buildGoogleHotelsUrl(FARO);

    expect(url).not.toContain('checkin=');
    expect(url).not.toContain('checkout=');
  });
});

describe('input validation', () => {
  test('throws on an empty place name', () => {
    expect(() => buildBookingUrl({ ...FARO, placeName: '  ' })).toThrow(/place name/);
  });

  test('throws on malformed dates', () => {
    expect(() => buildBookingUrl({ ...FARO, checkIn: '01/08/2026' })).toThrow(/checkIn/);
    expect(() => buildAirbnbUrl({ ...FARO, checkOut: 'next week' })).toThrow(/checkOut/);
  });

  test('throws when checkOut is not after checkIn', () => {
    expect(() => buildGoogleHotelsUrl({ ...FARO, checkOut: '2026-08-01' })).toThrow(/after/);
    expect(() => buildBookingUrl({ ...FARO, checkOut: '2026-07-30' })).toThrow(/after/);
  });
});

describe('buildStayLinks', () => {
  test('returns all three providers in stable display order', () => {
    const links = buildStayLinks('Faro', 'Portugal', '2026-08-01', '2026-08-04');

    expect(links.map((l) => l.provider)).toEqual(['booking', 'airbnb', 'google']);
    expect(links.map((l) => l.label)).toEqual(['Booking.com', 'Airbnb', 'Google Hotels']);
  });

  test('passes the currency to Booking.com only', () => {
    const links = buildStayLinks('Faro', 'Portugal', '2026-08-01', '2026-08-04', 'eur');
    const byProvider = Object.fromEntries(links.map((l) => [l.provider, l.url]));

    expect(byProvider.booking).toContain('selected_currency=EUR');
    expect(byProvider.airbnb).not.toContain('EUR');
    expect(byProvider.google).not.toContain('EUR');
  });

  test('feeds the country into every provider when provided', () => {
    const links = buildStayLinks('Faro', 'Portugal', '2026-08-01', '2026-08-04');

    for (const link of links) expect(link.url).toContain('Portugal');
  });

  test('searches by place name alone when the country is unknown', () => {
    const links = buildStayLinks('Faro', undefined, '2026-08-01', '2026-08-04');
    const byProvider = Object.fromEntries(links.map((l) => [l.provider, l.url]));

    expect(byProvider.booking).toContain('ss=Faro&');
    expect(byProvider.airbnb).toContain('/s/Faro/homes');
    expect(byProvider.google).toContain(encodeURIComponent('hotels in Faro from'));
  });

  test('propagates boundary validation from the builders', () => {
    expect(() => buildStayLinks('Faro', undefined, '2026-08-04', '2026-08-01')).toThrow(/after/);
  });
});
