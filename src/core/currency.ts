/**
 * Currency preference for flight price links (docs/FLIGHT-LINKS.md). Maps
 * countries to their transaction currency and infers a default from the
 * device locale - the closest thing a static frontend has to "the user's
 * currency" without asking. Unknown or unmappable locales fall back to
 * {@link DEFAULT_CURRENCY}.
 */

export const DEFAULT_CURRENCY = 'USD';

function withCurrency(countries: string[], currency: string): Record<string, string> {
  return Object.fromEntries(countries.map((country) => [country, currency]));
}

/* prettier-ignore */
const EUROZONE = [
  'AD', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK', 'SM', 'VA', 'XK',
];

/**
 * ISO 3166-1 alpha-2 → ISO 4217. Covers everywhere the airport dataset can
 * realistically send someone; tiny territories are folded into the currency
 * they actually price in.
 */
export const COUNTRY_CURRENCY: Record<string, string> = {
  ...withCurrency(EUROZONE, 'EUR'),
  ...withCurrency(['US', 'EC', 'SV', 'PA', 'PR', 'GU', 'VI', 'TL', 'FM', 'MH', 'PW'], 'USD'),
  ...withCurrency(['GB', 'IM', 'JE', 'GG', 'GI'], 'GBP'),
  ...withCurrency(['CH', 'LI'], 'CHF'),
  ...withCurrency(['DK', 'FO', 'GL'], 'DKK'),
  ...withCurrency(['AG', 'AI', 'DM', 'GD', 'KN', 'LC', 'MS', 'VC'], 'XCD'),
  ...withCurrency(['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'], 'XOF'),
  ...withCurrency(['CM', 'CF', 'CG', 'GA', 'GQ', 'TD'], 'XAF'),
  ...withCurrency(['NC', 'PF', 'WF'], 'XPF'),
  ...withCurrency(['AU', 'CX', 'CC', 'KI', 'NR', 'TV'], 'AUD'),
  ...withCurrency(['NZ', 'CK', 'NU', 'PN', 'TK'], 'NZD'),
  // Europe (non-euro)
  SE: 'SEK', NO: 'NOK', IS: 'ISK',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN',
  RS: 'RSD', BA: 'BAM', MK: 'MKD', AL: 'ALL', MD: 'MDL',
  UA: 'UAH', BY: 'BYN', RU: 'RUB', TR: 'TRY',
  GE: 'GEL', AM: 'AMD', AZ: 'AZN',
  // Middle East & North Africa
  IL: 'ILS', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
  JO: 'JOD', LB: 'LBP', IQ: 'IQD', IR: 'IRR',
  EG: 'EGP', MA: 'MAD', TN: 'TND', DZ: 'DZD', LY: 'LYD',
  // Sub-Saharan Africa
  ZA: 'ZAR', NA: 'NAD', BW: 'BWP', ZM: 'ZMW', MZ: 'MZN', MW: 'MWK', AO: 'AOA',
  NG: 'NGN', GH: 'GHS', KE: 'KES', TZ: 'TZS', UG: 'UGX', RW: 'RWF', ET: 'ETB',
  MU: 'MUR', SC: 'SCR', MG: 'MGA', CD: 'CDF', GM: 'GMD', SL: 'SLE', LR: 'LRD',
  CV: 'CVE', ST: 'STN', DJ: 'DJF', SO: 'SOS', SD: 'SDG', SS: 'SSP', ER: 'ERN',
  BI: 'BIF', KM: 'KMF', GN: 'GNF', MR: 'MRU', LS: 'LSL', SZ: 'SZL', ZW: 'ZWG',
  // South & Central Asia
  IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', BT: 'BTN', MV: 'MVR',
  KZ: 'KZT', UZ: 'UZS', KG: 'KGS', TJ: 'TJS', TM: 'TMT', AF: 'AFN',
  // East & Southeast Asia
  CN: 'CNY', HK: 'HKD', MO: 'MOP', TW: 'TWD', JP: 'JPY', KR: 'KRW', MN: 'MNT',
  TH: 'THB', VN: 'VND', PH: 'PHP', ID: 'IDR', MY: 'MYR', SG: 'SGD',
  KH: 'KHR', LA: 'LAK', MM: 'MMK', BN: 'BND', KP: 'KPW',
  // Oceania
  FJ: 'FJD', PG: 'PGK', WS: 'WST', TO: 'TOP', VU: 'VUV', SB: 'SBD',
  // Americas
  CA: 'CAD', MX: 'MXN', GT: 'GTQ', HN: 'HNL', NI: 'NIO', CR: 'CRC', BZ: 'BZD',
  DO: 'DOP', HT: 'HTG', JM: 'JMD', TT: 'TTD', BB: 'BBD', BS: 'BSD', CU: 'CUP',
  KY: 'KYD', BM: 'BMD', AW: 'AWG', CW: 'ANG', SX: 'ANG',
  CO: 'COP', VE: 'VES', GY: 'GYD', SR: 'SRD', BR: 'BRL', PE: 'PEN', BO: 'BOB',
  PY: 'PYG', UY: 'UYU', AR: 'ARS', CL: 'CLP', FK: 'FKP',
};

/** Every currency the map can produce - the selector's option list. */
export const SELECTABLE_CURRENCIES: string[] = [
  ...new Set(Object.values(COUNTRY_CURRENCY)),
].sort();

/**
 * Best-guess currency from the device locale(s): take each tag's region
 * (maximized, so a bare "ja" still resolves to JP) and look it up. Null when
 * nothing maps - callers fall back to {@link DEFAULT_CURRENCY}.
 */
export function inferCurrency(locales?: readonly string[]): string | null {
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
      const currency = region ? COUNTRY_CURRENCY[region] : undefined;
      if (currency) return currency;
    } catch {
      // Malformed tag - try the next one.
    }
  }
  return null;
}

let displayNames: Intl.DisplayNames | null = null;

/** Localized currency name ("Euro"), or null where ICU has nothing beyond the code. */
export function currencyName(code: string): string | null {
  try {
    displayNames ??= new Intl.DisplayNames(undefined, { type: 'currency' });
    const name = displayNames.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/** "EUR - Euro" (localized name via Intl), or just the code where ICU lacks it. */
export function currencyLabel(code: string): string {
  const name = currencyName(code);
  return name ? `${code} - ${name}` : code;
}

/**
 * Case-insensitive filter over {@link SELECTABLE_CURRENCIES}, matching against
 * both the code ("gbp") and the localized name ("pound"). A blank query keeps
 * the full list so the picker can double as a plain browse list.
 */
export function searchCurrencies(query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SELECTABLE_CURRENCIES;
  return SELECTABLE_CURRENCIES.filter((code) =>
    `${code} ${currencyName(code) ?? ''}`.toLowerCase().includes(needle),
  );
}
