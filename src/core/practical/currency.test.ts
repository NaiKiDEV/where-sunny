import { describe, expect, it, vi } from 'vitest';
import {
  COUNTRY_TO_CURRENCY,
  FRANKFURTER_CURRENCIES,
  destinationCurrency,
  fetchExchangeRate,
  formatRate,
  isConvertiblePair,
} from './currency';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Every officially assigned ISO 3166-1 alpha-2 code (249). */
/* prettier-ignore */
const ISO_3166_ALPHA2 = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ ' +
  'BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR ' +
  'CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ' +
  'ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ ' +
  'LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ ' +
  'MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF ' +
  'PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI ' +
  'SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR ' +
  'TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

describe('COUNTRY_TO_CURRENCY', () => {
  it('covers every assigned ISO 3166 code except Antarctica', () => {
    for (const code of ISO_3166_ALPHA2) {
      if (code === 'AQ') continue; // no currency, deliberately unmapped
      expect(COUNTRY_TO_CURRENCY[code], code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('collapses the eurozone and EUR adopters to EUR', () => {
    for (const code of ['FR', 'DE', 'ES', 'IT', 'AD', 'MC', 'VA', 'AX', 'GF', 'RE']) {
      expect(COUNTRY_TO_CURRENCY[code], code).toBe('EUR');
    }
  });

  it('maps territories to the currency they price in', () => {
    expect(COUNTRY_TO_CURRENCY.BQ).toBe('USD'); // Caribbean Netherlands uses USD
    expect(COUNTRY_TO_CURRENCY.EH).toBe('MAD');
    expect(COUNTRY_TO_CURRENCY.SJ).toBe('NOK');
    expect(COUNTRY_TO_CURRENCY.PS).toBe('ILS');
  });
});

describe('destinationCurrency', () => {
  it('looks up codes case-insensitively with whitespace tolerance', () => {
    expect(destinationCurrency('cz')).toBe('CZK');
    expect(destinationCurrency(' JP ')).toBe('JPY');
  });

  it('returns null for unknown codes, full names, and empty input', () => {
    expect(destinationCurrency('ZZ')).toBeNull();
    expect(destinationCurrency('France')).toBeNull();
    expect(destinationCurrency('')).toBeNull();
    expect(destinationCurrency(null)).toBeNull();
    expect(destinationCurrency(undefined)).toBeNull();
    expect(destinationCurrency('AQ')).toBeNull();
  });
});

describe('isConvertiblePair', () => {
  it('rejects same-currency pairs so no fetch is wasted', () => {
    expect(isConvertiblePair('EUR', 'EUR')).toBe(false);
  });

  it('rejects pairs Frankfurter does not quote', () => {
    expect(isConvertiblePair('EUR', 'VND')).toBe(false);
    expect(isConvertiblePair('EGP', 'EUR')).toBe(false);
  });

  it('accepts two distinct quoted currencies', () => {
    expect(isConvertiblePair('EUR', 'CZK')).toBe(true);
    expect(isConvertiblePair('USD', 'JPY')).toBe(true);
  });

  it('only whitelists the 30 ECB currencies', () => {
    expect(FRANKFURTER_CURRENCIES.size).toBe(30);
  });
});

describe('fetchExchangeRate', () => {
  const RESPONSE = { amount: 1.0, base: 'EUR', date: '2026-07-15', rates: { CZK: 24.233 } };

  it('parses the live response shape into a rate', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(RESPONSE));
    await expect(fetchExchangeRate('EUR', 'CZK', { fetchImpl })).resolves.toEqual({
      base: 'EUR',
      quote: 'CZK',
      rate: 24.233,
      date: '2026-07-15',
    });
  });

  it('requests the Frankfurter v1 endpoint with base and symbols', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(RESPONSE));
    await fetchExchangeRate('EUR', 'CZK', { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=CZK',
    );
  });

  it('returns null without fetching for non-convertible pairs', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchExchangeRate('EUR', 'EUR', { fetchImpl })).resolves.toBeNull();
    await expect(fetchExchangeRate('EUR', 'VND', { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null on 404 and on responses missing a usable rate', async () => {
    const notFound = vi.fn().mockResolvedValue(jsonResponse({ message: 'not found' }, 404));
    await expect(fetchExchangeRate('EUR', 'CZK', { fetchImpl: notFound })).resolves.toBeNull();

    const empty = vi.fn().mockResolvedValue(jsonResponse({ date: '2026-07-15', rates: {} }));
    await expect(fetchExchangeRate('EUR', 'CZK', { fetchImpl: empty })).resolves.toBeNull();

    const bogus = vi
      .fn()
      .mockResolvedValue(jsonResponse({ date: '2026-07-15', rates: { CZK: -1 } }));
    await expect(fetchExchangeRate('EUR', 'CZK', { fetchImpl: bogus })).resolves.toBeNull();
  });

  it('throws on a genuine server error so the query can retry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: true }, 500));
    await expect(fetchExchangeRate('EUR', 'CZK', { fetchImpl })).rejects.toThrow(/HTTP 500/);
  });
});

describe('formatRate', () => {
  it('rounds to 3 significant digits across magnitudes', () => {
    expect(formatRate(24.233)).toMatch(/^24[.,]2$/);
    expect(formatRate(0.91234)).toMatch(/^0[.,]912$/);
    expect(formatRate(184.6)).toBe('185');
  });
});
