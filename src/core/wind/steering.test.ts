import { describe, expect, it, vi } from 'vitest';
import {
  buildSteeringWindUrl,
  fetchSteeringWind,
  gridPoints,
  movementBearing,
  parseSteeringResponse,
  pickHourIndex,
} from './steering';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('gridPoints', () => {
  it('centres one point in each cell, inset from the edges', () => {
    const points = gridPoints({ west: 0, south: 0, east: 10, north: 10 }, 2, 2);
    expect(points).toEqual([
      { lon: 2.5, lat: 2.5 },
      { lon: 7.5, lat: 2.5 },
      { lon: 2.5, lat: 7.5 },
      { lon: 7.5, lat: 7.5 },
    ]);
  });

  it('produces cols × rows points', () => {
    expect(gridPoints({ west: -5, south: 40, east: 5, north: 50 }, 6, 4)).toHaveLength(24);
  });
});

describe('buildSteeringWindUrl', () => {
  it('requests both wind levels for every coordinate, pinned to GMT', () => {
    const url = buildSteeringWindUrl([
      { lat: 51.5, lon: -0.12 },
      { lat: 48.85, lon: 2.35 },
    ]);
    const params = new URL(url).searchParams;
    expect(params.get('latitude')).toBe('51.500,48.850');
    expect(params.get('longitude')).toBe('-0.120,2.350');
    expect(params.get('hourly')).toBe(
      'wind_speed_700hPa,wind_direction_700hPa,wind_speed_10m,wind_direction_10m',
    );
    expect(params.get('timezone')).toBe('GMT');
    expect(params.get('forecast_days')).toBe('1');
  });
});

describe('pickHourIndex', () => {
  const times = ['2026-07-22T12:00', '2026-07-22T13:00', '2026-07-22T14:00'];

  it('picks the slot nearest now, treating the times as UTC', () => {
    const now = Date.parse('2026-07-22T13:40:00Z');
    expect(pickHourIndex(times, now)).toBe(2);
  });

  it('defaults to the first slot for an empty list', () => {
    expect(pickHourIndex([], Date.now())).toBe(0);
  });
});

describe('movementBearing', () => {
  it('reverses the from-direction into a toward-bearing', () => {
    // Wind FROM the west (270°) carries rain TO the east (90°).
    expect(movementBearing(270)).toBe(90);
    expect(movementBearing(0)).toBe(180);
  });

  it('normalises into 0–360', () => {
    expect(movementBearing(200)).toBe(20);
  });
});

describe('parseSteeringResponse', () => {
  const coords = [
    { lat: 51, lon: 0 },
    { lat: 52, lon: 1 },
  ];
  const now = Date.parse('2026-07-22T12:00:00Z');

  it('prefers the 700 hPa steering wind', () => {
    const json = [
      {
        hourly: {
          time: ['2026-07-22T12:00'],
          wind_speed_700hPa: [40],
          wind_direction_700hPa: [270],
          wind_speed_10m: [10],
          wind_direction_10m: [90],
        },
      },
    ];
    const arrows = parseSteeringResponse(json, [coords[0]], now);
    expect(arrows).toEqual([{ lon: 0, lat: 51, bearing: 90, speedKmh: 40 }]);
  });

  it('falls back to the 10 m wind when 700 hPa is null', () => {
    const json = [
      {
        hourly: {
          time: ['2026-07-22T12:00'],
          wind_speed_700hPa: [null],
          wind_direction_700hPa: [null],
          wind_speed_10m: [18],
          wind_direction_10m: [180],
        },
      },
    ];
    const arrows = parseSteeringResponse(json, [coords[0]], now);
    expect(arrows).toEqual([{ lon: 0, lat: 51, bearing: 0, speedKmh: 18 }]);
  });

  it('drops a point with no usable wind and keeps coordinate alignment', () => {
    const json = [
      { hourly: { time: ['2026-07-22T12:00'], wind_speed_700hPa: [null], wind_direction_700hPa: [null] } },
      {
        hourly: {
          time: ['2026-07-22T12:00'],
          wind_speed_700hPa: [25],
          wind_direction_700hPa: [90],
        },
      },
    ];
    const arrows = parseSteeringResponse(json, coords, now);
    expect(arrows).toEqual([{ lon: 1, lat: 52, bearing: 270, speedKmh: 25 }]);
  });
});

describe('fetchSteeringWind', () => {
  it('resolves arrows from the fetched payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          hourly: {
            time: ['2026-07-22T12:00'],
            wind_speed_700hPa: [30],
            wind_direction_700hPa: [270],
          },
        },
      ]),
    );
    const arrows = await fetchSteeringWind([{ lat: 51, lon: 0 }], {
      fetchImpl,
      nowMs: Date.parse('2026-07-22T12:00:00Z'),
    });
    expect(arrows).toEqual([{ lon: 0, lat: 51, bearing: 90, speedKmh: 30 }]);
  });

  it('returns an empty array for no coordinates without fetching', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchSteeringWind([], { fetchImpl })).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retries once then throws on persistent failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(
      fetchSteeringWind([{ lat: 51, lon: 0 }], { fetchImpl }),
    ).rejects.toThrow('HTTP 503');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
