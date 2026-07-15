import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_VARS,
  buildForecastUrl,
  buildPlaceForecastUrl,
  fetchPlaceForecast,
} from './openMeteo';

const COORD = { lat: 46.02, lon: 7.749 };

function apiResponse(overrides: Record<string, unknown> = {}) {
  return {
    timezone: 'Europe/Zurich',
    utc_offset_seconds: 7200,
    daily: {
      time: ['2026-07-15', '2026-07-16'],
      sunshine_duration: [30_000, 10_000],
      daylight_duration: [60_000, 60_000],
      cloud_cover_mean: [20, 80],
      precipitation_probability_max: [5, 60],
      temperature_2m_max: [24, 18],
      temperature_2m_min: [14, 11],
      weather_code: [1, 61],
      snowfall_sum: [0, 1.4],
      snow_depth_max: [0.35, 0.42],
      ...overrides,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('buildPlaceForecastUrl', () => {
  it('requests all grid daily vars plus snow, 7 days, destination-local by default', () => {
    const url = buildPlaceForecastUrl(COORD);
    const daily = new URL(url).searchParams.get('daily')!;
    for (const v of DAILY_VARS) expect(daily).toContain(v);
    expect(daily).toContain('snowfall_sum');
    expect(daily).toContain('snow_depth_max');
    expect(url).toContain('latitude=46.020');
    expect(url).toContain('longitude=7.749');
    expect(url).toContain('forecast_days=7');
    expect(url).toContain('timezone=auto');
  });

  it('encodes an explicit horizon and timezone, clamping days to 1–16', () => {
    expect(buildPlaceForecastUrl(COORD, 16, 'Europe/Vilnius')).toContain('forecast_days=16');
    expect(buildPlaceForecastUrl(COORD, 16, 'Europe/Vilnius')).toContain('timezone=Europe%2FVilnius');
    expect(buildPlaceForecastUrl(COORD, 99)).toContain('forecast_days=16');
    expect(buildPlaceForecastUrl(COORD, 0)).toContain('forecast_days=1');
  });

  it('leaves the batch/grid URL untouched: no snow vars there', () => {
    const daily = new URL(buildForecastUrl([COORD])).searchParams.get('daily')!;
    expect(daily).not.toContain('snowfall_sum');
    expect(daily).not.toContain('snow_depth_max');
  });
});

describe('fetchPlaceForecast', () => {
  it('passes forecastDays through to the request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(apiResponse()));
    await fetchPlaceForecast(COORD, { fetchImpl, forecastDays: 16 });
    const url = fetchImpl.mock.calls[0][0] as string;
    expect(new URL(url).searchParams.get('forecast_days')).toBe('16');
    expect(new URL(url).searchParams.get('timezone')).toBe('auto');
  });

  it('maps days including snow fields and surfaces the response timezone', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(apiResponse()));
    const result = await fetchPlaceForecast(COORD, { fetchImpl });
    expect(result.timezone).toBe('Europe/Zurich');
    expect(result.utcOffsetSeconds).toBe(7200);
    expect(result.days).toHaveLength(2);
    expect(result.days[0]).toMatchObject({
      date: '2026-07-15',
      sunshineDuration: 30_000,
      snowfallSum: 0,
      snowDepthMax: 0.35,
    });
    expect(result.days[1]).toMatchObject({ snowfallSum: 1.4, snowDepthMax: 0.42 });
  });

  it('leaves snow fields undefined when the API omits or nulls them', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(apiResponse({ snowfall_sum: [null, null], snow_depth_max: undefined })));
    const result = await fetchPlaceForecast(COORD, { fetchImpl });
    expect(result.days[0].snowfallSum).toBeUndefined();
    expect(result.days[0].snowDepthMax).toBeUndefined();
  });

  it('normalizes an array-wrapped response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([apiResponse()]));
    const result = await fetchPlaceForecast(COORD, { fetchImpl });
    expect(result.days).toHaveLength(2);
  });

  it('falls back to the requested timezone when the response omits it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ...apiResponse(), timezone: undefined }));
    const result = await fetchPlaceForecast(COORD, { fetchImpl, timezone: 'Europe/Vilnius' });
    expect(result.timezone).toBe('Europe/Vilnius');
  });

  it('retries a failed request once, then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: true }, 500))
      .mockResolvedValueOnce(jsonResponse(apiResponse()));
    const result = await fetchPlaceForecast(COORD, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.days).toHaveLength(2);
  });

  it('throws after the retry also fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: true }, 429));
    await expect(fetchPlaceForecast(COORD, { fetchImpl })).rejects.toThrow(/HTTP 429/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
