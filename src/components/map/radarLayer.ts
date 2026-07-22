/**
 * Live rain radar wash: a RainViewer raster tile layer, added lazily the first
 * time radar mode turns on and then re-pointed in place as fresher frames
 * arrive. Like the forecast wash it slots beneath the score circles so pins
 * and labels stay legible on top.
 */
import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl';
import { RADAR_TILE_MAX_ZOOM, RADAR_TILE_SIZE } from '../../core/radar/rainviewer';
import { PLACE_CIRCLES_LAYER } from './mapLayers';
import { WIND_ARROW_LAYER } from './windArrowLayer';

const RADAR_SOURCE = 'rain-radar';
const RADAR_LAYER = 'rain-radar-raster';
// Translucent enough that coastlines and labels read through heavy cells.
const RADAR_OPACITY = 0.7;

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
        'raster-opacity': RADAR_OPACITY,
        'raster-resampling': 'linear',
      },
    },
    before,
  );
}

/**
 * Show the given radar frame (adding source + layer on first use), or hide the
 * layer when `tileUrl` is null. An existing source is re-pointed via setTiles,
 * so a refreshed frame swaps in without a remove/re-add flash.
 */
export function updateRadarLayer(map: MapLibreMap, tileUrl: string | null): void {
  if (tileUrl === null) {
    if (map.getLayer(RADAR_LAYER)) map.setLayoutProperty(RADAR_LAYER, 'visibility', 'none');
    return;
  }
  ensureRadarLayer(map, tileUrl);
  const source = map.getSource(RADAR_SOURCE) as RasterTileSource | undefined;
  if (source && source.tiles?.[0] !== tileUrl) source.setTiles([tileUrl]);
  if (map.getLayer(RADAR_LAYER)) map.setLayoutProperty(RADAR_LAYER, 'visibility', 'visible');
}
