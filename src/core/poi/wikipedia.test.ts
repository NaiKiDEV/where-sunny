import { describe, expect, it, vi } from 'vitest';
import {
  articleUrl,
  buildEnrichUrl,
  buildGeoSearchUrl,
  fetchNearbyPoi,
  mergePoi,
} from './wikipedia';

const ROME = { lat: 41.9028, lon: 12.4964 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const GEOSEARCH = [
  { pageid: 2, title: 'Colosseum', lat: 41.89, lon: 12.49, dist: 800 },
  { pageid: 1, title: 'Trevi Fountain', lat: 41.9, lon: 12.48, dist: 200 },
];

const PAGES = {
  '1': { title: 'Trevi Fountain', thumbnail: { source: 'https://img/trevi.jpg' }, extract: '  A fountain.  ' },
  '2': { title: 'Colosseum', extract: 'An amphitheatre.' },
};

describe('buildGeoSearchUrl', () => {
  it('encodes coord, radius, limit, and the required origin=*', () => {
    const url = new URL(buildGeoSearchUrl(ROME, 3000, 5, 'en'));
    expect(url.searchParams.get('list')).toBe('geosearch');
    expect(url.searchParams.get('gscoord')).toBe('41.9028|12.4964');
    expect(url.searchParams.get('gsradius')).toBe('3000');
    expect(url.searchParams.get('gslimit')).toBe('5');
    expect(url.searchParams.get('origin')).toBe('*');
  });

  it('clamps the radius to Wikipedia\'s 10 km maximum', () => {
    const url = new URL(buildGeoSearchUrl(ROME, 999_999, 5, 'en'));
    expect(url.searchParams.get('gsradius')).toBe('10000');
  });
});

describe('buildEnrichUrl', () => {
  it('joins page ids with a pipe and requests images + extracts', () => {
    const url = new URL(buildEnrichUrl([1, 2], 'en'));
    expect(url.searchParams.get('pageids')).toBe('1|2');
    expect(url.searchParams.get('prop')).toBe('pageimages|extracts');
    expect(url.searchParams.get('origin')).toBe('*');
  });
});

describe('articleUrl', () => {
  it('builds a stable curid link independent of the title', () => {
    expect(articleUrl(42, 'de')).toBe('https://de.wikipedia.org/?curid=42');
  });
});

describe('mergePoi', () => {
  it('merges thumbnail/extract by pageid and sorts nearest-first', () => {
    const merged = mergePoi(GEOSEARCH, PAGES, 'en');
    expect(merged.map((p) => p.title)).toEqual(['Trevi Fountain', 'Colosseum']);
    expect(merged[0]).toEqual({
      pageId: 1,
      title: 'Trevi Fountain',
      lat: 41.9,
      lon: 12.48,
      distanceM: 200,
      url: 'https://en.wikipedia.org/?curid=1',
      thumbnail: 'https://img/trevi.jpg',
      extract: 'A fountain.',
    });
    expect(merged[1].thumbnail).toBeUndefined();
  });

  it('drops rows missing a pageid or title', () => {
    const merged = mergePoi([{ title: 'no id' }, { pageid: 9 }] as never, {}, 'en');
    expect(merged).toEqual([]);
  });
});

describe('fetchNearbyPoi', () => {
  it('geosearches then enriches in one extra call, returning merged POIs', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ query: { geosearch: GEOSEARCH } }))
      .mockResolvedValueOnce(jsonResponse({ query: { pages: PAGES } }));
    const result = await fetchNearbyPoi(ROME, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.map((p) => p.title)).toEqual(['Trevi Fountain', 'Colosseum']);
    expect(result[0].thumbnail).toBe('https://img/trevi.jpg');
  });

  it('returns [] and skips enrichment when geosearch is empty', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ query: { geosearch: [] } }));
    const result = await fetchNearbyPoi(ROME, { fetchImpl });
    expect(result).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws when the geosearch request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchNearbyPoi(ROME, { fetchImpl })).rejects.toThrow(/HTTP 500/);
  });

  it('degrades to titles + distances when enrichment fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ query: { geosearch: GEOSEARCH } }))
      .mockResolvedValueOnce(jsonResponse({}, 500));
    const result = await fetchNearbyPoi(ROME, { fetchImpl });
    expect(result.map((p) => p.title)).toEqual(['Trevi Fountain', 'Colosseum']);
    expect(result[0].thumbnail).toBeUndefined();
  });
});
