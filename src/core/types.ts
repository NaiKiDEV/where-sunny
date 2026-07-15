export interface LatLon {
  lat: number;
  lon: number;
}

export interface Origin extends LatLon {
  label: string;
}

/**
 * 'city' = bundled dataset candidate, 'pin' = user place of interest,
 * 'home' = origin, 'airport' = bundled airport (OurAirports).
 */
export type PlaceKind = 'city' | 'pin' | 'home' | 'airport';

/**
 * Airport-only metadata, carried on a Place when `kind === 'airport'` (and on a
 * pin cloned from one). Sourced from OurAirports; see core/airports.
 */
export interface AirportMeta {
  /** IATA code (e.g. `FRA`); `''` when the airport has none. */
  iata: string;
  /** ICAO code (e.g. `EDDF`); `''` when unknown. */
  icao: string;
  /** ISO 3166-2 subdivision (e.g. `DE-HE`); `''` when unknown. */
  region: string;
  /** Served city/town (e.g. `Frankfurt am Main`); `''` when unknown. */
  municipality: string;
  /** Official airport website. Present for ~40% of airports. */
  home?: string;
  /** Wikipedia article. Present for nearly all airports. */
  wiki?: string;
  /** `large_airport` (true) vs `medium_airport`/`small_airport` (false) - drives map emphasis. */
  large: boolean;
  /** Number of open runways (OurAirports runways.csv). Undefined when unknown. */
  runways?: number;
  /** Longest open runway in metres. Undefined when unknown. */
  longestRunwayM?: number;
}

export interface Place extends LatLon {
  /** Namespaced unique key: `c{datasetIndex}`, `p{geonameId}`, `a{icao|iata}`, or `home`. */
  key: string;
  kind: PlaceKind;
  name: string;
  country: string;
  /**
   * ISO 3166-1 alpha-2 code, uppercase, when known (geocoded/pinned places).
   * Bundled cities carry the code in `country` instead, so ban checks fall back
   * to it - see codeOf() in core/bannedCountries.
   */
  countryCode?: string;
  population: number;
  admin1?: string;
  /** Metres above sea level (GeoNames `dem` / geocoding elevation). Undefined if unknown. */
  elevation?: number;
  /** Set only when `kind === 'airport'` (or a pin cloned from an airport). */
  airport?: AirportMeta;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD, aggregated on the requester's calendar (see openMeteo.ts systemTimeZone)
  sunshineDuration: number; // seconds
  daylightDuration: number; // seconds
  cloudCoverMean: number; // 0–100
  precipProbMax: number; // 0–100
  tempMax: number; // °C
  tempMin: number; // °C
  weatherCode: number; // WMO code
  // Tier-1 enrichment (optional: pre-v2 cache entries and test fixtures omit them).
  apparentTempMax?: number; // °C, "feels like" daily max (wind + humidity adjusted)
  apparentTempMin?: number; // °C
  uvIndexMax?: number; // 0–11+ UV index, peak of day
  windMax?: number; // km/h, max 10 m wind speed
  // Snow (requested on the single-place path only - see openMeteo.ts PLACE_DAILY_VARS).
  snowfallSum?: number; // cm, daily snowfall total
  snowDepthMax?: number; // m, daily max snow depth on the ground
}

/**
 * Single-place forecast with response metadata (openMeteo.ts fetchPlaceForecast).
 * Unlike the batch/grid path, days default to the destination's local calendar
 * and `timezone` is the place's own IANA zone, so components can show local time.
 */
export interface PlaceForecast {
  days: DayForecast[];
  /** IANA timezone the days are aggregated on (e.g. `Europe/Zurich`). */
  timezone: string;
  /** Offset from UTC in seconds at that timezone, when the API provides it. */
  utcOffsetSeconds?: number;
}

export interface ScoredDay extends DayForecast {
  score: number; // 0–100
}

export interface Candidate {
  place: Place;
  distanceKm: number;
}

export interface ScoredPlace extends Candidate {
  days: ScoredDay[];
  windowDays: ScoredDay[];
  best: ScoredDay;
  score: number;
}

export type TierId = 'nearby' | 'day' | 'getaway' | 'flight';
export type WindowId = 'today' | 'tomorrow' | 'weekend' | 'week';
