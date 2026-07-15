/**
 * Destination guide blurb: a short traveler-oriented intro + photo for a place.
 * Wikivoyage lead sections are written exactly for this; Wikipedia fills the
 * coverage gaps. Same free, no-key, CORS-enabled MediaWiki contract as
 * core/poi/wikipedia (shared plumbing in core/mediawiki); `fetchImpl` injected
 * for tests, parse/guard helpers pure.
 *
 * Live-verified quirks this module guards against:
 * - Wikivoyage geosearch can return a *district* subpage ("Rome/Modern Centre");
 *   the root title before "/" is the actual city guide.
 * - The nearest Wikivoyage page within 10 km can be a different town entirely
 *   (Gols, AT resolved to Neusiedl am See at 7.5 km), so geosearch hits are
 *   only trusted within MAX_HIT_DISTANCE_M.
 * - A title lookup can land on a disambiguation page that is *not* tagged with
 *   the `disambiguation` pageprop ("Gols" on en.wikipedia.org).
 */
import {
  buildGeoSearchUrl,
  mediaWikiApiUrl,
  pageUrl,
  parseGeoSearch,
  type GeoSearchHit,
} from '../mediawiki';
import type { LatLon } from '../types';

const WIKIVOYAGE_HOST = 'en.wikivoyage.org';
const DEFAULT_LANG = 'en';
const GEOSEARCH_RADIUS_M = 10_000;
/** Geosearch hits farther out than this are likely a *different* town - reject. */
const MAX_HIT_DISTANCE_M = 5_000;
const EXTRACT_SENTENCES = 3;
const THUMB_SIZE = 480;
/** `exsentences` is advisory on some wikis; hard-cap runaway extracts client-side. */
const MAX_EXTRACT_CHARS = 600;

export type GuideSource = 'wikivoyage' | 'wikipedia';

export interface DestinationGuide {
  /** Plain-text lead, at most ~3 sentences (clamped). */
  extract: string;
  thumbnail?: string;
  /** Stable `?curid=` link to the source page. */
  sourceUrl: string;
  source: GuideSource;
}

/** The subset of Place the guide needs - structural, keeps core decoupled. */
export interface GuideTarget extends LatLon {
  name: string;
}

export interface FetchGuideOptions {
  /** Language for the Wikipedia fallback; Wikivoyage is always `en`. */
  lang?: string;
  fetchImpl?: typeof fetch;
}

interface GuidePage {
  pageid?: number;
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  pageprops?: { disambiguation?: string };
  missing?: string | boolean;
}

/** Resolve + content in one request: title lookup with redirects and extract props. */
export function buildGuideContentUrl(host: string, title: string): string {
  return mediaWikiApiUrl(host, {
    action: 'query',
    titles: title,
    redirects: '1',
    prop: 'extracts|pageimages|pageprops',
    ppprop: 'disambiguation',
    exintro: '1',
    explaintext: '1',
    exsentences: String(EXTRACT_SENTENCES),
    pithumbsize: String(THUMB_SIZE),
  });
}

/** "Rome/Modern Centre" -> "Rome": Wikivoyage splits big cities into district subpages. */
export function districtRootTitle(title: string): string {
  const slash = title.indexOf('/');
  return slash > 0 ? title.slice(0, slash) : title;
}

/** First page of a `titles=` query response, or null when the shape is off. */
export function parseGuidePage(json: unknown): GuidePage | null {
  const pages = (json as { query?: { pages?: Record<string, GuidePage> } } | null)?.query?.pages;
  const page = pages ? Object.values(pages)[0] : undefined;
  return page ?? null;
}

/**
 * A page is usable when it exists, has prose, and is not a disambiguation page.
 * Some disambiguation pages lack the pageprop, so a "may refer to" lead is
 * rejected as well.
 */
export function isUsableGuidePage(
  page: GuidePage | null,
): page is GuidePage & { pageid: number; extract: string } {
  if (!page || page.missing !== undefined) return false;
  if (typeof page.pageid !== 'number') return false;
  const extract = page.extract?.trim();
  if (!extract) return false;
  if (page.pageprops?.disambiguation !== undefined) return false;
  return !/\bmay (also )?refer to\b/i.test(extract.slice(0, 120));
}

/** Cap a runaway extract at the last full sentence (ellipsis when there is none). */
export function clampExtract(extract: string, maxChars = MAX_EXTRACT_CHARS): string {
  const text = extract.trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  return lastStop > 0 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

function toGuide(
  page: GuidePage & { pageid: number; extract: string },
  host: string,
  source: GuideSource,
): DestinationGuide {
  return {
    extract: clampExtract(page.extract),
    thumbnail: page.thumbnail?.source,
    sourceUrl: pageUrl(host, page.pageid),
    source,
  };
}

/** Best-effort JSON GET: non-ok responses degrade to "no result from this step". */
async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown | null> {
  const res = await fetchImpl(url);
  if (!res.ok) return null;
  return res.json();
}

async function fetchGuidePage(
  host: string,
  title: string,
  fetchImpl: typeof fetch,
): Promise<GuidePage | null> {
  const json = await fetchJson(buildGuideContentUrl(host, title), fetchImpl);
  return json === null ? null : parseGuidePage(json);
}

/** Nearest page around the coordinate, rejected when suspiciously far away. */
async function fetchTopGeoHit(
  host: string,
  coords: LatLon,
  fetchImpl: typeof fetch,
): Promise<GeoSearchHit | null> {
  const json = await fetchJson(buildGeoSearchUrl(host, coords, GEOSEARCH_RADIUS_M, 1), fetchImpl);
  const hit = json === null ? undefined : parseGeoSearch(json)[0];
  if (!hit || typeof hit.title !== 'string') return null;
  if ((hit.dist ?? Number.POSITIVE_INFINITY) > MAX_HIT_DISTANCE_M) return null;
  return hit;
}

/**
 * Resolve a traveler intro for a place. Wikivoyage geosearch first (an exact
 * spot beats name matching where coverage exists), then a Wikivoyage title
 * lookup, then a `{lang}.wikipedia.org` title lookup. 2 requests on the happy
 * path, 4 worst case; null when no wiki describes the place.
 */
export async function fetchGuide(
  place: GuideTarget,
  opts: FetchGuideOptions = {},
): Promise<DestinationGuide | null> {
  const { lang = DEFAULT_LANG, fetchImpl = fetch } = opts;

  const wvHit = await fetchTopGeoHit(WIKIVOYAGE_HOST, place, fetchImpl);
  if (wvHit?.title) {
    const page = await fetchGuidePage(WIKIVOYAGE_HOST, districtRootTitle(wvHit.title), fetchImpl);
    if (isUsableGuidePage(page)) return toGuide(page, WIKIVOYAGE_HOST, 'wikivoyage');
  }

  const wvTitled = await fetchGuidePage(WIKIVOYAGE_HOST, place.name, fetchImpl);
  if (isUsableGuidePage(wvTitled)) return toGuide(wvTitled, WIKIVOYAGE_HOST, 'wikivoyage');

  const wikipediaHost = `${lang}.wikipedia.org`;
  const wpTitled = await fetchGuidePage(wikipediaHost, place.name, fetchImpl);
  if (isUsableGuidePage(wpTitled)) return toGuide(wpTitled, wikipediaHost, 'wikipedia');

  return null;
}
