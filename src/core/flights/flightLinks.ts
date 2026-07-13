/**
 * Flight price deep-links (docs/FLIGHT-LINKS.md). Pure URL builders - no I/O,
 * no API keys. Skyscanner and Kayak require IATA codes on both ends; Google
 * Flights also accepts free-text place names via its natural-language query,
 * which is the graceful fallback when a place has no airport code.
 */

export type CabinClass = 'economy' | 'premium-economy' | 'business' | 'first';
export type FlightProvider = 'google' | 'skyscanner' | 'kayak';

/** A flight search request, decoupled from how airports are modeled. */
export interface FlightQuery {
  /** IATA code (any case) or, for Google only, a free-text place name. */
  origin: string;
  destination: string;
  departDate: string; // ISO 'YYYY-MM-DD'
  returnDate?: string; // ISO 'YYYY-MM-DD'; presence = round-trip
  adults?: number; // default 1
  cabin?: CabinClass; // default 'economy'
  currency?: string; // ISO 4217, optional (Google/Skyscanner)
  market?: string; // ISO 3166-1 alpha-2, optional (Skyscanner)
}

export interface FlightLink {
  provider: FlightProvider;
  label: string;
  url: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_CODE = /^[A-Za-z]{3}$/;

/** Whether the value has the shape of an IATA code (three letters). */
export function isIataCode(value: string): boolean {
  return IATA_CODE.test(value.trim());
}

interface NormalizedQuery {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  cabin: CabinClass;
  currency?: string;
  market?: string;
}

function normalizeEndpoint(value: string, side: 'origin' | 'destination'): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Flight ${side} must not be empty`);
  return isIataCode(trimmed) ? trimmed.toUpperCase() : trimmed;
}

/** Boundary validation for every builder: fail fast on malformed input. */
function normalize(query: FlightQuery): NormalizedQuery {
  if (!ISO_DATE.test(query.departDate)) {
    throw new Error(`Invalid departDate "${query.departDate}" - expected YYYY-MM-DD`);
  }
  if (query.returnDate !== undefined && !ISO_DATE.test(query.returnDate)) {
    throw new Error(`Invalid returnDate "${query.returnDate}" - expected YYYY-MM-DD`);
  }
  const normalized: NormalizedQuery = {
    origin: normalizeEndpoint(query.origin, 'origin'),
    destination: normalizeEndpoint(query.destination, 'destination'),
    departDate: query.departDate,
    adults: Math.max(1, Math.floor(query.adults ?? 1)),
    cabin: query.cabin ?? 'economy',
  };
  if (query.returnDate !== undefined) normalized.returnDate = query.returnDate;
  const currency = query.currency?.trim().toUpperCase();
  if (currency) normalized.currency = currency;
  const market = query.market?.trim().toUpperCase();
  if (market) normalized.market = market;
  return normalized;
}

function requireIata(value: string, side: string, provider: string): string {
  if (!isIataCode(value)) {
    throw new Error(`${provider} links need an IATA ${side} code, got "${value}"`);
  }
  return value.toUpperCase();
}

const GOOGLE_CABIN: Record<Exclude<CabinClass, 'economy'>, string> = {
  'premium-economy': 'premium economy',
  business: 'business class',
  first: 'first class',
};

/** Natural-language query - the only documented public path into Google Flights. */
export function buildGoogleFlightsUrl(query: FlightQuery): string {
  const q = normalize(query);
  const parts = [`Flights from ${q.origin} to ${q.destination} on ${q.departDate}`];
  parts.push(q.returnDate ? `returning ${q.returnDate}` : 'one way');
  if (q.adults > 1) parts.push(`${q.adults} passengers`);
  if (q.cabin !== 'economy') parts.push(GOOGLE_CABIN[q.cabin]);
  let url = `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`;
  if (q.currency) url += `&curr=${q.currency}`;
  return url;
}

const SKYSCANNER_CABIN: Record<CabinClass, string> = {
  economy: 'economy',
  'premium-economy': 'premiumeconomy',
  business: 'business',
  first: 'first',
};

/** Documented referral day-view URL - affiliate-ready (mediaPartnerId slots in later). */
export function buildSkyscannerUrl(query: FlightQuery): string {
  const q = normalize(query);
  const params = new URLSearchParams({
    origin: requireIata(q.origin, 'origin', 'Skyscanner'),
    destination: requireIata(q.destination, 'destination', 'Skyscanner'),
    outboundDate: q.departDate,
  });
  if (q.returnDate) params.set('inboundDate', q.returnDate);
  params.set('adults', String(q.adults));
  params.set('cabinClass', SKYSCANNER_CABIN[q.cabin]);
  if (q.currency) params.set('currency', q.currency);
  if (q.market) params.set('market', q.market);
  return `https://www.skyscanner.net/g/referrals/v1/flights/day-view/?${params}`;
}

/** Fresh-search URL (stable; only per-deal booking hrefs expire, which we don't use). */
export function buildKayakUrl(query: FlightQuery): string {
  const q = normalize(query);
  const origin = requireIata(q.origin, 'origin', 'Kayak');
  const destination = requireIata(q.destination, 'destination', 'Kayak');
  const dates = q.returnDate ? `${q.departDate}/${q.returnDate}` : q.departDate;
  return `https://www.kayak.com/flights/${origin}-${destination}/${dates}?sort=price_a`;
}

const PROVIDER_LABEL: Record<FlightProvider, string> = {
  google: 'Google Flights',
  skyscanner: 'Skyscanner',
  kayak: 'Kayak',
};

const PROVIDER_BUILDER: Record<FlightProvider, (q: FlightQuery) => string> = {
  google: buildGoogleFlightsUrl,
  skyscanner: buildSkyscannerUrl,
  kayak: buildKayakUrl,
};

const ALL_PROVIDERS: FlightProvider[] = ['google', 'skyscanner', 'kayak'];

/**
 * Build links for the requested providers (default: all three, display order).
 * Skyscanner/Kayak are skipped when either endpoint isn't an IATA code - Google
 * survives on free-text names, so the row never comes back empty.
 */
export function buildFlightLinks(
  query: FlightQuery,
  providers: FlightProvider[] = ALL_PROVIDERS,
): FlightLink[] {
  const hasCodes = isIataCode(query.origin) && isIataCode(query.destination);
  return providers
    .filter((provider) => provider === 'google' || hasCodes)
    .map((provider) => ({
      provider,
      label: PROVIDER_LABEL[provider],
      url: PROVIDER_BUILDER[provider](query),
    }));
}
