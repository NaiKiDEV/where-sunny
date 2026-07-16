import { describe, expect, it, vi } from 'vitest';
import {
  buildMarineDailyUrl,
  fetchMarineDaily,
  fetchSeaTemps,
  isLikelyCoastal,
  parseMarineDaily,
  parseSeaLevelHours,
  swimBand,
  waveComfort,
} from './marine';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const coastalDaily = {
  daily: {
    time: ['2026-07-15', '2026-07-16'],
    sea_surface_temperature_max: [25.9, 26.3],
    wave_height_max: [0.36, 0.4],
  },
};

const inlandDaily = {
  daily: {
    time: ['2026-07-15', '2026-07-16'],
    sea_surface_temperature_max: [null, null],
    wave_height_max: [null, null],
  },
};

const coastalWithTides = {
  daily: {
    time: ['2026-07-16'],
    sea_surface_temperature_max: [18.2],
    wave_height_max: [1.1],
  },
  hourly: {
    time: ['2026-07-16T00:00', '2026-07-16T01:00', '2026-07-16T02:00'],
    sea_level_height_msl: [4.1, null, -3.9],
  },
};

describe('swimBand', () => {
  it('bands the spec edges: cold <18, fresh 18-21, pleasant 21-24, warm >24', () => {
    expect(swimBand(17.9)).toBe('cold');
    expect(swimBand(18)).toBe('fresh');
    expect(swimBand(20.9)).toBe('fresh');
    expect(swimBand(21)).toBe('pleasant');
    expect(swimBand(24)).toBe('pleasant');
    expect(swimBand(24.1)).toBe('warm');
  });
});

describe('waveComfort', () => {
  it('bands wave height into calm / moderate / rough', () => {
    expect(waveComfort(0)).toBe('calm');
    expect(waveComfort(0.49)).toBe('calm');
    expect(waveComfort(0.5)).toBe('moderate');
    expect(waveComfort(1.25)).toBe('moderate');
    expect(waveComfort(1.3)).toBe('rough');
  });
});

describe('isLikelyCoastal', () => {
  it('keeps sea-level and unknown-elevation places, drops high ground', () => {
    expect(isLikelyCoastal({ elevation: 0 })).toBe(true);
    expect(isLikelyCoastal({ elevation: 50 })).toBe(true);
    expect(isLikelyCoastal({ elevation: 51 })).toBe(false);
    expect(isLikelyCoastal({})).toBe(true);
  });
});

describe('buildMarineDailyUrl', () => {
  it('requests both daily variables with the day count and timezone', () => {
    const url = buildMarineDailyUrl({ lat: 36.7, lon: -4.4 });
    expect(url).toContain('sea_surface_temperature_max');
    expect(url).toContain('wave_height_max');
    expect(url).toContain('forecast_days=7');
    expect(url).toContain('timezone=auto');
  });

  it('adds the hourly sea-level variable only when asked', () => {
    expect(buildMarineDailyUrl({ lat: 48.65, lon: -2.026 })).not.toContain('hourly');
    expect(buildMarineDailyUrl({ lat: 48.65, lon: -2.026 }, 7, 'auto', true)).toContain(
      'hourly=sea_level_height_msl',
    );
  });
});

describe('parseMarineDaily', () => {
  it('maps dates to values and preserves nulls per day', () => {
    const days = parseMarineDaily({
      daily: {
        time: ['2026-07-15', '2026-07-16'],
        sea_surface_temperature_max: [25.9, null],
        wave_height_max: [null, 0.4],
      },
    });
    expect(days).toEqual([
      { date: '2026-07-15', seaTempMax: 25.9, waveHeightMax: null },
      { date: '2026-07-16', seaTempMax: null, waveHeightMax: 0.4 },
    ]);
  });

  it('returns an empty list for a shapeless payload', () => {
    expect(parseMarineDaily({})).toEqual([]);
  });
});

describe('parseSeaLevelHours', () => {
  it('maps hourly times to heights and preserves nulls per hour', () => {
    expect(parseSeaLevelHours(coastalWithTides)).toEqual([
      { time: '2026-07-16T00:00', height: 4.1 },
      { time: '2026-07-16T01:00', height: null },
      { time: '2026-07-16T02:00', height: -3.9 },
    ]);
  });

  it('returns an empty list when the hourly block is absent', () => {
    expect(parseSeaLevelHours(coastalDaily)).toEqual([]);
    expect(parseSeaLevelHours({})).toEqual([]);
  });
});

describe('fetchMarineDaily', () => {
  it('returns the day series for a coastal point', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(coastalDaily)));
    const days = await fetchMarineDaily(
      { lat: 36.7, lon: -4.4 },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(days).toHaveLength(2);
    expect(days?.[0].seaTempMax).toBeCloseTo(25.9, 5);
    expect(days?.[0].waveHeightMax).toBeCloseTo(0.36, 5);
  });

  it('returns null for an inland point (all-null series)', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(inlandDaily)));
    const days = await fetchMarineDaily(
      { lat: 40.4, lon: -3.7 },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(days).toBeNull();
  });

  it('returns null on a non-OK response instead of throwing', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ error: true }, 400)));
    const days = await fetchMarineDaily(
      { lat: 40.4, lon: -3.7 },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(days).toBeNull();
  });

  it('leaves the hourly variable and seaLevels off by default', async () => {
    const requested: string[] = [];
    const fetchImpl = vi.fn((url: string) => {
      requested.push(url);
      return Promise.resolve(jsonResponse(coastalDaily));
    });
    const days = await fetchMarineDaily(
      { lat: 36.7, lon: -4.4 },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(requested[0]).not.toContain('hourly');
    expect(days?.seaLevels).toBeUndefined();
  });

  it('carries the hourly sea-level series when includeSeaLevel is on', async () => {
    const requested: string[] = [];
    const fetchImpl = vi.fn((url: string) => {
      requested.push(url);
      return Promise.resolve(jsonResponse(coastalWithTides));
    });
    const days = await fetchMarineDaily(
      { lat: 48.65, lon: -2.026 },
      { fetchImpl: fetchImpl as typeof fetch, includeSeaLevel: true },
    );
    expect(requested[0]).toContain('hourly=sea_level_height_msl');
    expect(days).toHaveLength(1);
    expect(days?.seaLevels).toEqual([
      { time: '2026-07-16T00:00', height: 4.1 },
      { time: '2026-07-16T01:00', height: null },
      { time: '2026-07-16T02:00', height: -3.9 },
    ]);
  });
});

describe('fetchSeaTemps', () => {
  it('keeps coastal readings even when a sibling stop is inland', async () => {
    const fetchImpl = vi.fn((url: string) => {
      const lat = new URL(url).searchParams.get('latitude');
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

  it('never requests hourly sea-level data (per-stop probes stay lean)', async () => {
    const requested: string[] = [];
    const fetchImpl = vi.fn((url: string) => {
      requested.push(url);
      return Promise.resolve(jsonResponse({ current: { sea_surface_temperature: 21.4 } }));
    });
    await fetchSeaTemps([{ lat: 43.7, lon: 7.26 }], { fetchImpl: fetchImpl as typeof fetch });
    expect(requested[0]).toContain('current=sea_surface_temperature');
    expect(requested[0]).not.toContain('hourly');
  });
});
