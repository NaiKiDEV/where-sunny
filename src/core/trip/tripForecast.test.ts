import { describe, expect, it, vi } from 'vitest';
import { buildTripForecastUrl, fetchSeaTemps, parseTripForecasts } from './tripForecast';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('buildTripForecastUrl', () => {
  it('requests sunrise and sunset alongside the daily vars', () => {
    const url = buildTripForecastUrl([{ lat: 46.8, lon: 9.83 }]);
    expect(url).toContain('sunrise');
    expect(url).toContain('sunset');
    expect(url).toContain('uv_index_max');
  });
});

describe('parseTripForecasts', () => {
  it('maps daily numbers and keeps sun times per day', () => {
    const loc = {
      daily: {
        time: ['2026-07-12', '2026-07-13'],
        sunshine_duration: [40_000, 20_000],
        daylight_duration: [50_000, 50_000],
        sunrise: ['2026-07-12T05:12', '2026-07-13T05:13'],
        sunset: ['2026-07-12T21:47', '2026-07-13T21:46'],
      },
    };
    const [stop] = parseTripForecasts([loc], 1);
    expect(stop.days).toHaveLength(2);
    expect(stop.sunrise[0]).toBe('2026-07-12T05:12');
    expect(stop.sunset[1]).toBe('2026-07-13T21:46');
  });

  it('pads to the requested count on a location mismatch', () => {
    expect(parseTripForecasts([], 2)).toHaveLength(2);
  });
});

describe('fetchSeaTemps', () => {
  it('keeps coastal readings even when a sibling stop is inland', async () => {
    const fetchImpl = vi.fn((url: string) => {
      const lat = new URL(url).searchParams.get('latitude');
      // inland stop 400s; coastal stop returns a reading
      if (lat === '47.370') return Promise.resolve(jsonResponse({ error: true }, 400));
      return Promise.resolve(jsonResponse({ current: { sea_surface_temperature: 21.4 } }));
    });
    const temps = await fetchSeaTemps(
      [
        { lat: 47.37, lon: 8.54 }, // inland
        { lat: 43.7, lon: 7.26 }, // coastal
      ],
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(temps[0]).toBeNull();
    expect(temps[1]).toBeCloseTo(21.4, 5);
  });
});
