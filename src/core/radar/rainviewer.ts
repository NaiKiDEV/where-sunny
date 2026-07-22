/**
 * Live precipitation radar from the RainViewer public API (free, no key,
 * CORS-enabled). One small index fetch lists the last ~2 hours of observed
 * radar frames at 10-minute intervals; each frame becomes a raster tile URL
 * template MapLibre can consume directly. Fetch injects `fetchImpl` for
 * tests; parsing, frame selection, and URL building are pure helpers.
 */

const INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';

/** New frames land roughly every 10 minutes; re-check twice per interval. */
export const RADAR_REFRESH_MS = 5 * 60 * 1000;

/** RainViewer serves radar tiles up to this zoom; MapLibre overzooms past it. */
export const RADAR_TILE_MAX_ZOOM = 7;
export const RADAR_TILE_SIZE = 256;

// "Universal Blue" - the only scheme RainViewer still documents. Its light-to-
// deep blue ramp reads clearly over the pale Liberty basemap and stays distinct
// from the app's gold sun wash and red banned-country blocks.
const COLOR_SCHEME = 2;
// {smooth}_{snow}: smoothed rendering, snow drawn in its own colours.
const TILE_OPTIONS = '1_1';

export interface RadarFrame {
  /** Unix seconds of the radar capture. */
  time: number;
  /** Host-relative path fragment, e.g. "/v2/radar/<hash>". */
  path: string;
}

export interface RadarIndex {
  host: string;
  past: RadarFrame[];
  nowcast: RadarFrame[];
}

function parseFrames(value: unknown): RadarFrame[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is RadarFrame =>
      typeof (f as RadarFrame)?.time === 'number' && typeof (f as RadarFrame)?.path === 'string',
  );
}

/** Validate the index payload, dropping malformed frames. Null when unusable. */
export function parseRadarIndex(json: unknown): RadarIndex | null {
  const root = json as { host?: unknown; radar?: { past?: unknown; nowcast?: unknown } } | null;
  if (!root || typeof root.host !== 'string' || root.host === '') return null;
  return {
    host: root.host,
    past: parseFrames(root.radar?.past),
    nowcast: parseFrames(root.radar?.nowcast),
  };
}

/** The most recent observed (past) frame - what "now" should show. */
export function latestPastFrame(index: RadarIndex): RadarFrame | null {
  let latest: RadarFrame | null = null;
  for (const frame of index.past) {
    if (!latest || frame.time > latest.time) latest = frame;
  }
  return latest;
}

/** Raster tile URL template ({z}/{x}/{y} placeholders) for one frame. */
export function frameTileUrl(host: string, frame: RadarFrame): string {
  return `${host}${frame.path}/${RADAR_TILE_SIZE}/{z}/{x}/{y}/${COLOR_SCHEME}/${TILE_OPTIONS}.png`;
}

/** A playable frame: its tile template plus whether it is observed or predicted. */
export interface RadarFrameView {
  /** Unix seconds of the frame (past capture or nowcast target). */
  time: number;
  /** Tile URL template for this frame. */
  url: string;
  kind: 'past' | 'forecast';
}

/**
 * All frames in playback order - observed history first, then the short-range
 * nowcast - each resolved to a tile template. This is what the timeline scrubs
 * through; the last 'past' frame is "now".
 */
export function radarFrames(index: RadarIndex): RadarFrameView[] {
  const toView = (kind: 'past' | 'forecast') => (frame: RadarFrame): RadarFrameView => ({
    time: frame.time,
    url: frameTileUrl(index.host, frame),
    kind,
  });
  return [...index.past.map(toView('past')), ...index.nowcast.map(toView('forecast'))];
}

export interface FetchRadarOptions {
  fetchImpl?: typeof fetch;
}

export async function fetchRadarIndex(opts: FetchRadarOptions = {}): Promise<RadarIndex> {
  const { fetchImpl = fetch } = opts;
  const res = await fetchImpl(INDEX_URL);
  if (!res.ok) throw new Error(`RainViewer index failed: HTTP ${res.status}`);
  const index = parseRadarIndex(await res.json());
  if (!index) throw new Error('RainViewer index: unexpected shape');
  return index;
}

/**
 * Fetch the index and resolve the tile template for the latest observed
 * frame; null when the feed currently lists no frames.
 */
export async function latestRadarTileUrl(opts: FetchRadarOptions = {}): Promise<string | null> {
  const index = await fetchRadarIndex(opts);
  const frame = latestPastFrame(index);
  return frame ? frameTileUrl(index.host, frame) : null;
}
