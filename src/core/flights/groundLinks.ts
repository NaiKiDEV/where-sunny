/**
 * Ground transport deep-link (docs/plans/travel-ready.md §8). Pure URL builder -
 * no I/O, no API keys. Rome2Rio's `/map/{From}/{To}` path takes place NAMES
 * (not IATA codes): spaces become hyphens ("New-York") and diacritics are
 * tolerated ("Saint-Malo", "Málaga"), so we only strip characters that would
 * corrupt the path itself and percent-encode the rest with encodeURI.
 */

/**
 * Beyond this straight-line distance, flights win and the ground link hides
 * (detail-panel gating; the explicit route planner always shows it).
 */
export const GROUND_LINK_MAX_KM = 800;

const ROME2RIO_BASE = 'https://www.rome2rio.com/map';

/** Characters that would terminate or corrupt a URL path segment. */
const PATH_BREAKERS = /[/?#]/g;

/** Boundary validation per flightLinks style: fail fast on unusable names. */
function slugEndpoint(name: string, side: 'origin' | 'destination'): string {
  const cleaned = name.replace(PATH_BREAKERS, ' ').trim();
  if (!cleaned) throw new Error(`Ground transport ${side} name must not be empty`);
  return encodeURI(cleaned.replace(/\s+/g, '-'));
}

/** Rome2Rio map view - trains, buses, ferries, and drive options in one page. */
export function buildRome2RioLink(fromName: string, toName: string): string {
  return `${ROME2RIO_BASE}/${slugEndpoint(fromName, 'origin')}/${slugEndpoint(toName, 'destination')}`;
}
