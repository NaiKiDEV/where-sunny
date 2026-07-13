import { describe, expect, test } from 'vitest';
import {
  COUNTRY_CURRENCY,
  currencyLabel,
  currencyName,
  DEFAULT_CURRENCY,
  inferCurrency,
  searchCurrencies,
  SELECTABLE_CURRENCIES,
} from './currency';

describe('COUNTRY_CURRENCY', () => {
  test('maps representative countries to their currency', () => {
    expect(COUNTRY_CURRENCY.DE).toBe('EUR');
    expect(COUNTRY_CURRENCY.GB).toBe('GBP');
    expect(COUNTRY_CURRENCY.US).toBe('USD');
    expect(COUNTRY_CURRENCY.JP).toBe('JPY');
    expect(COUNTRY_CURRENCY.BR).toBe('BRL');
  });
});

describe('SELECTABLE_CURRENCIES', () => {
  test('is a sorted, de-duplicated list that includes the default', () => {
    const sorted = [...SELECTABLE_CURRENCIES].sort();

    expect(SELECTABLE_CURRENCIES).toEqual(sorted);
    expect(new Set(SELECTABLE_CURRENCIES).size).toBe(SELECTABLE_CURRENCIES.length);
    expect(SELECTABLE_CURRENCIES).toContain(DEFAULT_CURRENCY);
    expect(SELECTABLE_CURRENCIES).toContain('EUR');
  });
});

describe('inferCurrency', () => {
  test('resolves a full locale tag to its region currency', () => {
    expect(inferCurrency(['de-DE'])).toBe('EUR');
    expect(inferCurrency(['en-US'])).toBe('USD');
    expect(inferCurrency(['pt-BR'])).toBe('BRL');
  });

  test('maximizes bare language tags to a likely region', () => {
    expect(inferCurrency(['ja'])).toBe('JPY');
    expect(inferCurrency(['ko'])).toBe('KRW');
  });

  test('falls through to the first locale that maps', () => {
    expect(inferCurrency(['eo', 'fr-FR'])).toBe('EUR');
  });

  test('returns null when nothing maps', () => {
    expect(inferCurrency([])).toBeNull();
    expect(inferCurrency(['eo'])).toBeNull();
  });

  test('skips malformed tags instead of throwing', () => {
    expect(inferCurrency(['not a locale!!', 'en-GB'])).toBe('GBP');
  });
});

describe('currencyLabel', () => {
  test('prefixes the code and never loses it', () => {
    expect(currencyLabel('EUR')).toMatch(/^EUR/);
    expect(currencyLabel('USD')).toMatch(/^USD/);
  });
});

describe('currencyName', () => {
  test('returns the localized name without the code', () => {
    expect(currencyName('EUR')).toMatch(/euro/i);
    expect(currencyName('EUR')).not.toMatch(/EUR\b.*EUR/);
  });

  test('returns null for codes ICU cannot name', () => {
    expect(currencyName('ZZZ')).toBeNull();
  });
});

describe('searchCurrencies', () => {
  test('returns the full list for an empty or blank query', () => {
    expect(searchCurrencies('')).toEqual(SELECTABLE_CURRENCIES);
    expect(searchCurrencies('   ')).toEqual(SELECTABLE_CURRENCIES);
  });

  test('matches by code, case-insensitively', () => {
    expect(searchCurrencies('gbp')).toContain('GBP');
    expect(searchCurrencies('EUR')).toContain('EUR');
  });

  test('matches by localized currency name', () => {
    expect(searchCurrencies('yen')).toContain('JPY');
    expect(searchCurrencies('krone')).toContain('DKK');
  });

  test('returns an empty list when nothing matches', () => {
    expect(searchCurrencies('xyzzy-not-a-currency')).toEqual([]);
  });

  test('keeps results in the selector order', () => {
    const results = searchCurrencies('dollar');
    const sorted = [...results].sort();
    expect(results).toEqual(sorted);
  });
});
