export interface LatLon {
  lat: number;
  lon: number;
}

export interface Origin extends LatLon {
  label: string;
}

/** 'city' = bundled dataset candidate, 'pin' = user place of interest, 'home' = origin. */
export type PlaceKind = 'city' | 'pin' | 'home';

export interface Place extends LatLon {
  /** Namespaced unique key: `c{datasetIndex}`, `p{geonameId}`, or `home`. */
  key: string;
  kind: PlaceKind;
  name: string;
  country: string;
  population: number;
  admin1?: string;
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
