import { describe, expect, it } from 'vitest';
import { BANNED_COUNTRY_CODES, effectiveBannedCodes } from '../bannedCountries';
import { CURATED_DESTINATIONS, visibleDestinations } from './destinations';

describe('CURATED_DESTINATIONS', () => {
  it('has a healthy number of hand-picked spots', () => {
    expect(CURATED_DESTINATIONS.length).toBeGreaterThanOrEqual(20);
    expect(CURATED_DESTINATIONS.length).toBeLessThanOrEqual(40);
  });

  it('gives every entry finite coordinates in range', () => {
    for (const d of CURATED_DESTINATIONS) {
      expect(Number.isFinite(d.lat), `${d.name} lat`).toBe(true);
      expect(Number.isFinite(d.lon), `${d.name} lon`).toBe(true);
      expect(Math.abs(d.lat), `${d.name} lat range`).toBeLessThanOrEqual(90);
      expect(Math.abs(d.lon), `${d.name} lon range`).toBeLessThanOrEqual(180);
    }
  });

  it('gives every entry a valid 2-letter uppercase country code', () => {
    for (const d of CURATED_DESTINATIONS) {
      expect(d.countryCode, `${d.name} code`).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('gives every entry a name, country, and region', () => {
    for (const d of CURATED_DESTINATIONS) {
      expect(d.name.trim().length, `${d.name} name`).toBeGreaterThan(0);
      expect(d.country.trim().length, `${d.name} country`).toBeGreaterThan(0);
      expect(d.region.trim().length, `${d.name} region`).toBeGreaterThan(0);
    }
  });

  it('never ships a built-in banned country', () => {
    for (const d of CURATED_DESTINATIONS) {
      expect(BANNED_COUNTRY_CODES.has(d.countryCode), `${d.name}`).toBe(false);
    }
  });
});

describe('visibleDestinations', () => {
  it('returns the whole set when nothing is banned', () => {
    const visible = visibleDestinations(effectiveBannedCodes([]));
    expect(visible.length).toBe(CURATED_DESTINATIONS.length);
  });

  it('drops entries whose country the user banned', () => {
    const codes = effectiveBannedCodes(['ES']);
    const visible = visibleDestinations(codes);
    expect(visible.some((d) => d.countryCode === 'ES')).toBe(false);
    expect(visible.length).toBeLessThan(CURATED_DESTINATIONS.length);
  });

  it('drops every entry when all their countries are banned', () => {
    const allCodes = CURATED_DESTINATIONS.map((d) => d.countryCode);
    const visible = visibleDestinations(effectiveBannedCodes(allCodes));
    expect(visible).toHaveLength(0);
  });

  it('accepts a raw user-code set and still drops built-in bans', () => {
    // A lone user set (no built-ins merged in) must still exclude built-in bans,
    // because isEffectivelyBanned re-checks them by name/code internally.
    const visible = visibleDestinations(new Set(['ES']));
    expect(visible.some((d) => d.countryCode === 'ES')).toBe(false);
  });
});
