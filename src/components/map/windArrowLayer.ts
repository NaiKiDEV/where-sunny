/**
 * Rain-movement arrows: a sparse grid of arrow glyphs rotated to the steering
 * wind, showing which way rain areas are drifting. Added lazily the first time
 * the toggle turns on, then re-pointed in place. The arrow icon is drawn once on
 * a canvas (ink fill + white halo so it reads over both the pale basemap and the
 * blue radar wash) and rotated per-feature via `icon-rotate`. On each update the
 * layer is moved to sit directly beneath the score circles - above the radar
 * tiles - so arrows never hide behind the wash yet never cover the pins.
 */
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { WindArrow } from '../../core/wind/steering';
import { overlayFadeMs, PLACE_CIRCLES_LAYER } from './mapLayers';

const ARROW_SOURCE = 'wind-arrows';
/** Exported so the radar layer can anchor itself beneath the arrows. */
export const WIND_ARROW_LAYER = 'wind-arrows-symbol';
const ARROW_LAYER = WIND_ARROW_LAYER;
const ARROW_ICON = 'wind-arrow';
const ARROW_PX = 40;
// Resting opacity when arrows are on; toggling drives icon-opacity 0 <-> this.
const ARROW_OPACITY = 0.9;

// Classic up-arrow (pointing north) in a 24×24 box; icon-rotate spins it to the
// movement bearing. Ink fill with a white halo keeps it legible over blue radar.
const ARROW_PATH = 'M12 2 L19 11 L14 11 L14 22 L10 22 L10 11 L5 11 Z';
const ARROW_INK = '#2b2115';

// Gentle per-feature multiplier so stronger steering reads a touch larger.
// A fresh array per stop keeps the expression tree free of shared references.
const speedFactor = (): unknown[] => ['interpolate', ['linear'], ['get', 'speed'], 0, 0.78, 60, 1.25];

/** Zoom-driven size with the speed factor folded into each stop's output.
 *  `["zoom"]` must be the top-level interpolate input, so the speed expression
 *  lives inside the outputs rather than wrapping the whole thing. */
const ARROW_SIZE: unknown[] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  6, ['*', 0.5, speedFactor()],
  10, ['*', 0.85, speedFactor()],
];

function registerArrowIcon(map: MapLibreMap): void {
  if (map.hasImage(ARROW_ICON)) return;
  const canvas = document.createElement('canvas');
  canvas.width = ARROW_PX;
  canvas.height = ARROW_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const margin = 5;
  const scale = (ARROW_PX - margin * 2) / 24;
  ctx.translate(margin, margin);
  ctx.scale(scale, scale);
  const arrow = new Path2D(ARROW_PATH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(arrow);
  ctx.fillStyle = ARROW_INK;
  ctx.fill(arrow);
  const image = ctx.getImageData(0, 0, ARROW_PX, ARROW_PX);
  if (!map.hasImage(ARROW_ICON)) map.addImage(ARROW_ICON, image, { pixelRatio: 2 });
}

function ensureArrowLayer(map: MapLibreMap): void {
  if (map.getSource(ARROW_SOURCE)) return;
  registerArrowIcon(map);
  map.addSource(ARROW_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer(
    {
      id: ARROW_LAYER,
      type: 'symbol',
      source: ARROW_SOURCE,
      layout: {
        'icon-image': ARROW_ICON,
        'icon-size': ARROW_SIZE as never,
        'icon-rotate': ['get', 'bearing'] as never,
        // Rotate in map space so an arrow points at a true geographic bearing.
        'icon-rotation-alignment': 'map',
        // The grid is sparse and every arrow matters, so never drop one.
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        // Start transparent so the first enable fades in via the opacity transition.
        'icon-opacity': 0,
        'icon-opacity-transition': { duration: overlayFadeMs() },
      },
    },
    // Anchor beneath the score circles so pins stay dominant on top.
    map.getLayer(PLACE_CIRCLES_LAYER) ? PLACE_CIRCLES_LAYER : undefined,
  );
}

/**
 * Draw the given arrows (adding source + layer on first use), or fade the layer
 * out when `arrows` is null. Toggling drives icon-opacity (0 <-> ARROW_OPACITY)
 * instead of hard visibility so arrows ease in/out; the grid is sparse, so a
 * transparent layer left in place is cheap and needs no hide/lifecycle juggling.
 * After setting data the layer is re-anchored just below the pins so it stays
 * above a radar layer that may have been added later.
 */
export function updateWindArrows(map: MapLibreMap, arrows: WindArrow[] | null): void {
  if (arrows === null) {
    if (map.getLayer(ARROW_LAYER)) {
      map.setPaintProperty(ARROW_LAYER, 'icon-opacity-transition', { duration: overlayFadeMs() });
      map.setPaintProperty(ARROW_LAYER, 'icon-opacity', 0);
    }
    return;
  }
  ensureArrowLayer(map);
  const source = map.getSource(ARROW_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: arrows.map((a) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [a.lon, a.lat] },
      properties: { bearing: a.bearing, speed: a.speedKmh },
    })),
  });
  // Keep arrows above the radar wash (added lazily, possibly after this layer)
  // but below the pins.
  if (map.getLayer(ARROW_LAYER) && map.getLayer(PLACE_CIRCLES_LAYER)) {
    map.moveLayer(ARROW_LAYER, PLACE_CIRCLES_LAYER);
  }
  if (map.getLayer(ARROW_LAYER)) {
    map.setPaintProperty(ARROW_LAYER, 'icon-opacity-transition', { duration: overlayFadeMs() });
    map.setPaintProperty(ARROW_LAYER, 'icon-opacity', ARROW_OPACITY);
  }
}
