import { describe, expect, it, vi } from 'vitest';
import {
  buildGuideContentUrl,
  clampExtract,
  districtRootTitle,
  fetchGuide,
  isUsableGuidePage,
  parseGuidePage,
} from './destinationGuide';

const ROME = { name: 'Rome', lat: 41.9028, lon: 12.4964 };
const GOLS = { name: 'Gols', lat: 47.897, lon: 16.912 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function geoBody(hits: unknown[]): unknown {
  return { query: { geosearch: hits } };
}

function pageBody(page: Record<string, unknown>): unknown {
  return { query: { pages: { [String(page.pageid ?? -1)]: page } } };
}

const ROME_WV_PAGE = {
  pageid: 29990,
  title: 'Rome',
  extract: 'Rome is the capital of Italy. It is old. It is warm.',
  thumbnail: { source: 'https://img/rome.jpg' },
};

describe('buildGuideContentUrl', () => {
  it('requests a 3-sentence plain intro, a 480px thumb, and the required origin=*', () => {
    const url = new URL(buildGuideContentUrl('en.wikivoyage.org', 'Rome'));
    expect(url.hostname).toBe('en.wikivoyage.org');
    expect(url.searchParams.get('titles')).toBe('Rome');
    expect(url.searchParams.get('redirects')).toBe('1');
    expect(url.searchParams.get('prop')).toBe('extracts|pageimages|pageprops');
    expect(url.searchParams.get('exsentences')).toBe('3');
    expect(url.searchParams.get('explaintext')).toBe('1');
    expect(url.searchParams.get('pithumbsize')).toBe('480');
    expect(url.searchParams.get('origin')).toBe('*');
  });
});

describe('districtRootTitle', () => {
  it('strips Wikivoyage district subpages down to the city guide', () => {
    expect(districtRootTitle('Rome/Modern Centre')).toBe('Rome');
  });

  it('leaves plain titles untouched', () => {
    expect(districtRootTitle('Húsavík')).toBe('Húsavík');
  });
});

describe('parseGuidePage', () => {
  it('returns the first page of a titles= response', () => {
    expect(parseGuidePage(pageBody(ROME_WV_PAGE))?.title).toBe('Rome');
  });

  it('returns null for malformed payloads', () => {
    expect(parseGuidePage({})).toBeNull();
    expect(parseGuidePage(null)).toBeNull();
  });
});

describe('isUsableGuidePage', () => {
  it('accepts an existing page with prose', () => {
    expect(isUsableGuidePage(ROME_WV_PAGE)).toBe(true);
  });

  it('rejects missing pages and pages without an extract', () => {
    expect(isUsableGuidePage({ title: 'Gols', missing: '' })).toBe(false);
    expect(isUsableGuidePage({ pageid: 1, title: 'X', extract: '   ' })).toBe(false);
    expect(isUsableGuidePage(null)).toBe(false);
  });

  it('rejects disambiguation pages, tagged or not', () => {
    expect(
      isUsableGuidePage({
        pageid: 1,
        extract: 'Gols is a town.',
        pageprops: { disambiguation: '' },
      }),
    ).toBe(false);
    // en.wikipedia.org "Gols" is a disambiguation page *without* the pageprop.
    expect(isUsableGuidePage({ pageid: 2, extract: 'Gols may refer to:' })).toBe(false);
    expect(isUsableGuidePage({ pageid: 3, extract: 'Gol may also refer to:' })).toBe(false);
  });
});

describe('clampExtract', () => {
  it('leaves short extracts untouched (trimmed)', () => {
    expect(clampExtract('  A town.  ')).toBe('A town.');
  });

  it('cuts overlong extracts at the last full sentence', () => {
    const text = 'First sentence. Second sentence. Third one runs long.';
    expect(clampExtract(text, 40)).toBe('First sentence. Second sentence.');
  });

  it('falls back to an ellipsis when there is no sentence boundary', () => {
    expect(clampExtract('x'.repeat(50), 10)).toBe(`${'x'.repeat(10)}…`);
  });
});

describe('fetchGuide', () => {
  it('resolves via Wikivoyage geosearch, normalizing district subpages to the city guide', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(geoBody([{ pageid: 30006, title: 'Rome/Modern Centre', dist: 507.9 }])),
      )
      .mockResolvedValueOnce(jsonResponse(pageBody(ROME_WV_PAGE)));

    const guide = await fetchGuide(ROME, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const contentUrl = new URL(fetchImpl.mock.calls[1][0] as string);
    expect(contentUrl.searchParams.get('titles')).toBe('Rome');
    expect(guide).toEqual({
      extract: 'Rome is the capital of Italy. It is old. It is warm.',
      thumbnail: 'https://img/rome.jpg',
      sourceUrl: 'https://en.wikivoyage.org/?curid=29990',
      source: 'wikivoyage',
    });
  });

  it('rejects a geosearch hit that is suspiciously far (a different town) and falls back', async () => {
    const fetchImpl = vi
      .fn()
      // Neusiedl am See, 7.5 km from Gols - a different town, must not be used.
      .mockResolvedValueOnce(
        jsonResponse(geoBody([{ pageid: 24168, title: 'Neusiedl am See', dist: 7488.3 }])),
      )
      .mockResolvedValueOnce(jsonResponse(pageBody({ title: 'Gols', missing: '' })))
      .mockResolvedValueOnce(
        jsonResponse(
          pageBody({ pageid: 555, title: 'Gols (town)', extract: 'Gols is a wine town.' }),
        ),
      );

    const guide = await fetchGuide(GOLS, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const wpUrl = new URL(fetchImpl.mock.calls[2][0] as string);
    expect(wpUrl.hostname).toBe('en.wikipedia.org');
    expect(guide).toEqual({
      extract: 'Gols is a wine town.',
      thumbnail: undefined,
      sourceUrl: 'https://en.wikipedia.org/?curid=555',
      source: 'wikipedia',
    });
  });

  it('resolves via a Wikivoyage title lookup when geosearch is empty', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoBody([])))
      .mockResolvedValueOnce(jsonResponse(pageBody(ROME_WV_PAGE)));

    const guide = await fetchGuide(ROME, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(guide?.source).toBe('wikivoyage');
    expect(guide?.sourceUrl).toBe('https://en.wikivoyage.org/?curid=29990');
  });

  it('uses {lang}.wikipedia.org for the fallback lookup', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoBody([])))
      .mockResolvedValueOnce(jsonResponse(pageBody({ title: 'Lauffen', missing: '' })))
      .mockResolvedValueOnce(
        jsonResponse(pageBody({ pageid: 9, title: 'Lauffen', extract: 'Eine Stadt.' })),
      );

    const guide = await fetchGuide({ name: 'Lauffen', lat: 49, lon: 9 }, { lang: 'de', fetchImpl });

    const wpUrl = new URL(fetchImpl.mock.calls[2][0] as string);
    expect(wpUrl.hostname).toBe('de.wikipedia.org');
    expect(guide?.sourceUrl).toBe('https://de.wikipedia.org/?curid=9');
  });

  it('rejects an untagged disambiguation fallback and returns null when nothing usable remains', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoBody([])))
      .mockResolvedValueOnce(jsonResponse(pageBody({ title: 'Gols', missing: '' })))
      .mockResolvedValueOnce(
        jsonResponse(pageBody({ pageid: 38798428, title: 'Gols', extract: 'Gols may refer to:' })),
      );

    const guide = await fetchGuide(GOLS, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(guide).toBeNull();
  });

  it('treats HTTP failures on a step as a miss and keeps falling back', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(pageBody({ pageid: 7, title: 'Rome', extract: 'Roma.' })));

    const guide = await fetchGuide(ROME, { fetchImpl });

    expect(guide?.source).toBe('wikipedia');
    expect(guide?.extract).toBe('Roma.');
  });

  it('returns null when every source misses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoBody([])))
      // A fresh Response per call - a body can only be consumed once.
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(pageBody({ title: 'Nowhere', missing: '' }))),
      );

    await expect(fetchGuide({ name: 'Nowhere', lat: 0, lon: 0 }, { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('clamps overlong extracts to a sentence boundary', async () => {
    const longExtract = `${'A long sentence about the town. '.repeat(30)}Tail without stop`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoBody([{ pageid: 1, title: 'Town', dist: 100 }])))
      .mockResolvedValueOnce(
        jsonResponse(pageBody({ pageid: 1, title: 'Town', extract: longExtract })),
      );

    const guide = await fetchGuide({ name: 'Town', lat: 0, lon: 0 }, { fetchImpl });

    expect(guide?.extract.length).toBeLessThanOrEqual(600);
    expect(guide?.extract.endsWith('.')).toBe(true);
  });
});
