/**
 * Nearby points of interest from the Wikipedia GeoSearch API (free, no key,
 * CORS-enabled - `origin=*` is required). A geosearch locates articles around
 * a coordinate; one batched enrich call adds a thumbnail and intro extract.
 * Fetch injects `fetchImpl` for tests; parse/merge is a pure helper.
 */
import type { LatLon } from '../types';

const DEFAULT_RADIUS_M = 4000;
const DEFAULT_LIMIT = 10;
const DEFAULT_LANG = 'en';
/** Wikipedia caps geosearch radius at 10 km. */
const MAX_RADIUS_M = 10_000;

export interface PointOfInterest {
  pageId: number;
  title: string;
  lat: number;
  lon: number;
  distanceM: number;
  url: string;
  thumbnail?: string;
  extract?: string;
}

interface GeoSearchItem {
  pageid?: number;
  title?: string;
  lat?: number;
  lon?: number;
  dist?: number;
}

interface EnrichPage {
  title?: string;
  thumbnail?: { source?: string };
  extract?: string;
}

export interface FetchPoiOptions {
  radiusM?: number;
  limit?: number;
  lang?: string;
  fetchImpl?: typeof fetch;
}

function apiBase(lang: string): string {
  return `https://${lang}.wikipedia.org/w/api.php`;
}

/** A stable article URL that does not depend on the (mutable) title. */
export function articleUrl(pageId: number, lang: string): string {
  return `https://${lang}.wikipedia.org/?curid=${pageId}`;
}

export function buildGeoSearchUrl(
  coords: LatLon,
  radiusM: number,
  limit: number,
  lang: string,
): string {
  const params = new URLSearchParams({
    action: 'query',
    list: 'geosearch',
    gscoord: `${coords.lat}|${coords.lon}`,
    gsradius: String(Math.min(Math.round(radiusM), MAX_RADIUS_M)),
    gslimit: String(limit),
    format: 'json',
    origin: '*',
  });
  return `${apiBase(lang)}?${params}`;
}

export function buildEnrichUrl(pageIds: number[], lang: string): string {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'pageimages|extracts',
    exintro: '1',
    explaintext: '1',
    pithumbsize: '160',
    pageids: pageIds.join('|'),
    format: 'json',
    origin: '*',
  });
  return `${apiBase(lang)}?${params}`;
}

/**
 * Merge geosearch hits with enrichment keyed by pageid, drop malformed rows,
 * and sort nearest-first. Pure - the network layer feeds it parsed JSON.
 */
export function mergePoi(
  items: GeoSearchItem[],
  pages: Record<string, EnrichPage>,
  lang: string,
): PointOfInterest[] {
  return items
    .filter(
      (it): it is GeoSearchItem & { pageid: number } =>
        typeof it.pageid === 'number' && typeof it.title === 'string',
    )
    .map((it) => {
      const page = pages[String(it.pageid)];
      return {
        pageId: it.pageid,
        title: it.title as string,
        lat: it.lat ?? 0,
        lon: it.lon ?? 0,
        distanceM: it.dist ?? 0,
        url: articleUrl(it.pageid, lang),
        thumbnail: page?.thumbnail?.source,
        extract: page?.extract?.trim() || undefined,
      };
    })
    .sort((a, b) => a.distanceM - b.distanceM);
}

export async function fetchNearbyPoi(
  coords: LatLon,
  opts: FetchPoiOptions = {},
): Promise<PointOfInterest[]> {
  const {
    radiusM = DEFAULT_RADIUS_M,
    limit = DEFAULT_LIMIT,
    lang = DEFAULT_LANG,
    fetchImpl = fetch,
  } = opts;

  const geoRes = await fetchImpl(buildGeoSearchUrl(coords, radiusM, limit, lang));
  if (!geoRes.ok) throw new Error(`Wikipedia GeoSearch failed: HTTP ${geoRes.status}`);
  const geoJson = (await geoRes.json()) as { query?: { geosearch?: GeoSearchItem[] } };
  const items = geoJson.query?.geosearch ?? [];
  if (items.length === 0) return [];

  // Enrichment is best-effort: a failure here degrades to titles + distances
  // rather than losing the whole block.
  let pages: Record<string, EnrichPage> = {};
  try {
    const ids = items.map((i) => i.pageid).filter((id): id is number => typeof id === 'number');
    if (ids.length > 0) {
      const enrichRes = await fetchImpl(buildEnrichUrl(ids, lang));
      if (enrichRes.ok) {
        const enrichJson = (await enrichRes.json()) as {
          query?: { pages?: Record<string, EnrichPage> };
        };
        pages = enrichJson.query?.pages ?? {};
      }
    }
  } catch {
    // keep the geosearch results; enrichment is optional
  }

  return mergePoi(items, pages, lang);
}
