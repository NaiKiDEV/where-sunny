import { describe, expect, it } from 'vitest';
import { buildHourlyUrl, parseHourlyResponse } from './hourly';

describe('buildHourlyUrl', () => {
  it('requests the hourly variables for one coordinate', () => {
    const url = buildHourlyUrl({ lat: 54.687, lon: 25.28 }, 7, 'Europe/Vilnius');
    expect(url).toContain('hourly=temperature_2m%2Ccloud_cover%2Cprecipitation_probability%2Cis_day');
    expect(url).toContain('forecast_days=7');
  });
});

describe('parseHourlyResponse', () => {
  it('maps hourly arrays to points with date and hour split out', () => {
    const points = parseHourlyResponse({
      hourly: {
        time: ['2026-07-11T00:00', '2026-07-11T13:00'],
        temperature_2m: [12, 24],
        cloud_cover: [90, 10],
        precipitation_probability: [5, 0],
        is_day: [0, 1],
      },
    });
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({
      date: '2026-07-11',
      hour: 0,
      temp: 12,
      cloud: 90,
      precipProb: 5,
      isDay: false,
    });
    expect(points[1].hour).toBe(13);
    expect(points[1].isDay).toBe(true);
  });

  it('handles nulls and missing arrays with defaults', () => {
    const points = parseHourlyResponse({
      hourly: { time: ['2026-07-11T06:00'], cloud_cover: [null] },
    });
    expect(points[0].cloud).toBe(50);
    expect(points[0].precipProb).toBe(0);
    expect(points[0].isDay).toBe(false);
  });

  it('returns empty for a malformed response', () => {
    expect(parseHourlyResponse({})).toEqual([]);
  });
});
