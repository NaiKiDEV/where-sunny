import { describe, expect, it, vi } from 'vitest';
import {
  fetchRadarIndex,
  frameTileUrl,
  latestPastFrame,
  latestRadarTileUrl,
  parseRadarIndex,
  radarFrames,
} from './rainviewer';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const HOST = 'https://tilecache.rainviewer.com';

const INDEX_JSON = {
  version: '2.0',
  generated: 1784142632,
  host: HOST,
  radar: {
    past: [
      { time: 1784135400, path: '/v2/radar/older' },
      { time: 1784142600, path: '/v2/radar/latest' },
    ],
    nowcast: [{ time: 1784143200, path: '/v2/radar/next' }],
  },
};

describe('parseRadarIndex', () => {
  it('extracts the host and both frame lists', () => {
    const index = parseRadarIndex(INDEX_JSON);
    expect(index).toEqual({
      host: HOST,
      past: INDEX_JSON.radar.past,
      nowcast: INDEX_JSON.radar.nowcast,
    });
  });

  it('drops malformed frames but keeps the valid ones', () => {
    const index = parseRadarIndex({
      host: HOST,
      radar: {
        past: [{ time: 1 }, { path: '/no-time' }, null, { time: 2, path: '/v2/radar/ok' }],
      },
    });
    expect(index?.past).toEqual([{ time: 2, path: '/v2/radar/ok' }]);
  });

  it('tolerates a missing radar block', () => {
    expect(parseRadarIndex({ host: HOST })).toEqual({ host: HOST, past: [], nowcast: [] });
  });

  it('returns null when the host is missing or the payload is not an object', () => {
    expect(parseRadarIndex({ radar: { past: [] } })).toBeNull();
    expect(parseRadarIndex({ host: '' })).toBeNull();
    expect(parseRadarIndex(null)).toBeNull();
  });
});

describe('latestPastFrame', () => {
  it('picks the newest frame regardless of list order', () => {
    const frame = latestPastFrame({
      host: HOST,
      past: [
        { time: 300, path: '/c' },
        { time: 100, path: '/a' },
        { time: 200, path: '/b' },
      ],
      nowcast: [],
    });
    expect(frame).toEqual({ time: 300, path: '/c' });
  });

  it('returns null when there are no past frames', () => {
    expect(latestPastFrame({ host: HOST, past: [], nowcast: [] })).toBeNull();
  });
});

describe('frameTileUrl', () => {
  it('builds the 256px universal-blue tile template', () => {
    expect(frameTileUrl(HOST, { time: 1, path: '/v2/radar/abc' })).toBe(
      `${HOST}/v2/radar/abc/256/{z}/{x}/{y}/2/1_1.png`,
    );
  });
});

describe('radarFrames', () => {
  it('orders observed frames before the nowcast, each with a tile url and kind', () => {
    const frames = radarFrames(parseRadarIndex(INDEX_JSON)!);
    expect(frames).toEqual([
      { time: 1784135400, url: `${HOST}/v2/radar/older/256/{z}/{x}/{y}/2/1_1.png`, kind: 'past' },
      { time: 1784142600, url: `${HOST}/v2/radar/latest/256/{z}/{x}/{y}/2/1_1.png`, kind: 'past' },
      { time: 1784143200, url: `${HOST}/v2/radar/next/256/{z}/{x}/{y}/2/1_1.png`, kind: 'forecast' },
    ]);
  });

  it('is empty when the feed lists no frames', () => {
    expect(radarFrames({ host: HOST, past: [], nowcast: [] })).toEqual([]);
  });
});

describe('fetchRadarIndex', () => {
  it('fetches and parses the public index', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(INDEX_JSON));
    const index = await fetchRadarIndex({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.rainviewer.com/public/weather-maps.json');
    expect(index.host).toBe(HOST);
    expect(index.past).toHaveLength(2);
  });

  it('throws on an HTTP error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(fetchRadarIndex({ fetchImpl })).rejects.toThrow('HTTP 503');
  });

  it('throws on an unusable payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ nope: true }));
    await expect(fetchRadarIndex({ fetchImpl })).rejects.toThrow('unexpected shape');
  });
});

describe('latestRadarTileUrl', () => {
  it('resolves the tile template for the latest observed frame', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(INDEX_JSON));
    await expect(latestRadarTileUrl({ fetchImpl })).resolves.toBe(
      `${HOST}/v2/radar/latest/256/{z}/{x}/{y}/2/1_1.png`,
    );
  });

  it('resolves null when the feed lists no frames', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ host: HOST, radar: { past: [] } }));
    await expect(latestRadarTileUrl({ fetchImpl })).resolves.toBeNull();
  });
});
