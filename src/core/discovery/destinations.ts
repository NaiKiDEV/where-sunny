import { isEffectivelyBanned } from '../bannedCountries';

/**
 * A hand-picked, reliably-sunny destination shown on the welcome screen and the
 * explore empty state to help first-run users who have no obvious origin in
 * mind. Bundled static data only - no network, no keys. Tapping one sets it as
 * the map origin (see SuggestedDestinations), reusing the whole scoring pipeline.
 */
export interface CuratedDestination {
  name: string;
  /** Full English country name, for display next to the flag. */
  country: string;
  /** ISO 3166-1 alpha-2, uppercase. Drives the flag and the ban filter. */
  countryCode: string;
  lat: number;
  lon: number;
  /** One-line "why go" note, surfaced as the chip tooltip. */
  blurb?: string;
  /** Grouping label (e.g. "Mediterranean"); entries render under their region. */
  region: string;
}

/**
 * ~26 dependable-sun spots grouped by `region`. Ordered by region so the UI can
 * group them by insertion order. Every entry carries finite coords and a valid
 * 2-letter uppercase `countryCode` (asserted in destinations.test.ts). None sit
 * in a built-in banned country; user bans are applied at render via
 * {@link visibleDestinations}.
 */
export const CURATED_DESTINATIONS: readonly CuratedDestination[] = [
  // Mediterranean
  {
    name: 'Palma de Mallorca',
    country: 'Spain',
    countryCode: 'ES',
    lat: 39.5696,
    lon: 2.6502,
    region: 'Mediterranean',
    blurb: 'Balearic beaches, old-town tapas, long dry summers.',
  },
  {
    name: 'Athens',
    country: 'Greece',
    countryCode: 'GR',
    lat: 37.9838,
    lon: 23.7275,
    region: 'Mediterranean',
    blurb: 'Ancient ruins under near-relentless Aegean sun.',
  },
  {
    name: 'Valletta',
    country: 'Malta',
    countryCode: 'MT',
    lat: 35.8989,
    lon: 14.5146,
    region: 'Mediterranean',
    blurb: 'Honey-stone capital with some of Europe’s highest sunshine hours.',
  },
  {
    name: 'Nice',
    country: 'France',
    countryCode: 'FR',
    lat: 43.7102,
    lon: 7.262,
    region: 'Mediterranean',
    blurb: 'French Riviera light along the Promenade des Anglais.',
  },
  {
    name: 'Dubrovnik',
    country: 'Croatia',
    countryCode: 'HR',
    lat: 42.6507,
    lon: 18.0944,
    region: 'Mediterranean',
    blurb: 'Walled Adriatic city, warm and bright late into autumn.',
  },
  // Canary Islands & Madeira
  {
    name: 'Las Palmas',
    country: 'Spain',
    countryCode: 'ES',
    lat: 28.1235,
    lon: -15.4363,
    region: 'Canary Islands & Madeira',
    blurb: 'Atlantic islands famous for endless spring weather.',
  },
  {
    name: 'Funchal',
    country: 'Portugal',
    countryCode: 'PT',
    lat: 32.6669,
    lon: -16.9241,
    region: 'Canary Islands & Madeira',
    blurb: 'Madeira’s mild, sunny climate year-round.',
  },
  // Middle East
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    lat: 25.2048,
    lon: 55.2708,
    region: 'Middle East',
    blurb: 'Reliable Gulf sun and warm winters.',
  },
  {
    name: 'Tel Aviv',
    country: 'Israel',
    countryCode: 'IL',
    lat: 32.0853,
    lon: 34.7818,
    region: 'Middle East',
    blurb: 'Mediterranean beach city with long bright seasons.',
  },
  {
    name: 'Aqaba',
    country: 'Jordan',
    countryCode: 'JO',
    lat: 29.5267,
    lon: 35.0078,
    region: 'Middle East',
    blurb: 'Red Sea sun and desert clarity.',
  },
  // North Africa
  {
    name: 'Marrakech',
    country: 'Morocco',
    countryCode: 'MA',
    lat: 31.6295,
    lon: -7.9811,
    region: 'North Africa',
    blurb: 'Sun-baked medina at the foot of the Atlas.',
  },
  {
    name: 'Hurghada',
    country: 'Egypt',
    countryCode: 'EG',
    lat: 27.2579,
    lon: 33.8116,
    region: 'North Africa',
    blurb: 'Red Sea resort strip with dependable heat.',
  },
  // Southeast Asia
  {
    name: 'Denpasar (Bali)',
    country: 'Indonesia',
    countryCode: 'ID',
    lat: -8.6705,
    lon: 115.2126,
    region: 'Southeast Asia',
    blurb: 'Tropical island sun outside the wet months.',
  },
  {
    name: 'Phuket',
    country: 'Thailand',
    countryCode: 'TH',
    lat: 7.8804,
    lon: 98.3923,
    region: 'Southeast Asia',
    blurb: 'Andaman beaches, brightest in the dry season.',
  },
  {
    name: 'Cebu',
    country: 'Philippines',
    countryCode: 'PH',
    lat: 10.3157,
    lon: 123.8854,
    region: 'Southeast Asia',
    blurb: 'Central Visayas sun and island hopping.',
  },
  // Caribbean
  {
    name: 'San Juan',
    country: 'Puerto Rico',
    countryCode: 'PR',
    lat: 18.4655,
    lon: -66.1057,
    region: 'Caribbean',
    blurb: 'Old San Juan colour under steady trade-wind sun.',
  },
  {
    name: 'Cancún',
    country: 'Mexico',
    countryCode: 'MX',
    lat: 21.1619,
    lon: -86.8515,
    region: 'Caribbean',
    blurb: 'Yucatán beaches and turquoise water.',
  },
  {
    name: 'Oranjestad',
    country: 'Aruba',
    countryCode: 'AW',
    lat: 12.5092,
    lon: -70.0086,
    region: 'Caribbean',
    blurb: 'Southern Caribbean island that sits below the hurricane belt.',
  },
  // Southern Africa & Indian Ocean
  {
    name: 'Cape Town',
    country: 'South Africa',
    countryCode: 'ZA',
    lat: -33.9249,
    lon: 18.4241,
    region: 'Southern Africa & Indian Ocean',
    blurb: 'Dramatic coast with dry, bright summers.',
  },
  {
    name: 'Port Louis',
    country: 'Mauritius',
    countryCode: 'MU',
    lat: -20.1609,
    lon: 57.5012,
    region: 'Southern Africa & Indian Ocean',
    blurb: 'Indian Ocean island warmth most of the year.',
  },
  // Australia & Pacific
  {
    name: 'Gold Coast',
    country: 'Australia',
    countryCode: 'AU',
    lat: -28.0167,
    lon: 153.4,
    region: 'Australia & Pacific',
    blurb: 'Surf beaches and a famously sunny subtropical strip.',
  },
  {
    name: 'Honolulu',
    country: 'United States',
    countryCode: 'US',
    lat: 21.3069,
    lon: -157.8583,
    region: 'Australia & Pacific',
    blurb: 'Hawaiian trade winds and even, warm sun.',
  },
  // American Southwest
  {
    name: 'Phoenix',
    country: 'United States',
    countryCode: 'US',
    lat: 33.4484,
    lon: -112.074,
    region: 'American Southwest',
    blurb: 'Sonoran desert city with sun almost every day.',
  },
  {
    name: 'San Diego',
    country: 'United States',
    countryCode: 'US',
    lat: 32.7157,
    lon: -117.1611,
    region: 'American Southwest',
    blurb: 'Mild, bright Pacific coast climate.',
  },
  // South America
  {
    name: 'Rio de Janeiro',
    country: 'Brazil',
    countryCode: 'BR',
    lat: -22.9068,
    lon: -43.1729,
    region: 'South America',
    blurb: 'Beaches, mountains, and abundant tropical sun.',
  },
  {
    name: 'Cartagena',
    country: 'Colombia',
    countryCode: 'CO',
    lat: 10.391,
    lon: -75.4794,
    region: 'South America',
    blurb: 'Walled Caribbean coast city, hot and bright year-round.',
  },
];

/**
 * The curated set minus anything banned. Pass the effective banned set (built-in
 * ∪ user picks, e.g. from {@link useBannedFilter}); `isEffectivelyBanned`
 * re-checks the built-ins internally, so handing it the full effective set - or
 * only the user's codes - both correctly drop built-in bans.
 */
export function visibleDestinations(
  userBannedCodes: ReadonlySet<string>,
): CuratedDestination[] {
  return CURATED_DESTINATIONS.filter(
    (d) => !isEffectivelyBanned({ country: d.country, countryCode: d.countryCode }, userBannedCodes),
  );
}
