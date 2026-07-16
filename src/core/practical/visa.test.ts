import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadVisaSummary,
  parseCsvRequirement,
  parseVisaFile,
  resetVisaSummaryCache,
  visaForDestination,
  visaLabel,
  type VisaSummary,
} from './visa';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const FILE = {
  v: 1,
  generated: '2026-07-16',
  passport: 'CZ',
  destinations: { JP: { cat: 'vf', days: 90 }, US: { cat: 'eta' }, AF: { cat: 'vr' } },
};

describe('parseCsvRequirement', () => {
  it('parses numeric values as visa-free days', () => {
    expect(parseCsvRequirement('90')).toEqual({ cat: 'vf', days: 90 });
    expect(parseCsvRequirement('360')).toEqual({ cat: 'vf', days: 360 });
  });

  it('maps every named category', () => {
    expect(parseCsvRequirement('visa free')).toEqual({ cat: 'vf' });
    expect(parseCsvRequirement('visa on arrival')).toEqual({ cat: 'voa' });
    expect(parseCsvRequirement('e-visa')).toEqual({ cat: 'ev' });
    expect(parseCsvRequirement('eta')).toEqual({ cat: 'eta' });
    expect(parseCsvRequirement('visa required')).toEqual({ cat: 'vr' });
    expect(parseCsvRequirement('no admission')).toEqual({ cat: 'na' });
  });

  it('resolves the -1 same-country marker to null', () => {
    expect(parseCsvRequirement('-1')).toBeNull();
  });

  it('throws on unexpected categories instead of guessing', () => {
    expect(() => parseCsvRequirement('visa maybe')).toThrow(/Unexpected visa requirement/);
    expect(() => parseCsvRequirement('')).toThrow(/Unexpected visa requirement/);
  });
});

describe('visaLabel', () => {
  it('joins visa-free with the stay length when known', () => {
    expect(visaLabel({ cat: 'vf', days: 90 })).toBe('Visa-free · 90 days');
    expect(visaLabel({ cat: 'vf' })).toBe('Visa-free');
  });

  it('labels every category', () => {
    expect(visaLabel({ cat: 'voa' })).toBe('Visa on arrival');
    expect(visaLabel({ cat: 'ev' })).toBe('eVisa needed');
    expect(visaLabel({ cat: 'eta' })).toBe('eTA needed');
    expect(visaLabel({ cat: 'vr' })).toBe('Visa required');
    expect(visaLabel({ cat: 'na' })).toBe('Entry restricted');
  });
});

describe('parseVisaFile', () => {
  it('accepts a valid file', () => {
    expect(parseVisaFile(FILE)).toEqual({
      generated: '2026-07-16',
      destinations: FILE.destinations,
    });
  });

  it('throws on malformed file shapes', () => {
    expect(() => parseVisaFile(null)).toThrow(/Invalid visa file/);
    expect(() => parseVisaFile({ v: 1, destinations: {} })).toThrow(/Invalid visa file/);
    expect(() => parseVisaFile({ v: 1, generated: '2026-07-16' })).toThrow(/Invalid visa file/);
  });

  it('rejects malformed entries without blanking the rest', () => {
    const parsed = parseVisaFile({
      v: 1,
      generated: '2026-07-16',
      destinations: {
        JP: { cat: 'vf', days: 90 },
        XX: { cat: 'free-for-all' },
        YY: { cat: 'vf', days: -3 },
        Japan: { cat: 'vf' },
      },
    });
    expect(Object.keys(parsed.destinations)).toEqual(['JP']);
  });
});

describe('visaForDestination', () => {
  const summary: VisaSummary = parseVisaFile(FILE);

  it('returns the requirement for a known destination', () => {
    expect(visaForDestination(summary, 'CZ', 'JP')).toEqual({ cat: 'vf', days: 90 });
    expect(visaForDestination(summary, 'CZ', ' us ')).toEqual({ cat: 'eta' });
  });

  it('returns null for unknown destinations and non-codes', () => {
    expect(visaForDestination(summary, 'CZ', 'ZZ')).toBeNull();
    expect(visaForDestination(summary, 'CZ', 'JAPAN')).toBeNull();
    expect(visaForDestination(summary, 'CZ', null)).toBeNull();
    expect(visaForDestination(summary, 'CZ', '')).toBeNull();
  });

  it('returns null for the passport country itself', () => {
    expect(visaForDestination(summary, 'CZ', 'CZ')).toBeNull();
    expect(visaForDestination(summary, 'cz', 'CZ')).toBeNull();
  });
});

describe('loadVisaSummary', () => {
  beforeEach(() => {
    resetVisaSummaryCache();
  });

  it('fetches one passport file from the visa directory', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(FILE)));
    const summary = await loadVisaSummary('cz', { baseUrl: '/data/visa/', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/data/visa/CZ.json');
    expect(summary?.destinations.JP).toEqual({ cat: 'vf', days: 90 });
  });

  it('fetches each passport at most once and serves the cache after', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(FILE)));
    const first = await loadVisaSummary('CZ', { baseUrl: '/data/visa/', fetchImpl });
    const second = await loadVisaSummary('cz', { baseUrl: '/data/visa/', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('fetches different passports separately', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(FILE)));
    await loadVisaSummary('CZ', { baseUrl: '/data/visa/', fetchImpl });
    await loadVisaSummary('DE', { baseUrl: '/data/visa/', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('resolves null without fetching for implausible codes', async () => {
    const fetchImpl = vi.fn();
    await expect(loadVisaSummary('', { fetchImpl })).resolves.toBeNull();
    await expect(loadVisaSummary('Czechia', { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('resolves null on 404 (passport not in the dataset)', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({}, 404)));
    await expect(loadVisaSummary('ZZ', { baseUrl: '/data/visa/', fetchImpl })).resolves.toBeNull();
  });

  it('evicts failures so a transient error can be retried', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({}, 500)))
      .mockImplementation(() => Promise.resolve(jsonResponse(FILE)));
    await expect(loadVisaSummary('CZ', { baseUrl: '/data/visa/', fetchImpl })).rejects.toThrow(
      /HTTP 500/,
    );
    await expect(
      loadVisaSummary('CZ', { baseUrl: '/data/visa/', fetchImpl }),
    ).resolves.not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
