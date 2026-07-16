/**
 * Lodging deep-links, mirroring core/flights/flightLinks.ts. Pure URL builders -
 * no I/O, no API keys. Every provider accepts free-text place names, so unlike
 * flights there is no code-based gating: the row always has all three links.
 * Real check-in/check-out dates ride along so the landing page is immediately
 * useful, not a blank search form.
 */

export type StayProvider = 'booking' | 'airbnb' | 'google';

/** A lodging search request - place plus a concrete date span. */
export interface StayQuery {
  placeName: string;
  /** Appended for disambiguation when known ("Faro" alone is ambiguous). */
  countryName?: string;
  checkIn: string; // ISO 'YYYY-MM-DD'
  checkOut: string; // ISO 'YYYY-MM-DD', strictly after checkIn
  currency?: string; // ISO 4217, optional (Booking.com only)
}

export interface StayLink {
  provider: StayProvider;
  label: string;
  url: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Booking.com defaults to double occupancy - matches its own search form. */
const BOOKING_GROUP_ADULTS = '2';

interface NormalizedStay {
  placeName: string;
  countryName?: string;
  /** Place plus country when known - the disambiguated search text. */
  destination: string;
  checkIn: string;
  checkOut: string;
  currency?: string;
}

/** Boundary validation for every builder: fail fast on malformed input. */
function normalize(query: StayQuery): NormalizedStay {
  const placeName = query.placeName.trim();
  if (!placeName) throw new Error('Stay place name must not be empty');
  if (!ISO_DATE.test(query.checkIn)) {
    throw new Error(`Invalid checkIn "${query.checkIn}" - expected YYYY-MM-DD`);
  }
  if (!ISO_DATE.test(query.checkOut)) {
    throw new Error(`Invalid checkOut "${query.checkOut}" - expected YYYY-MM-DD`);
  }
  // ISO dates compare correctly as strings; a zero-night stay is not a stay.
  if (query.checkOut <= query.checkIn) {
    throw new Error(`checkOut "${query.checkOut}" must be after checkIn "${query.checkIn}"`);
  }
  const countryName = query.countryName?.trim();
  const normalized: NormalizedStay = {
    placeName,
    destination: countryName ? `${placeName}, ${countryName}` : placeName,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
  };
  if (countryName) normalized.countryName = countryName;
  const currency = query.currency?.trim().toUpperCase();
  if (currency) normalized.currency = currency;
  return normalized;
}

/** Documented search-results URL; the only provider with a currency param. */
export function buildBookingUrl(query: StayQuery): string {
  const q = normalize(query);
  const params = new URLSearchParams({
    ss: q.destination,
    checkin: q.checkIn,
    checkout: q.checkOut,
  });
  if (q.currency) params.set('selected_currency', q.currency);
  params.set('group_adults', BOOKING_GROUP_ADULTS);
  return `https://www.booking.com/searchresults.html?${params}`;
}

/** Path-encoded homes search - Airbnb reads the location from the path segment. */
export function buildAirbnbUrl(query: StayQuery): string {
  const q = normalize(query);
  const params = new URLSearchParams({ checkin: q.checkIn, checkout: q.checkOut });
  return `https://www.airbnb.com/s/${encodeURIComponent(q.destination)}/homes?${params}`;
}

/**
 * Natural-language query, the same philosophy as buildGoogleFlightsUrl: the
 * checkin/checkout params on /travel/search are undocumented, so the dates ride
 * the phrase instead - Google parses them reliably and the link cannot rot.
 */
export function buildGoogleHotelsUrl(query: StayQuery): string {
  const q = normalize(query);
  const where = q.countryName ? `${q.placeName} ${q.countryName}` : q.placeName;
  const phrase = `hotels in ${where} from ${q.checkIn} to ${q.checkOut}`;
  return `https://www.google.com/travel/search?q=${encodeURIComponent(phrase)}`;
}

const PROVIDER_LABEL: Record<StayProvider, string> = {
  booking: 'Booking.com',
  airbnb: 'Airbnb',
  google: 'Google Hotels',
};

const PROVIDER_BUILDER: Record<StayProvider, (q: StayQuery) => string> = {
  booking: buildBookingUrl,
  airbnb: buildAirbnbUrl,
  google: buildGoogleHotelsUrl,
};

/** Display order: booking sites first, Google's meta-search as the closer. */
const ALL_PROVIDERS: StayProvider[] = ['booking', 'airbnb', 'google'];

/** Build the full provider row - stable set and order, all deep-linked with dates. */
export function buildStayLinks(
  placeName: string,
  countryName: string | undefined,
  checkIn: string,
  checkOut: string,
  currency?: string,
): StayLink[] {
  const query: StayQuery = { placeName, countryName, checkIn, checkOut, currency };
  return ALL_PROVIDERS.map((provider) => ({
    provider,
    label: PROVIDER_LABEL[provider],
    url: PROVIDER_BUILDER[provider](query),
  }));
}
