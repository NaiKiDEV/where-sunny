import { describe, expect, it, vi } from 'vitest';
import {
  aqiBand,
  buildAirQualityUrl,
  fetchAirQuality,
  pollenLevel,
  summarizeDaily,
} from './airQuality';

const VIENNA = { lat: 48.2, lon: 16.4 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Two local days x three hours, in the shape the API returns. */
const TWO_DAYS = {
  time: [
    '2026-07-15T00:00',
    '2026-07-15T08:00',
    '2026-07-15T16:00',
    '2026-07-16T00:00',
    '2026-07-16T08:00',
    '2026-07-16T16:00',
  ],
  european_aqi: [24, 22, 60, 31, 85, 40],
  us_aqi: [46, 44, 77, 50, 120, 60],
  birch_pollen: [0, 0, 0, 0, 0, 0],
  grass_pollen: [3, 9, 55, 2, 8, 12],
  olive_pollen: [0, 0, 0, 0, 0, 0],
  ragweed_pollen: [0, 1, 4, 0, 2, 3],
};

describe('aqiBand', () => {
  it('maps the official European AQI boundaries onto four bands', () => {
    expect(aqiBand(0)).toBe('good');
    expect(aqiBand(20)).toBe('good');
    expect(aqiBand(21)).toBe('fair');
    expect(aqiBand(60)).toBe('fair');
    expect(aqiBand(61)).toBe('poor');
    expect(aqiBand(80)).toBe('poor');
    expect(aqiBand(81)).toBe('very poor');
    expect(aqiBand(150)).toBe('very poor');
  });
});

describe('pollenLevel', () => {
  it('uses per-species thresholds (ragweed triggers far below birch)', () => {
    expect(pollenLevel('ragweed', 5)).toBe('moderate');
    expect(pollenLevel('ragweed', 20)).toBe('high');
    expect(pollenLevel('birch', 5)).toBe('low');
    expect(pollenLevel('birch', 20)).toBe('moderate');
    expect(pollenLevel('birch', 100)).toBe('high');
  });

  it('bands the grass and olive edges', () => {
    expect(pollenLevel('grass', 19)).toBe('low');
    expect(pollenLevel('grass', 50)).toBe('high');
    expect(pollenLevel('olive', 49)).toBe('low');
    expect(pollenLevel('olive', 200)).toBe('high');
  });
});

describe('buildAirQualityUrl', () => {
  it('encodes coords, all six hourly variables, and timezone=auto', () => {
    const url = new URL(buildAirQualityUrl(VIENNA, 7));
    expect(url.origin + url.pathname).toBe(
      'https://air-quality-api.open-meteo.com/v1/air-quality',
    );
    expect(url.searchParams.get('latitude')).toBe('48.2');
    expect(url.searchParams.get('longitude')).toBe('16.4');
    expect(url.searchParams.get('hourly')).toBe(
      'european_aqi,us_aqi,birch_pollen,grass_pollen,olive_pollen,ragweed_pollen',
    );
    expect(url.searchParams.get('forecast_days')).toBe('7');
    expect(url.searchParams.get('timezone')).toBe('auto');
  });
});

describe('summarizeDaily', () => {
  it('reduces hourly series to per-day maxima grouped by local date', () => {
    const days = summarizeDaily(TWO_DAYS);
    expect(days.map((d) => d.date)).toEqual(['2026-07-15', '2026-07-16']);
    expect(days[0].maxEuropeanAqi).toBe(60);
    expect(days[0].maxUsAqi).toBe(77);
    expect(days[1].maxEuropeanAqi).toBe(85);
    expect(days[1].maxUsAqi).toBe(120);
  });

  it('picks the day-peak dominant pollen at moderate or above only', () => {
    const days = summarizeDaily(TWO_DAYS);
    // Day 1: grass peaks at 55 (high), ragweed at 4 (low).
    expect(days[0].dominantPollen).toEqual({ kind: 'grass', level: 'high' });
    // Day 2: grass peaks at 12 (low), ragweed at 3 (low) - nothing noteworthy.
    expect(days[1].dominantPollen).toBeUndefined();
  });

  it('ranks competing species by severity relative to their own high mark', () => {
    const days = summarizeDaily({
      time: ['2026-07-15T00:00'],
      // Birch 60/100 of high vs ragweed 18/20 of high: ragweed dominates.
      birch_pollen: [60],
      ragweed_pollen: [18],
    });
    expect(days[0].dominantPollen).toEqual({ kind: 'ragweed', level: 'moderate' });
  });

  it('maps all-null pollen series (outside Europe) to undefined, never "low"', () => {
    const days = summarizeDaily({
      time: ['2026-07-15T00:00', '2026-07-15T12:00'],
      european_aqi: [53, 61],
      us_aqi: [99, 85],
      birch_pollen: [null, null],
      grass_pollen: [null, null],
      olive_pollen: [null, null],
      ragweed_pollen: [null, null],
    });
    expect(days[0].dominantPollen).toBeUndefined();
    expect(days[0].maxEuropeanAqi).toBe(61);
  });

  it('skips null hours inside a series but keeps the non-null maxima', () => {
    // The live API pads the final hours of the horizon with nulls.
    const days = summarizeDaily({
      time: ['2026-07-15T00:00', '2026-07-15T12:00', '2026-07-15T23:00'],
      european_aqi: [24, 31, null],
      grass_pollen: [10, 25, null],
    });
    expect(days[0].maxEuropeanAqi).toBe(31);
    expect(days[0].dominantPollen).toEqual({ kind: 'grass', level: 'moderate' });
  });

  it('yields null AQI for a fully null series and [] for an empty response', () => {
    const days = summarizeDaily({
      time: ['2026-07-15T00:00'],
      european_aqi: [null],
    });
    expect(days[0].maxEuropeanAqi).toBeNull();
    expect(days[0].maxUsAqi).toBeNull();
    expect(summarizeDaily({})).toEqual([]);
  });
});

describe('fetchAirQuality', () => {
  it('fetches once and returns the daily summaries', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ hourly: TWO_DAYS }));
    const result = await fetchAirQuality(VIENNA, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2026-07-15',
      maxEuropeanAqi: 60,
      maxUsAqi: 77,
      dominantPollen: { kind: 'grass', level: 'high' },
    });
  });

  it('throws when the request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchAirQuality(VIENNA, { fetchImpl })).rejects.toThrow(/HTTP 500/);
  });

  it('returns [] when the response carries no hourly block', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    await expect(fetchAirQuality(VIENNA, { fetchImpl })).resolves.toEqual([]);
  });
});
