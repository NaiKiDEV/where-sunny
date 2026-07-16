import { describe, expect, it, vi } from 'vitest';
import {
  factsToShow,
  fetchCountryFacts,
  homeCountryCode,
  parseCountryFacts,
  type CountryFacts,
} from './countryFacts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const CZ: CountryFacts = { plugs: ['C', 'E'], voltage: 230, drive: 'right', emergency: ['112'] };
const GB: CountryFacts = { plugs: ['G'], voltage: 230, drive: 'left', emergency: ['999'] };
const US: CountryFacts = { plugs: ['A', 'B'], voltage: 120, drive: 'right', emergency: ['911'] };
const PH: CountryFacts = { plugs: ['A', 'B', 'C'], voltage: 220, drive: 'right', emergency: ['911'] };
const DE: CountryFacts = { plugs: ['C', 'F'], voltage: 230, drive: 'right', emergency: ['112'] };

describe('parseCountryFacts', () => {
  it('accepts a valid dataset', () => {
    expect(parseCountryFacts({ v: 1, facts: { CZ, GB } })).toEqual({ CZ, GB });
  });

  it('throws on malformed dataset shapes', () => {
    expect(() => parseCountryFacts(null)).toThrow(/Invalid country facts/);
    expect(() => parseCountryFacts([])).toThrow(/Invalid country facts/);
    expect(() => parseCountryFacts({ facts: { CZ } })).toThrow(/Invalid country facts/);
    expect(() => parseCountryFacts({ v: 1 })).toThrow(/Invalid country facts/);
  });

  it('rejects malformed entries without blanking the rest', () => {
    const parsed = parseCountryFacts({
      v: 1,
      facts: {
        CZ,
        XX: { plugs: [], voltage: 230, drive: 'right', emergency: ['112'] },
        YY: { plugs: ['C'], voltage: 230, drive: 'up', emergency: ['112'] },
        ZZ: { plugs: ['C'], voltage: 999, drive: 'left', emergency: ['112'] },
        WW: { plugs: ['C'], voltage: 230, drive: 'left', emergency: [] },
        VV: { plugs: ['C'], voltage: 230, drive: 'left', emergency: ['dial 112'] },
        France: CZ,
      },
    });
    expect(Object.keys(parsed)).toEqual(['CZ']);
  });
});

describe('fetchCountryFacts', () => {
  it('parses the bundled file', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ v: 1, facts: { CZ } }));
    await expect(fetchCountryFacts('/data/country-facts.json', fetchImpl)).resolves.toEqual({ CZ });
    expect(fetchImpl).toHaveBeenCalledWith('/data/country-facts.json');
  });

  it('throws on an HTTP error so the query can retry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchCountryFacts('/data/country-facts.json', fetchImpl)).rejects.toThrow(
      /HTTP 500/,
    );
  });
});

describe('homeCountryCode', () => {
  it('prefers the origin countryCode when it carries one', () => {
    expect(homeCountryCode({ label: 'Prague', countryCode: 'cz' }, ['en-US'])).toBe('CZ');
  });

  it('accepts a bare country field that already is a code', () => {
    expect(homeCountryCode({ label: 'Prague', country: 'CZ' }, ['en-US'])).toBe('CZ');
  });

  it('falls back to the locale region when the origin has no usable code', () => {
    expect(homeCountryCode({ label: 'Home', country: 'Czechia' }, ['en-US'])).toBe('US');
    expect(homeCountryCode(null, ['fr-FR'])).toBe('FR');
  });

  it('maximizes bare language tags and skips malformed ones', () => {
    expect(homeCountryCode(null, ['ja'])).toBe('JP');
    expect(homeCountryCode(null, ['not a tag!', 'de-DE'])).toBe('DE');
  });

  it('returns null when nothing resolves', () => {
    expect(homeCountryCode(null, [])).toBeNull();
  });
});

describe('factsToShow', () => {
  it('hides the whole block for the home country itself', () => {
    expect(factsToShow({ code: 'CZ', facts: CZ }, { code: 'CZ', facts: CZ })).toBeNull();
  });

  it('hides the whole block when the destination or home is unknown', () => {
    expect(factsToShow({ code: null, facts: null }, { code: 'CZ', facts: CZ })).toBeNull();
    expect(factsToShow({ code: 'ZZ', facts: null }, { code: 'CZ', facts: CZ })).toBeNull();
    expect(factsToShow({ code: 'GB', facts: GB }, { code: null, facts: null })).toBeNull();
    expect(factsToShow({ code: 'FRANCE', facts: GB }, { code: 'CZ', facts: CZ })).toBeNull();
  });

  it('hides plugs when the sets overlap and shows them when disjoint', () => {
    // CZ (C, E) vs DE (C, F): C fits both - silent.
    expect(factsToShow({ code: 'DE', facts: DE }, { code: 'CZ', facts: CZ })?.plugs).toBeNull();
    // CZ vs GB: nothing fits - show the adapter row.
    expect(factsToShow({ code: 'GB', facts: GB }, { code: 'CZ', facts: CZ })?.plugs).toEqual({
      types: ['G'],
      voltage: 230,
    });
  });

  it('shows plugs on a voltage band difference even when the plugs fit', () => {
    // US (A/B, 120 V) vs PH (A/B/C, 220 V): the plug fits, the voltage fries.
    expect(factsToShow({ code: 'PH', facts: PH }, { code: 'US', facts: US })?.plugs).toEqual({
      types: ['A', 'B', 'C'],
      voltage: 220,
    });
  });

  it('shows the driving side only when opposite', () => {
    expect(factsToShow({ code: 'DE', facts: DE }, { code: 'CZ', facts: CZ })?.drive).toBeNull();
    expect(factsToShow({ code: 'GB', facts: GB }, { code: 'CZ', facts: CZ })?.drive).toBe('left');
    expect(factsToShow({ code: 'CZ', facts: CZ }, { code: 'GB', facts: GB })?.drive).toBe('right');
  });

  it('always includes the emergency number when the block renders', () => {
    expect(factsToShow({ code: 'DE', facts: DE }, { code: 'CZ', facts: CZ })?.emergency).toEqual([
      '112',
    ]);
  });

  it('shows only the emergency number when home facts are missing', () => {
    const shown = factsToShow({ code: 'GB', facts: GB }, { code: 'ZZ', facts: null });
    expect(shown).toEqual({ plugs: null, drive: null, emergency: ['999'] });
  });

  it('normalizes code casing before comparing', () => {
    expect(factsToShow({ code: 'cz', facts: CZ }, { code: ' CZ ', facts: CZ })).toBeNull();
  });
});
