/**
 * Live rain radar wash: a RainViewer raster tile layer, added lazily the first
 * time radar mode turns on and then re-pointed in place as fresher frames
 * arrive. Like the forecast wash it slots beneath the score circles so pins
 * and labels stay legible on top.
 */
import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl';
import { RADAR_TILE_MAX_ZOOM, RADAR_TILE_SIZE } from '../../core/radar/rainviewer';
import { overlayFadeMs, PLACE_CIRCLES_LAYER } from './mapLayers';
import { WIND_ARROW_LAYER } from './windArrowLayer';

const RADAR_SOURCE = 'rain-radar';
const RADAR_LAYER = 'rain-radar-raster';
// Translucent enough that coastlines and labels read through heavy cells.
const RADAR_OPACITY = 0.7;

// Pending fade-out -> hide timer. Turning radar off eases opacity to 0, then
// hides the layer once the fade completes so the source stops fetching tiles in
// the background; a re-show mid-fade cancels it. Keyed on nothing because there
// is a single radar layer.
let hideTimer: number | null = null;

function cancelHide(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function ensureRadarLayer(map: MapLibreMap, tileUrl: string): void {
  if (map.getSource(RADAR_SOURCE)) return;
  map.addSource(RADAR_SOURCE, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: RADAR_TILE_SIZE,
    // RainViewer stops at z7; declaring it lets MapLibre overzoom smoothly
    // instead of requesting tiles that don't exist.
    maxzoom: RADAR_TILE_MAX_ZOOM,
  });
  // Anchor beneath the wind arrows when present (so the wash never buries them),
  // otherwise beneath the score circles, like the other ambient layers.
  const before = map.getLayer(WIND_ARROW_LAYER)
    ? WIND_ARROW_LAYER
    : map.getLayer(PLACE_CIRCLES_LAYER)
      ? PLACE_CIRCLES_LAYER
      : undefined;
  map.addLayer(
    {
      id: RADAR_LAYER,
      type: 'raster',
      source: RADAR_SOURCE,
      paint: {
        // Start transparent so the first show fades in via the opacity transition.
        'raster-opacity': 0,
        'raster-opacity-transition': { duration: overlayFadeMs() },
        'raster-resampling': 'linear',
      },
    },
    before,
  );
}

/**
 * Show the given radar frame (adding source + layer on first use), or hide the
 * layer when `tileUrl` is null. An existing source is re-pointed via setTiles,
 * so a refreshed frame swaps in without a remove/re-add flash. Toggling on/off
 * cross-fades raster opacity rather than hard-cutting visibility; the fade-out
 * ends by hiding the layer so radar tiles stop loading once it is off.
 */
export function updateRadarLayer(map: MapLibreMap, tileUrl: string | null): void {
  if (tileUrl === null) {
    if (map.getLayer(RADAR_LAYER)) {
      const duration = overlayFadeMs();
      map.setPaintProperty(RADAR_LAYER, 'raster-opacity-transition', { duration });
      map.setPaintProperty(RADAR_LAYER, 'raster-opacity', 0);
      cancelHide();
      hideTimer = window.setTimeout(() => {
        hideTimer = null;
        // The map may have been torn down while the fade was pending.
        try {
          if (map.getLayer(RADAR_LAYER)) map.setLayoutProperty(RADAR_LAYER, 'visibility', 'none');
        } catch {
          /* map removed - nothing to hide */
        }
      }, duration);
    }
    return;
  }
  ensureRadarLayer(map, tileUrl);
  const source = map.getSource(RADAR_SOURCE) as RasterTileSource | undefined;
  if (source && source.tiles?.[0] !== tileUrl) source.setTiles([tileUrl]);
  if (map.getLayer(RADAR_LAYER)) {
    cancelHide();
    map.setLayoutProperty(RADAR_LAYER, 'visibility', 'visible');
    map.setPaintProperty(RADAR_LAYER, 'raster-opacity-transition', { duration: overlayFadeMs() });
    map.setPaintProperty(RADAR_LAYER, 'raster-opacity', RADAR_OPACITY);
  }
}
