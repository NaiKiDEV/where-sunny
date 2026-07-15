/**
 * Shared MediaWiki Action API helpers, used by core/poi (Wikipedia) and
 * core/guide (Wikivoyage + Wikipedia). All target wikis are free, no-key, and
 * CORS-enabled - `origin=*` is required on every request.
 */
import type { LatLon } from './types';

/** MediaWiki caps geosearch radius at 10 km. */
export const MAX_GEOSEARCH_RADIUS_M = 10_000;

export interface GeoSearchHit {
  pageid?: number;
  title?: string;
  lat?: number;
  lon?: number;
  dist?: number;
}

/** Action API URL on any MediaWiki host, with the mandatory CORS + JSON params. */
export function mediaWikiApiUrl(host: string, params: Record<string, string>): string {
  const search = new URLSearchParams({ ...params, format: 'json', origin: '*' });
  return `https://${host}/w/api.php?${search}`;
}

export function buildGeoSearchUrl(
  host: string,
  coords: LatLon,
  radiusM: number,
  limit: number,
): string {
  return mediaWikiApiUrl(host, {
    action: 'query',
    list: 'geosearch',
    gscoord: `${coords.lat}|${coords.lon}`,
    gsradius: String(Math.min(Math.round(radiusM), MAX_GEOSEARCH_RADIUS_M)),
    gslimit: String(limit),
  });
}

export function parseGeoSearch(json: unknown): GeoSearchHit[] {
  const parsed = json as { query?: { geosearch?: GeoSearchHit[] } } | null;
  return parsed?.query?.geosearch ?? [];
}

/** A stable page URL that does not depend on the (mutable) title. */
export function pageUrl(host: string, pageId: number): string {
  return `https://${host}/?curid=${pageId}`;
}
