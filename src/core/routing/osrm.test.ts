import { describe, expect, it, vi } from 'vitest';
import {
  buildDriveRouteUrl,
  driveCoordKey,
  fetchDriveRoute,
  isWithinDriveRange,
  parseDriveRoute,
} from './osrm';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const BERLIN = { lat: 52.52, lon: 13.405 };
const HAMBURG = { lat: 53.5511, lon: 9.9937 };
const BREMEN = { lat: 53.0793, lon: 8.8017 };
const ROME = { lat: 41.9028, lon: 12.4964 };
const NEW_YORK = { lat: 40.7128, lon: -74.006 };

// Verified live 2026-07-16: Berlin→Hamburg ≈ 181 min / 291 km, one leg.
const berlinHamburg = {
  code: 'Ok',
  routes: [{ duration: 10860, distance: 291000, legs: [{ duration: 10860, distance: 291000 }] }],
};

const threeStops = {
  code: 'Ok',
  routes: [
    {
      duration: 9000,
      distance: 155500,
      legs: [
        { duration: 6000, distance: 100000 },
        { duration: 3000, distance: 55500 },
      ],
    },
  ],
};

describe('buildDriveRouteUrl', () => {
  it('puts lon before lat (OSRM order) and keeps overview off', () => {
    const url = buildDriveRouteUrl([BERLIN, HAMBURG]);
    expect(url).toBe(
      'https://router.project-osrm.org/route/v1/driving/13.4050,52.5200;9.9937,53.5511?overview=false',
    );
  });

  it('rounds coordinates to 4 decimals', () => {
    const url = buildDriveRouteUrl([{ lat: 52.519951, lon: 13.405049 }, HAMBURG]);
    expect(url).toContain('13.4050,52.5200');
  });

  it('joins every waypoint of a multi-stop chain', () => {
    const url = buildDriveRouteUrl([BERLIN, HAMBURG, BREMEN]);
    expect(url).toContain('13.4050,52.5200;9.9937,53.5511;8.8017,53.0793');
  });

  it('throws on fewer than 2 coordinates', () => {
    expect(() => buildDriveRouteUrl([])).toThrow(/at least 2/);
    expect(() => buildDriveRouteUrl([BERLIN])).toThrow(/at least 2/);
  });

  it('throws on non-finite coordinates', () => {
    expect(() => buildDriveRouteUrl([{ lat: NaN, lon: 13.4 }, HAMBURG])).toThrow(/finite/);
    expect(() => buildDriveRouteUrl([BERLIN, { lat: 53.55, lon: Infinity }])).toThrow(/finite/);
  });
});

describe('driveCoordKey', () => {
  it('is stable across sub-rounding jitter (one cache entry per ~11 m)', () => {
    expect(driveCoordKey([{ lat: 52.52001, lon: 13.40501 }, HAMBURG])).toBe(
      driveCoordKey([BERLIN, HAMBURG]),
    );
  });
});

describe('isWithinDriveRange', () => {
  it('accepts a drivable pair and rejects flight territory', () => {
    expect(isWithinDriveRange([BERLIN, HAMBURG])).toBe(true);
    expect(isWithinDriveRange([BERLIN, NEW_YORK])).toBe(false);
  });

  it('sums the whole chain, not just the endpoints', () => {
    // Berlin→Rome→Berlin: endpoints are 0 km apart but the chain is ~2,360 km.
    expect(isWithinDriveRange([BERLIN, ROME])).toBe(true);
    expect(isWithinDriveRange([BERLIN, ROME, BERLIN])).toBe(false);
  });

  it('answers false (never throws) for short or malformed input', () => {
    expect(isWithinDriveRange([])).toBe(false);
    expect(isWithinDriveRange([BERLIN])).toBe(false);
    expect(isWithinDriveRange([BERLIN, { lat: NaN, lon: 9.99 }])).toBe(false);
  });
});

describe('parseDriveRoute', () => {
  it('maps seconds to minutes and meters to km with one decimal', () => {
    const route = parseDriveRoute(
      { code: 'Ok', routes: [{ duration: 90, distance: 1234, legs: [{ duration: 90, distance: 1234 }] }] },
      1,
    );
    expect(route).toEqual({ legs: [{ minutes: 2, km: 1.2 }], totalMinutes: 2, totalKm: 1.2 });
  });

  it('returns null for a shapeless payload', () => {
    expect(parseDriveRoute({}, 1)).toBeNull();
  });
});

describe('fetchDriveRoute', () => {
  it('fetches the built URL and returns legs plus totals', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(berlinHamburg)));
    const route = await fetchDriveRoute([BERLIN, HAMBURG], fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(buildDriveRouteUrl([BERLIN, HAMBURG]));
    expect(route).toEqual({
      legs: [{ minutes: 181, km: 291 }],
      totalMinutes: 181,
      totalKm: 291,
    });
  });

  it('returns one leg per consecutive pair for a multi-stop trip', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(threeStops)));
    const route = await fetchDriveRoute([BERLIN, HAMBURG, BREMEN], fetchImpl as typeof fetch);
    expect(route).toEqual({
      legs: [
        { minutes: 100, km: 100 },
        { minutes: 50, km: 55.5 },
      ],
      totalMinutes: 150,
      totalKm: 155.5,
    });
  });

  it('returns null when OSRM answers with a non-Ok code', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ code: 'NoRoute', routes: [] })));
    expect(await fetchDriveRoute([BERLIN, HAMBURG], fetchImpl as typeof fetch)).toBeNull();
  });

  it('returns null on a non-OK HTTP response', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ code: 'Ok' }, 500)));
    expect(await fetchDriveRoute([BERLIN, HAMBURG], fetchImpl as typeof fetch)).toBeNull();
  });

  it('returns null when routes are missing or empty', async () => {
    const noRoutes = vi.fn(() => Promise.resolve(jsonResponse({ code: 'Ok' })));
    expect(await fetchDriveRoute([BERLIN, HAMBURG], noRoutes as typeof fetch)).toBeNull();
    const emptyRoutes = vi.fn(() => Promise.resolve(jsonResponse({ code: 'Ok', routes: [] })));
    expect(await fetchDriveRoute([BERLIN, HAMBURG], emptyRoutes as typeof fetch)).toBeNull();
  });

  it('returns null when the leg count does not match the stop chain', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(berlinHamburg)));
    expect(await fetchDriveRoute([BERLIN, HAMBURG, BREMEN], fetchImpl as typeof fetch)).toBeNull();
  });

  it('returns null when the fetch itself rejects', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network down')));
    expect(await fetchDriveRoute([BERLIN, HAMBURG], fetchImpl as typeof fetch)).toBeNull();
  });

  it('throws (before any I/O) on boundary-invalid input', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchDriveRoute([BERLIN], fetchImpl as typeof fetch)).rejects.toThrow(
      /at least 2/,
    );
    await expect(
      fetchDriveRoute([BERLIN, { lat: NaN, lon: 9.99 }], fetchImpl as typeof fetch),
    ).rejects.toThrow(/finite/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
