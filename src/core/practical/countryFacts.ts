/**
 * On-the-ground country facts for the practical info row: power plugs +
 * voltage, driving side, and the emergency number.
 *
 * The dataset is bundled at build time by scripts/build-country-facts.mjs
 * (public/data/country-facts.json) and diffed against the traveler's home
 * country so the chips are silence-by-default: plugs only when none of the
 * destination's sockets take home's plugs (or the voltage crosses the
 * 110-127 V / 220-240 V band boundary - the difference that fries devices),
 * driving side only when opposite, emergency number always (it is the one fact
 * you never want to look up in the moment). Same country as home renders
 * nothing at all.
 *
 * Home country = the origin's country code when it carries one, else the
 * device locale's region - the same trick as inferCurrency in core/currency.
 */

import { codeOf } from '../bannedCountries';

const ISO2_RE = /^[A-Z]{2}$/;
const PLUG_RE = /^[A-O]$/;
const EMERGENCY_RE = /^\d{2,6}$/;

/** Nominal voltages up to here are the 100-127 V band; above is 220-240 V. */
const LOW_VOLTAGE_BAND_MAX = 170;

export interface CountryFacts {
  /** IEC plug letters (A-O), e.g. ['C', 'F']. */
  plugs: string[];
  /** Nominal mains voltage (100-240). */
  voltage: number;
  drive: 'right' | 'left';
  /** Primary all-purpose emergency number(s), else the police number. */
  emergency: string[];
}

/** Uppercase ISO 3166-1 alpha-2 -> facts, as parsed from the bundled dataset. */
export type CountryFactsMap = Record<string, CountryFacts>;

function isCountryFacts(value: unknown): value is CountryFacts {
  if (typeof value !== 'object' || value === null) return false;
  const facts = value as Partial<CountryFacts>;
  return (
    Array.isArray(facts.plugs) &&
    facts.plugs.length > 0 &&
    facts.plugs.every((p) => typeof p === 'string' && PLUG_RE.test(p)) &&
    typeof facts.voltage === 'number' &&
    Number.isFinite(facts.voltage) &&
    facts.voltage >= 100 &&
    facts.voltage <= 240 &&
    (facts.drive === 'right' || facts.drive === 'left') &&
    Array.isArray(facts.emergency) &&
    facts.emergency.length > 0 &&
    facts.emergency.every((n) => typeof n === 'string' && EMERGENCY_RE.test(n))
  );
}

/**
 * Validated parse of the bundled dataset. A malformed dataset shape throws
 * (regenerate with `pnpm setup:data`); a malformed individual entry is
 * rejected quietly so one bad row can never blank the whole feature.
 */
export function parseCountryFacts(json: unknown): CountryFactsMap {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Invalid country facts dataset - regenerate with `pnpm setup:data`');
  }
  const dataset = json as { v?: unknown; facts?: unknown };
  if (
    typeof dataset.v !== 'number' ||
    dataset.v < 1 ||
    typeof dataset.facts !== 'object' ||
    dataset.facts === null
  ) {
    throw new Error('Invalid country facts dataset - regenerate with `pnpm setup:data`');
  }
  const facts: CountryFactsMap = {};
  for (const [code, entry] of Object.entries(dataset.facts)) {
    if (!ISO2_RE.test(code) || !isCountryFacts(entry)) continue;
    facts[code] = entry;
  }
  return facts;
}

export async function fetchCountryFacts(
  url = `${import.meta.env.BASE_URL}data/country-facts.json`,
  fetchImpl: typeof fetch = fetch,
): Promise<CountryFactsMap> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Failed to load country facts: HTTP ${res.status}`);
  return parseCountryFacts(await res.json());
}

/**
 * The traveler's home country: the origin's code when it carries one
 * (countryCode, or country when it already is a code), else the first device
 * locale that maximizes to a real region (same trick as inferCurrency - a bare
 * 'ja' still resolves to JP). Null when nothing resolves.
 */
export function homeCountryCode(
  origin: { label?: string; country?: string; countryCode?: string } | null | undefined,
  locales?: readonly string[],
): string | null {
  const fromOrigin = origin ? codeOf(origin) : '';
  if (ISO2_RE.test(fromOrigin)) return fromOrigin;
  const candidates =
    locales ??
    (typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language]);
  for (const tag of candidates) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region && ISO2_RE.test(region)) return region;
    } catch {
      // Malformed tag - try the next one.
    }
  }
  return null;
}

/** One country's side of the diff: its code plus its dataset entry (if any). */
export interface CountrySide {
  code: string | null;
  facts: CountryFacts | null;
}

export interface FactsToShow {
  /** Adapter row - null when home plugs fit and the voltage band matches. */
  plugs: { types: string[]; voltage: number } | null;
  /** Destination side - null when it matches home's. */
  drive: 'right' | 'left' | null;
  /** Always present when the block renders. */
  emergency: string[];
}

function voltageBand(voltage: number): 'low' | 'high' {
  return voltage <= LOW_VOLTAGE_BAND_MAX ? 'low' : 'high';
}

/**
 * The silence-by-default diff gate. Null (whole block hidden) when the
 * destination is unknown, home is unknown, or destination == home. Otherwise
 * the emergency number always shows; plugs and driving side only when they
 * genuinely differ from home. When home's facts are missing the diff cannot be
 * established, so only the emergency number shows.
 */
export function factsToShow(dest: CountrySide, home: CountrySide): FactsToShow | null {
  const destCode = dest.code?.trim().toUpperCase() ?? '';
  const homeCode = home.code?.trim().toUpperCase() ?? '';
  if (!ISO2_RE.test(destCode) || !dest.facts || !ISO2_RE.test(homeCode)) return null;
  if (destCode === homeCode) return null;

  const destFacts = dest.facts;
  const homeFacts = home.facts;
  const plugsDisjoint = homeFacts
    ? !destFacts.plugs.some((plug) => homeFacts.plugs.includes(plug))
    : false;
  const voltageDiffers = homeFacts
    ? voltageBand(destFacts.voltage) !== voltageBand(homeFacts.voltage)
    : false;

  return {
    plugs:
      plugsDisjoint || voltageDiffers
        ? { types: destFacts.plugs, voltage: destFacts.voltage }
        : null,
    drive: homeFacts && homeFacts.drive !== destFacts.drive ? destFacts.drive : null,
    emergency: destFacts.emergency,
  };
}
