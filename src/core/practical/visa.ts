/**
 * Visa quick-check from the bundled passport-index matrix.
 *
 * scripts/build-visa-matrix.mjs turns the open passport-index dataset into one
 * ~1 KB file per passport (public/data/visa/{iso2}.json); the runtime lazily
 * fetches exactly one of them, only after the user picks a passport country in
 * Settings, and caches it for the session. Purely informational - the label
 * always ships with a "check official sources" footnote carrying the dataset
 * vintage, and it never feeds the banned-countries feature.
 */

const ISO2_RE = /^[A-Z]{2}$/;

export type VisaCategory = 'vf' | 'voa' | 'ev' | 'eta' | 'vr' | 'na';

export interface VisaRequirement {
  cat: VisaCategory;
  /** Visa-free stay length in days, when the dataset quotes one. */
  days?: number;
}

export interface VisaSummary {
  /** YYYY-MM-DD the matrix was generated - surfaced as the dataset vintage. */
  generated: string;
  /** Uppercase destination alpha-2 -> requirement for this passport. */
  destinations: Record<string, VisaRequirement>;
}

const CATEGORIES: ReadonlySet<string> = new Set(['vf', 'voa', 'ev', 'eta', 'vr', 'na']);

/**
 * One raw passport-index CSV requirement value -> a compact record. Mirrors
 * toRequirement in scripts/build-visa-matrix.mjs - keep in sync. A number is
 * visa-free days; '-1' is the dataset's same-country marker and resolves to
 * null (those rows never ship). Anything unexpected throws so a silent format
 * change upstream can never produce a wrong answer.
 */
export function parseCsvRequirement(raw: string): VisaRequirement | null {
  const value = raw.trim().toLowerCase();
  if (value === '-1') return null;
  if (/^\d+$/.test(value)) return { cat: 'vf', days: Number(value) };
  switch (value) {
    case 'visa free':
      return { cat: 'vf' };
    case 'visa on arrival':
      return { cat: 'voa' };
    case 'e-visa':
      return { cat: 'ev' };
    case 'eta':
      return { cat: 'eta' };
    case 'visa required':
      return { cat: 'vr' };
    case 'no admission':
      return { cat: 'na' };
    default:
      throw new Error(`Unexpected visa requirement "${raw}"`);
  }
}

function isVisaRequirement(value: unknown): value is VisaRequirement {
  if (typeof value !== 'object' || value === null) return false;
  const req = value as Partial<VisaRequirement>;
  if (typeof req.cat !== 'string' || !CATEGORIES.has(req.cat)) return false;
  if (req.days === undefined) return true;
  return typeof req.days === 'number' && Number.isFinite(req.days) && req.days > 0;
}

/**
 * Validated parse of one bundled passport file. A malformed file shape throws
 * (regenerate with `pnpm setup:data`); a malformed individual entry is
 * rejected quietly so one bad row can never blank the whole feature.
 */
export function parseVisaFile(json: unknown): VisaSummary {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Invalid visa file - regenerate with `pnpm setup:data`');
  }
  const file = json as { v?: unknown; generated?: unknown; destinations?: unknown };
  if (
    typeof file.v !== 'number' ||
    file.v < 1 ||
    typeof file.generated !== 'string' ||
    typeof file.destinations !== 'object' ||
    file.destinations === null
  ) {
    throw new Error('Invalid visa file - regenerate with `pnpm setup:data`');
  }
  const destinations: Record<string, VisaRequirement> = {};
  for (const [code, entry] of Object.entries(file.destinations)) {
    if (!ISO2_RE.test(code) || !isVisaRequirement(entry)) continue;
    destinations[code] = entry;
  }
  return { generated: file.generated, destinations };
}

/* prettier-ignore */
const CATEGORY_LABELS: Record<VisaCategory, string> = {
  vf: 'Visa-free',
  voa: 'Visa on arrival',
  ev: 'eVisa needed',
  eta: 'eTA needed',
  vr: 'Visa required',
  na: 'Entry restricted',
};

/** Chip copy for a requirement: "Visa-free · 90 days", "eVisa needed", ... */
export function visaLabel(req: VisaRequirement): string {
  if (req.cat === 'vf' && req.days) return `Visa-free · ${req.days} days`;
  return CATEGORY_LABELS[req.cat];
}

/**
 * The requirement to show for a destination, or null when the chip stays
 * hidden: destination unknown to the file, not a country code, or the same
 * country as the passport (no visa needed to go home).
 */
export function visaForDestination(
  summary: VisaSummary,
  passport: string,
  destinationCode: string | null | undefined,
): VisaRequirement | null {
  if (!destinationCode) return null;
  const dest = destinationCode.trim().toUpperCase();
  if (!ISO2_RE.test(dest) || dest === passport.trim().toUpperCase()) return null;
  return summary.destinations[dest] ?? null;
}

export interface VisaLoadOptions {
  /** Directory the per-passport files live in; must end with a slash. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

// One in-flight-or-settled promise per passport, so a session fetches each
// passport file at most once (the same idea as TanStack's query cache, kept in
// core so callers outside React get it too). Failures evict themselves so a
// transient error can be retried.
const summaryCache = new Map<string, Promise<VisaSummary | null>>();

async function fetchVisaSummary(
  code: string,
  { baseUrl, fetchImpl = fetch }: VisaLoadOptions,
): Promise<VisaSummary | null> {
  const dir = baseUrl ?? `${import.meta.env.BASE_URL}data/visa/`;
  const res = await fetchImpl(`${dir}${code}.json`);
  if (res.status === 404) return null; // passport not in the dataset - stay silent
  if (!res.ok) throw new Error(`Failed to load visa data: HTTP ${res.status}`);
  return parseVisaFile(await res.json());
}

/**
 * Lazy, cached loader for one passport's visa file. Null when the passport
 * code is not a plausible alpha-2 or the dataset has no file for it.
 */
export function loadVisaSummary(
  passport: string,
  opts: VisaLoadOptions = {},
): Promise<VisaSummary | null> {
  const code = passport.trim().toUpperCase();
  if (!ISO2_RE.test(code)) return Promise.resolve(null);
  const cached = summaryCache.get(code);
  if (cached) return cached;
  const promise = fetchVisaSummary(code, opts).catch((err: unknown) => {
    summaryCache.delete(code);
    throw err;
  });
  summaryCache.set(code, promise);
  return promise;
}

/** Test-only: forget every cached passport file. */
export function resetVisaSummaryCache(): void {
  summaryCache.clear();
}
