import { describe, expect, it, vi } from 'vitest';
import { buildModelsUrl, fetchModelForecasts, parseModelsResponse } from './models';

function modelDaily(suffix: string, sunshine: number[]) {
  return {
    [`sunshine_duration_${suffix}`]: sunshine,
    [`daylight_duration_${suffix}`]: sunshine.map(() => 60_000),
    [`cloud_cover_mean_${suffix}`]: sunshine.map(() => 30),
    [`precipitation_probability_max_${suffix}`]: sunshine.map(() => 10),
    [`temperature_2m_max_${suffix}`]: sunshine.map(() => 22),
    [`temperature_2m_min_${suffix}`]: sunshine.map(() => 14),
    [`weather_code_${suffix}`]: sunshine.map(() => 1),
  };
}

const RESPONSE = {
  daily: {
    time: ['2026-07-11', '2026-07-12'],
    ...modelDaily('ecmwf_ifs025', [50_000, 10_000]),
    ...modelDaily('gfs_seamless', [45_000, 20_000]),
    ...modelDaily('icon_seamless', [48_000, 5_000]),
  },
};

describe('buildModelsUrl', () => {
  it('requests all three models for a single coordinate', () => {
    const url = buildModelsUrl({ lat: 54.687, lon: 25.28 }, 7, 'Europe/Vilnius');
    expect(url).toContain('models=ecmwf_ifs025%2Cgfs_seamless%2Cicon_seamless');
    expect(url).toContain('latitude=54.687');
    expect(url).toContain('timezone=Europe%2FVilnius');
  });
});

describe('parseModelsResponse', () => {
  it('splits suffixed daily arrays into per-model forecasts', () => {
    const models = parseModelsResponse(RESPONSE);
    expect(models).toHaveLength(3);
    expect(models[0].model).toBe('ecmwf_ifs025');
    expect(models[0].days).toHaveLength(2);
    expect(models[0].days[0].sunshineDuration).toBe(50_000);
    expect(models[1].days[1].sunshineDuration).toBe(20_000);
    expect(models[2].label).toBe('ICON');
  });

  it('yields empty day lists for a malformed response', () => {
    const models = parseModelsResponse({});
    expect(models).toHaveLength(3);
    expect(models.every((m) => m.days.length === 0)).toBe(true);
  });
});

describe('fetchModelForecasts', () => {
  it('fetches and parses in one step', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(RESPONSE)));
    const models = await fetchModelForecasts({ lat: 54.687, lon: 25.28 }, { fetchImpl });
    expect(models[0].days[0].date).toBe('2026-07-11');
  });

  it('throws on an HTTP error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(fetchModelForecasts({ lat: 1, lon: 1 }, { fetchImpl })).rejects.toThrow(/HTTP 500/);
  });
});
