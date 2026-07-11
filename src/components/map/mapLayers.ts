import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, ImageSource, Map as MapLibreMap } from 'maplibre-gl';
import { circleRing } from '../../core/geo';
import type { LatLon, ScoredPlace } from '../../core/types';
import { scoreStepExpression, scoreTextStepExpression } from '../../lib/scoreColor';
import type { OverlayMode, OverlayStyle } from '../../state/store';
import { computeFieldImage, type FieldPoint } from './weatherField';

export const PLACES_SOURCE = 'places';
export const PLACE_CIRCLES_LAYER = 'place-circles';
const PLACE_SCORES_TOP_LAYER = 'place-scores-top';
const PLACE_SCORES_REST_LAYER = 'place-scores-rest';
const RADIUS_SOURCE = 'travel-radius';
const RADIUS_LAYER = 'travel-radius-line';
const WEATHER_HEATMAP_LAYER = 'weather-heatmap';
const WEATHER_FIELD_SOURCE = 'weather-field';
const WEATHER_FIELD_LAYER = 'weather-field-raster';

// 1×1 transparent PNG the image source starts on before a field is computed.
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PLACEHOLDER_COORDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

// Density → color ramps for the weather wash. Transparent at the low end so the
// base map shows through, saturating toward the mode's signature hue.
const SUN_RAMP: unknown[] = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0, 'rgba(255, 214, 109, 0)',
  0.15, 'rgba(255, 207, 110, 0.35)',
  0.5, 'rgba(242, 179, 61, 0.62)',
  1, 'rgba(231, 149, 20, 0.85)',
];
const RAIN_RAMP: unknown[] = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0, 'rgba(74, 134, 197, 0)',
  0.15, 'rgba(90, 139, 191, 0.32)',
  0.5, 'rgba(74, 134, 197, 0.58)',
  1, 'rgba(40, 90, 150, 0.82)',
];

// value (0–100 on the active property) → heatmap weight (0–1)
const weightExpression = (prop: 'sun' | 'wet'): unknown[] => [
  'interpolate',
  ['linear'],
  ['get', prop],
  0, 0,
  100, 1,
];

/** Ranks up to this get full labeled circles at every zoom; the rest are dots until zoomed in. */
const TOP_RANKS = 12;
const REST_LABEL_MIN_ZOOM = 7;

const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

const isTopTier = ['any', ['<=', ['get', 'rank'], TOP_RANKS], ['==', ['get', 'kind'], 'pin'], ['get', 'selected']];

function radiusExpression(restRadius: number): unknown[] {
  return [
    'case',
    ['get', 'selected'],
    16,
    ['==', ['get', 'kind'], 'pin'],
    12,
    ['<=', ['get', 'rank'], TOP_RANKS],
    ['interpolate', ['linear'], ['get', 'score'], 0, 9, 100, 13],
    restRadius,
  ];
}

export function addMapLayers(map: MapLibreMap): void {
  map.addSource(RADIUS_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION });
  map.addSource(PLACES_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION });

  // Added first so the wash sits above the base map but beneath the radius
  // ring, score circles, and pins. Starts hidden; applyOverlay() reveals it.
  map.addLayer({
    id: WEATHER_HEATMAP_LAYER,
    type: 'heatmap',
    source: PLACES_SOURCE,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': weightExpression('sun') as never,
      'heatmap-color': SUN_RAMP as never,
      // Big radius blends sparse cities into a smooth field; grows with zoom.
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4, 20,
        7, 38,
        11, 64,
      ] as never,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1, 11, 1.6] as never,
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 11, 0.42] as never,
    },
  });

  // Interpolated field: a geo-anchored image, updated in place as data changes.
  // Also below the pins; only one of heatmap/field is ever visible at a time.
  map.addSource(WEATHER_FIELD_SOURCE, {
    type: 'image',
    url: TRANSPARENT_PNG,
    coordinates: PLACEHOLDER_COORDS,
  });
  map.addLayer({
    id: WEATHER_FIELD_LAYER,
    type: 'raster',
    source: WEATHER_FIELD_SOURCE,
    layout: { visibility: 'none' },
    paint: {
      'raster-opacity': 0.92,
      'raster-resampling': 'linear',
      'raster-fade-duration': 0,
    },
  });

  map.addLayer({
    id: RADIUS_LAYER,
    type: 'line',
    source: RADIUS_SOURCE,
    paint: {
      'line-color': '#c97a06',
      'line-width': 1.5,
      'line-opacity': 0.55,
      'line-dasharray': [3, 3],
    },
  });

  map.addLayer({
    id: PLACE_CIRCLES_LAYER,
    type: 'circle',
    source: PLACES_SOURCE,
    paint: {
      'circle-color': scoreStepExpression('score') as never,
      // ["zoom"] may only drive a top-level interpolate, so the kind/rank
      // branching repeats per zoom stop with a different long-tail dot size
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,
        radiusExpression(4.5),
        9,
        radiusExpression(9),
      ] as never,
      'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'pin'], '#2b2115', '#fffdf7'] as never,
      'circle-stroke-width': [
        'case',
        ['get', 'selected'],
        3,
        ['==', ['get', 'kind'], 'pin'],
        2.5,
        1.5,
      ] as never,
      'circle-opacity': ['case', isTopTier as never, 0.95, 0.75] as never,
    },
  });

  const symbolLayout = {
    'text-field': ['to-string', ['get', 'score']] as never,
    'text-font': ['Noto Sans Bold'],
    'text-allow-overlap': true,
    'symbol-sort-key': ['-', 100, ['get', 'score']] as never,
  };
  const symbolPaint = { 'text-color': scoreTextStepExpression('score') as never };

  map.addLayer({
    id: PLACE_SCORES_TOP_LAYER,
    type: 'symbol',
    source: PLACES_SOURCE,
    filter: isTopTier as never,
    layout: { ...symbolLayout, 'text-size': ['case', ['get', 'selected'], 13, 11] as never },
    paint: symbolPaint,
  });

  // long-tail labels only appear once zoomed in enough to have room
  map.addLayer({
    id: PLACE_SCORES_REST_LAYER,
    type: 'symbol',
    source: PLACES_SOURCE,
    filter: ['!', isTopTier] as never,
    minzoom: REST_LABEL_MIN_ZOOM,
    layout: { ...symbolLayout, 'text-size': 10 },
    paint: symbolPaint,
  });
}

/** Cloud+rain "wetness" (0–100) for the best day: overcast and rain-likely = high. */
function wetness(scored: ScoredPlace): number {
  const cloud = scored.best.cloudCoverMean;
  const rain = scored.best.precipProbMax;
  return Math.round(Math.min(100, Math.max(0, 0.45 * cloud + 0.55 * rain)));
}

function setLayerVisible(map: MapLibreMap, id: string, visible: boolean): void {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

/**
 * Drive the weather wash from the current mode + style. Only one renderer is
 * ever visible: 'glow' uses the GPU heatmap, 'field' rebuilds the interpolated
 * image from the same points. Both sit below the pins.
 */
export function updateOverlay(
  map: MapLibreMap,
  results: ScoredPlace[],
  pinned: ScoredPlace[],
  mode: OverlayMode,
  style: OverlayStyle,
): void {
  const glowOn = mode !== 'off' && style === 'glow';
  const fieldOn = mode !== 'off' && style === 'field';

  setLayerVisible(map, WEATHER_HEATMAP_LAYER, glowOn);
  if (glowOn) {
    map.setPaintProperty(WEATHER_HEATMAP_LAYER, 'heatmap-weight', weightExpression(mode === 'sun' ? 'sun' : 'wet') as never);
    map.setPaintProperty(WEATHER_HEATMAP_LAYER, 'heatmap-color', (mode === 'sun' ? SUN_RAMP : RAIN_RAMP) as never);
  }

  const source = map.getSource(WEATHER_FIELD_SOURCE) as ImageSource | undefined;
  if (fieldOn && source) {
    const points: FieldPoint[] = [...results, ...pinned].map((s) => ({
      lon: s.place.lon,
      lat: s.place.lat,
      sun: s.score,
      wet: wetness(s),
    }));
    const image = computeFieldImage(points, mode);
    if (image) {
      source.updateImage({ url: image.url, coordinates: image.coordinates });
      setLayerVisible(map, WEATHER_FIELD_LAYER, true);
    } else {
      setLayerVisible(map, WEATHER_FIELD_LAYER, false);
    }
  } else {
    setLayerVisible(map, WEATHER_FIELD_LAYER, false);
  }
}

export function updatePlaces(
  map: MapLibreMap,
  results: ScoredPlace[],
  pinned: ScoredPlace[],
  selectedKey: string | null,
): void {
  const source = map.getSource(PLACES_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;

  const toFeature = (scored: ScoredPlace, rank: number) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [scored.place.lon, scored.place.lat] },
    properties: {
      key: scored.place.key,
      kind: scored.place.kind,
      score: scored.score,
      // Field values for the weather wash (0–100): the score for the sun mode,
      // a cloud+rain blend for the rain mode. Both ride along so switching modes
      // never needs new data.
      sun: scored.score,
      wet: wetness(scored),
      rank,
      name: scored.place.name,
      selected: scored.place.key === selectedKey,
    },
  });

  // ascending score so the sunniest circles paint on top; pins last of all
  const features = [...results]
    .map((scored, i) => ({ scored, rank: i + 1 }))
    .sort((a, b) => a.scored.score - b.scored.score)
    .map(({ scored, rank }) => toFeature(scored, rank));
  for (const pin of pinned) features.push(toFeature(pin, 0));

  source.setData({ type: 'FeatureCollection', features });
}

export function updateRadius(map: MapLibreMap, center: LatLon, radiusKm: number): void {
  const source = map.getSource(RADIUS_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: circleRing(center, radiusKm) },
    properties: {},
  });
}

export interface FitPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function fitToRadius(map: MapLibreMap, center: LatLon, radiusKm: number, padding: FitPadding): void {
  const ring = circleRing(center, radiusKm, 32);
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  map.fitBounds(
    [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
    { padding, duration: 900, maxZoom: 11 },
  );
}
