/**
 * Destination currency and exchange rates for the practical info row.
 *
 * Country→currency starts from the bundled ISO 3166 → ISO 4217 map in
 * core/currency (built for flight price links) and fills in the remaining ISO
 * territories here, so every officially assigned alpha-2 code resolves. The
 * eurozone (plus adopters like AD/MC/SM/VA/XK) all collapse to EUR, and tiny
 * territories map to the currency they actually price in (e.g. GF/RE → EUR,
 * BQ → USD). Antarctica (AQ) has no currency and deliberately stays unmapped.
 *
 * Rates come from the free, no-key, CORS-enabled Frankfurter API (daily ECB
 * reference rates): https://api.frankfurter.dev/v1/latest?base=EUR&symbols=CZK
 * — verified live; the older api.frankfurter.app host now 301-redirects to
 * .dev. Frankfurter only quotes the ~30 currencies the ECB publishes
 * ({@link FRANKFURTER_CURRENCIES}, verified via /v1/currencies), so
 * unsupported pairs resolve to null and the UI stays silent instead of
 * erroring.
 */

import { COUNTRY_CURRENCY } from '../currency';

const API_URL = 'https://api.frankfurter.dev/v1/latest';

/**
 * ISO territories the flight-links map skips (no airports worth pricing).
 * Together with {@link COUNTRY_CURRENCY} this completes ISO 3166 coverage.
 */
/* prettier-ignore */
const TERRITORY_CURRENCY: Record<string, string> = {
  AS: 'USD', AX: 'EUR', BL: 'EUR', BQ: 'USD', BV: 'NOK', EH: 'MAD',
  GF: 'EUR', GP: 'EUR', GS: 'GBP', HM: 'AUD', IO: 'USD', MF: 'EUR',
  MP: 'USD', MQ: 'EUR', NF: 'AUD', PM: 'EUR', PS: 'ILS', RE: 'EUR',
  SH: 'SHP', SJ: 'NOK', SY: 'SYP', TC: 'USD', TF: 'EUR', UM: 'USD',
  VG: 'USD', YE: 'YER', YT: 'EUR',
};

/** ISO 3166-1 alpha-2 → ISO 4217, complete (every assigned code except AQ). */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  ...COUNTRY_CURRENCY,
  ...TERRITORY_CURRENCY,
};

/**
 * Every currency Frankfurter can quote (ECB reference set). Fetched live from
 * https://api.frankfurter.dev/v1/currencies on 2026-07-15.
 */
/* prettier-ignore */
export const FRANKFURTER_CURRENCIES: ReadonlySet<string> = new Set([
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
  'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
  'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]);

/**
 * The currency a traveler pays with in a country, or null when the code is
 * unknown/unmapped (including full country names, which pinned places carry
 * in `country` — callers stay silent on null).
 */
export function destinationCurrency(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  return COUNTRY_TO_CURRENCY[countryCode.trim().toUpperCase()] ?? null;
}

/**
 * True when a rate lookup is worth a network call: different currencies and
 * both quoted by Frankfurter. Same-currency trips and exotic pairs skip the
 * fetch entirely.
 */
export function isConvertiblePair(from: string, to: string): boolean {
  return from !== to && FRANKFURTER_CURRENCIES.has(from) && FRANKFURTER_CURRENCIES.has(to);
}

/** One ECB reference rate: 1 {base} = {rate} {quote}, fixed on {date}. */
export interface ExchangeRate {
  base: string;
  quote: string;
  rate: number;
  /** YYYY-MM-DD of the ECB fixing the rate belongs to. */
  date: string;
}

export interface ExchangeRateFetchOptions {
  fetchImpl?: typeof fetch;
}

interface FrankfurterResponse {
  date?: string;
  rates?: Record<string, number>;
}

/**
 * The current ECB rate for a pair, or null when the pair is not convertible
 * (checked before any network call) or the response has no usable rate. Only
 * genuine server errors throw, so TanStack Query still retries those.
 */
export async function fetchExchangeRate(
  from: string,
  to: string,
  opts: ExchangeRateFetchOptions = {},
): Promise<ExchangeRate | null> {
  const { fetchImpl = fetch } = opts;
  if (!isConvertiblePair(from, to)) return null;
  const res = await fetchImpl(`${API_URL}?base=${from}&symbols=${to}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Exchange rate request failed: HTTP ${res.status}`);
  const json = (await res.json()) as FrankfurterResponse | null;
  const rate = json?.rates?.[to];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
  return { base: from, quote: to, rate, date: json?.date ?? '' };
}

/**
 * A rate at glanceable precision: 3 significant digits ("26.4", "0.912",
 * "184"), matching how travelers actually round money in their head.
 */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 }).format(rate);
}
