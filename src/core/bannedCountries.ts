import type { Place } from './types';

/**
 * Single source of truth for banned countries.
 *
 * Add an entry here and every surface filters it out: the bundled city dataset,
 * candidate selection, geocoding search, ranked suggestions, watched pins,
 * saved/shared trips, and the map (where the country is shaded and crossed out).
 *
 * Matching is deliberately done on BOTH code and name because `Place.country`
 * is not uniform across sources: bundled cities carry an ISO 3166-1 alpha-2
 * code (e.g. `"BY"`), while geocoding results, pins, and trip stops carry a
 * full English name (e.g. `"Belarus"`). See build-cities.mjs and geocoding.ts.
 */
export interface BannedCountry {
  /** ISO 3166-1 alpha-2 code, uppercase (e.g. `"BY"`). */
  code: string;
  /** Canonical English name, as the geocoding API returns it (e.g. `"Belarus"`). */
  name: string;
  /** Alternative names/spellings to also block (e.g. `"Russian Federation"`). */
  aliases?: string[];
}

export const BANNED_COUNTRIES: readonly BannedCountry[] = [
  { code: 'BY', name: 'Belarus' },
  { code: 'RU', name: 'Russia', aliases: ['Russian Federation'] },
];

/** ISO alpha-2 codes of every banned country. Used to filter the map overlay. */
export const BANNED_COUNTRY_CODES: ReadonlySet<string> = new Set(
  BANNED_COUNTRIES.map((c) => c.code.toUpperCase()),
);

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

const BANNED_NAMES: ReadonlySet<string> = new Set(
  BANNED_COUNTRIES.flatMap((c) => [c.name, ...(c.aliases ?? [])]).map(normalizeName),
);

/** True when `code` is the alpha-2 code of a banned country (case-insensitive). */
export function isBannedCountryCode(code: string | undefined | null): boolean {
  return typeof code === 'string' && BANNED_COUNTRY_CODES.has(code.trim().toUpperCase());
}

/** True when `name` is the name (or a known alias) of a banned country. */
export function isBannedCountryName(name: string | undefined | null): boolean {
  return typeof name === 'string' && BANNED_NAMES.has(normalizeName(name));
}

/**
 * True when a place belongs to a banned country. `place.country` may be an ISO
 * code (bundled cities) or a full name (searched/pinned/trip places), so both
 * forms are checked. Pass a raw country string via {@link isBannedCountry}.
 */
export function isBannedPlace(place: Pick<Place, 'country'>): boolean {
  return isBannedCountry(place.country);
}

/** True when a raw country value (code or name) belongs to a banned country. */
export function isBannedCountry(country: string | undefined | null): boolean {
  return isBannedCountryCode(country) || isBannedCountryName(country);
}

/** A place's country as an uppercase code candidate: prefer `countryCode`, fall
 * back to `country` (which IS the code for bundled cities). "" when unknown. */
export function codeOf(place: { country?: string; countryCode?: string }): string {
  return (place.countryCode ?? place.country ?? '').trim().toUpperCase();
}

/**
 * The full set of banned codes = the built-in list plus the user's own picks.
 * `userCodes` are normalized to uppercase. Used to shade the map and to filter
 * by code. See [[where-sunny-features]] for the user-curated ban list.
 */
export function effectiveBannedCodes(userCodes: Iterable<string>): Set<string> {
  const codes = new Set(BANNED_COUNTRY_CODES);
  for (const code of userCodes) {
    if (typeof code === 'string' && code.trim()) codes.add(code.trim().toUpperCase());
  }
  return codes;
}

/**
 * True when a place is banned under the effective list (built-in ∪ user). The
 * built-in match is by code or name; the user match is by code, which every
 * geocoded/pinned place carries via `countryCode` (cities carry it in `country`).
 */
export function isEffectivelyBanned(
  place: { country?: string; countryCode?: string },
  userCodes: ReadonlySet<string>,
): boolean {
  return (
    isBannedCountry(place.country) ||
    isBannedCountryCode(place.countryCode) ||
    userCodes.has(codeOf(place))
  );
}
