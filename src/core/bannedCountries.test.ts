import { describe, expect, it } from 'vitest';
import type { Place } from './types';
import {
  BANNED_COUNTRY_CODES,
  codeOf,
  effectiveBannedCodes,
  isBannedCountry,
  isBannedCountryCode,
  isBannedCountryName,
  isBannedPlace,
  isEffectivelyBanned,
} from './bannedCountries';

function place(country: string): Place {
  return { key: 'x', kind: 'city', name: 'Somewhere', country, lat: 0, lon: 0, population: 0 };
}

describe('bannedCountries', () => {
  it('exposes the banned alpha-2 codes', () => {
    expect(BANNED_COUNTRY_CODES.has('BY')).toBe(true);
    expect(BANNED_COUNTRY_CODES.has('RU')).toBe(true);
    expect(BANNED_COUNTRY_CODES.has('LT')).toBe(false);
  });

  describe('isBannedCountryCode', () => {
    it('matches banned codes case-insensitively', () => {
      expect(isBannedCountryCode('BY')).toBe(true);
      expect(isBannedCountryCode('ru')).toBe(true);
      expect(isBannedCountryCode(' By ')).toBe(true);
    });

    it('rejects allowed codes, names, and empty input', () => {
      expect(isBannedCountryCode('LT')).toBe(false);
      expect(isBannedCountryCode('Belarus')).toBe(false);
      expect(isBannedCountryCode('')).toBe(false);
      expect(isBannedCountryCode(undefined)).toBe(false);
      expect(isBannedCountryCode(null)).toBe(false);
    });
  });

  describe('isBannedCountryName', () => {
    it('matches banned names and aliases case-insensitively', () => {
      expect(isBannedCountryName('Belarus')).toBe(true);
      expect(isBannedCountryName('russia')).toBe(true);
      expect(isBannedCountryName('Russian Federation')).toBe(true);
    });

    it('rejects allowed names and empty input', () => {
      expect(isBannedCountryName('Lithuania')).toBe(false);
      expect(isBannedCountryName('')).toBe(false);
      expect(isBannedCountryName(undefined)).toBe(false);
    });
  });

  describe('isBannedCountry / isBannedPlace', () => {
    it('blocks bundled-city places identified by ISO code', () => {
      expect(isBannedPlace(place('RU'))).toBe(true);
      expect(isBannedPlace(place('BY'))).toBe(true);
    });

    it('blocks searched/pinned places identified by full name', () => {
      expect(isBannedPlace(place('Russia'))).toBe(true);
      expect(isBannedPlace(place('Belarus'))).toBe(true);
    });

    it('allows places outside the banned set', () => {
      expect(isBannedPlace(place('LT'))).toBe(false);
      expect(isBannedPlace(place('Lithuania'))).toBe(false);
      expect(isBannedCountry('')).toBe(false);
    });
  });

  describe('codeOf', () => {
    it('prefers countryCode, falls back to country, uppercases and trims', () => {
      expect(codeOf({ countryCode: 'fr', country: 'France' })).toBe('FR');
      expect(codeOf({ country: 'lt' })).toBe('LT'); // bundled cities carry the code in `country`
      expect(codeOf({ country: ' pl ' })).toBe('PL');
      expect(codeOf({})).toBe('');
    });
  });

  describe('effectiveBannedCodes', () => {
    it('unions the built-in codes with the user picks, uppercased', () => {
      const codes = effectiveBannedCodes(['fr', 'PL']);
      expect(codes.has('BY')).toBe(true);
      expect(codes.has('RU')).toBe(true);
      expect(codes.has('FR')).toBe(true);
      expect(codes.has('PL')).toBe(true);
    });

    it('ignores blank/whitespace user entries', () => {
      const codes = effectiveBannedCodes(['', '   ']);
      expect(codes.has('BY')).toBe(true);
      expect(codes.size).toBe(BANNED_COUNTRY_CODES.size);
    });
  });

  describe('isEffectivelyBanned', () => {
    it('keeps blocking a built-in country with an empty user set', () => {
      const codes = effectiveBannedCodes([]);
      expect(isEffectivelyBanned({ country: 'RU' }, codes)).toBe(true);
      expect(isEffectivelyBanned({ country: 'Belarus' }, codes)).toBe(true);
    });

    it('blocks a user code on both a city place and a geocoded place', () => {
      const codes = effectiveBannedCodes(['FR']);
      expect(isEffectivelyBanned({ country: 'FR' }, codes)).toBe(true); // bundled city
      expect(isEffectivelyBanned({ countryCode: 'FR', country: 'France' }, codes)).toBe(true);
    });

    it('allows an unlisted country', () => {
      const codes = effectiveBannedCodes(['FR']);
      expect(isEffectivelyBanned({ countryCode: 'LT', country: 'Lithuania' }, codes)).toBe(false);
    });
  });
});
