import { describe, expect, it, vi } from 'vitest';
import { buildForecastUrl, chunkArray, fetchDailyForecasts } from './openMeteo';

const COORD_A = { lat: 54.687, lon: 25.28 };
const COORD_B = { lat: 55.7, lon: 21.13 };

function apiLocation(overrides: Record<string, unknown> = {}) {
  return {
    daily: {
      time: ['2026-07-10', '2026-07-11'],
      sunshine_duration: [30_000, 10_000],
      daylight_duration: [60_000, 60_000],
      cloud_cover_mean: [20, 80],
      precipitation_probability_max: [5, 60],
      temperature_2m_max: [24, 18],
      temperature_2m_min: [14, 11],
      weather_code: [1, 61],
      ...overrides,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('buildForecastUrl', () => {
  it('encodes coordinates as comma-separated lists with all daily vars', () => {
    const url = buildForecastUrl([COORD_A, COORD_B]);
    expect(url).toContain('latitude=54.687%2C55.700');
    expect(url).toContain('longitude=25.280%2C21.130');
    expect(url).toContain('sunshine_duration');
    expect(url).toContain('daylight_duration');
    expect(url).toContain('forecast_days=7');
    expect(url).toContain('timezone=auto');
  });

  it('encodes an explicit IANA timezone', () => {
    const url = buildForecastUrl([COORD_A], 7, 'Europe/Vilnius');
    expect(url).toContain('timezone=Europe%2FVilnius');
  });
});

describe('chunkArray', () => {
  it('splits into batches of the given size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkArray([], 100)).toEqual([]);
  });
});

describe('fetchDailyForecasts', () => {
  it('requests forecasts aggregated on the requester timezone, not timezone=auto', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([apiLocation()]));
    await fetchDailyForecasts([COORD_A], { fetchImpl });
    const url = fetchImpl.mock.calls[0][0] as string;
    expect(url).not.toContain('timezone=auto');
    expect(new URL(url).searchParams.get('timezone')).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it('returns forecasts in input order and maps fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([apiLocation(), apiLocation()]));
    const result = await fetchDailyForecasts([COORD_A, COORD_B], { fetchImpl });
    expect(result).toHaveLength(2);
    expect(result[0][0]).toEqual({
      date: '2026-07-10',
      sunshineDuration: 30_000,
      daylightDuration: 60_000,
      cloudCoverMean: 20,
      precipProbMax: 5,
      tempMax: 24,
      tempMin: 14,
      weatherCode: 1,
    });
  });

  it('normalizes a single-location object response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(apiLocation()));
    const result = await fetchDailyForecasts([COORD_A], { fetchImpl });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('estimates missing sunshine from cloud cover', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse([apiLocation({ sunshine_duration: [null, null] })]));
    const result = await fetchDailyForecasts([COORD_A], { fetchImpl });
    // daylight 60000 * (1 - 20/100) = 48000
    expect(result[0][0].sunshineDuration).toBe(48_000);
  });

  it('splits many coordinates into batches', async () => {
    const coords = Array.from({ length: 5 }, (_, i) => ({ lat: 50 + i, lon: 10 + i }));
    const fetchImpl = vi.fn((url: string) => {
      const count = new URL(url).searchParams.get('latitude')!.split(',').length;
      return Promise.resolve(jsonResponse(Array.from({ length: count }, () => apiLocation())));
    });
    const result = await fetchDailyForecasts(coords, { fetchImpl: fetchImpl as typeof fetch, batchSize: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(5);
  });

  it('retries a failed chunk once, then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: true }, 500))
      .mockResolvedValueOnce(jsonResponse([apiLocation()]));
    const result = await fetchDailyForecasts([COORD_A], { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
  });

  it('throws after the retry also fails and no batch succeeded', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: true }, 429));
    await expect(fetchDailyForecasts([COORD_A], { fetchImpl })).rejects.toThrow(/HTTP 429/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps successful batches when another batch fails, preserving index alignment', async () => {
    const coords = [
      { lat: 50, lon: 10 },
      { lat: 51, lon: 11 },
      { lat: 52, lon: 12 },
    ];
    const fetchImpl = vi.fn((url: string) => {
      const lats = new URL(url).searchParams.get('latitude')!;
      if (lats.startsWith('50')) return Promise.resolve(jsonResponse({ error: true }, 500));
      const count = lats.split(',').length;
      return Promise.resolve(jsonResponse(Array.from({ length: count }, () => apiLocation())));
    });
    const result = await fetchDailyForecasts(coords, { fetchImpl: fetchImpl as typeof fetch, batchSize: 2 });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([]); // failed batch → empty placeholders
    expect(result[1]).toEqual([]);
    expect(result[2].length).toBeGreaterThan(0); // surviving batch intact
  });

  it('throws when the location count does not match', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse([apiLocation()])));
    await expect(fetchDailyForecasts([COORD_A, COORD_B], { fetchImpl })).rejects.toThrow(
      /returned 1 locations for 2/,
    );
  });
});
