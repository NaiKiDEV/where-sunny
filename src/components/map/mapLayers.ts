import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, ImageSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Airport } from '../../core/airports/types';
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
const BANNED_SOURCE = 'banned-countries';
const BANNED_FILL_LAYER = 'banned-countries-fill';
const BANNED_HATCH_LAYER = 'banned-countries-hatch';
const BANNED_OUTLINE_LAYER = 'banned-countries-outline';
const BAN_HATCH_IMAGE = 'ban-hatch';

// Shared red for the "blocked out" country overlay: translucent fill, ✕ hatch, hard border.
const BANNED_RED = '#d1332e';
const BAN_HATCH_SIZE = 16;

const AIRPORTS_SOURCE = 'airports';
export const AIRPORT_ICONS_LAYER = 'airport-icons';
const AIRPORT_LABELS_LAYER = 'airport-labels';
const AIRPORT_ICON = 'airport-plane';
// Below this zoom, collision detection thins the icon field so planes don't
// carpet the continental view; at/above it every icon stays put, so an airport
// you're zooming toward never vanishes before you arrive.
const AIRPORT_DECLUTTER_MAX_ZOOM = 6;
// Cool sky-blue so airports read as a transport reference layer, clearly distinct
// from the gold sun-score circles. Matches --color-sky in tokens.css.
const AIRPORT_BLUE = '#2f6ea6';
// Quiet (any non-flight mode): only large airports show a code label, and only
// once zoomed in. Emphasized (flight mode): every airport with a code is labelled.
const AIRPORT_LABEL_FILTER_QUIET = ['all', ['get', 'large'], ['!=', ['get', 'iata'], '']];
const AIRPORT_LABEL_FILTER_EMPHASIZED = ['!=', ['get', 'iata'], ''];

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

/**
 * Register the ✕ cross-hatch used by the banned-country fill, once. Drawn on a
 * small transparent canvas (two diagonals in semi-opaque red) and added at 2×
 * pixel ratio so it stays crisp. No-op if the image already exists.
 */
function registerBanHatch(map: MapLibreMap): void {
  if (map.hasImage(BAN_HATCH_IMAGE)) return;
  const canvas = document.createElement('canvas');
  canvas.width = BAN_HATCH_SIZE;
  canvas.height = BAN_HATCH_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.strokeStyle = 'rgba(209, 51, 46, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(BAN_HATCH_SIZE, BAN_HATCH_SIZE);
  ctx.moveTo(BAN_HATCH_SIZE, 0);
  ctx.lineTo(0, BAN_HATCH_SIZE);
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, BAN_HATCH_SIZE, BAN_HATCH_SIZE);
  if (!map.hasImage(BAN_HATCH_IMAGE)) map.addImage(BAN_HATCH_IMAGE, imageData, { pixelRatio: 2 });
}

export function addMapLayers(map: MapLibreMap): void {
  map.addSource(RADIUS_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION });
  map.addSource(PLACES_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION });
  map.addSource(BANNED_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION });

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

  // Banned countries are "blocked out": sits above the base map + weather wash
  // but below the place circles/labels, so pins stay legible on top. Filled
  // lazily from public/data/countries.json (see updateBannedCountries).
  registerBanHatch(map);
  map.addLayer({
    id: BANNED_FILL_LAYER,
    type: 'fill',
    source: BANNED_SOURCE,
    paint: {
      'fill-color': BANNED_RED,
      'fill-opacity': 0.18,
    },
  });
  map.addLayer({
    id: BANNED_HATCH_LAYER,
    type: 'fill',
    source: BANNED_SOURCE,
    paint: {
      'fill-pattern': BAN_HATCH_IMAGE,
    },
  });
  map.addLayer({
    id: BANNED_OUTLINE_LAYER,
    type: 'line',
    source: BANNED_SOURCE,
    paint: {
      'line-color': BANNED_RED,
      'line-width': 1.5,
      'line-opacity': 0.9,
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
 * Cross-fade duration (ms) for overlay layers toggling on/off, so ambient layers
 * ease in/out via paint opacity instead of popping. Mirrors the --dur-slow token
 * (320ms) and collapses to 0 under prefers-reduced-motion, so those users get the
 * instant toggle instead of a transition (ANIMATION-LANGUAGE §8). Shared by the
 * radar and wind-arrow layers.
 */
export function overlayFadeMs(): number {
  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return prefersReduced ? 0 : 320;
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

// The plane icon is drawn once at 44px on a 2× canvas → ~22px natural. On-map
// size is then a fraction of that: small hubs stay quiet, large hubs run a touch
// bigger, and flight mode scales everything up. `large` is a per-stop `case` so a
// single top-level zoom `interpolate` carries the size (MapLibre allows only one).
function airportIconSize(emphasized: boolean): unknown[] {
  const lg = emphasized ? [0.62, 0.98] : [0.44, 0.68];
  const md = emphasized ? [0.5, 0.82] : [0.34, 0.5];
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    4,
    ['case', ['get', 'large'], lg[0], md[0]],
    9,
    ['case', ['get', 'large'], lg[1], md[1]],
  ];
}

const PLANE_PX = 44;

/**
 * Register the sky-blue plane glyph (Material "flight" path) once, drawn on a 2×
 * canvas with a white halo so it reads over land or sea. A distinct silhouette —
 * not just a colored dot — is what sets airports apart from the sun-score circles.
 * No-op if already registered.
 */
function registerPlaneIcon(map: MapLibreMap): void {
  if (map.hasImage(AIRPORT_ICON)) return;
  const canvas = document.createElement('canvas');
  canvas.width = PLANE_PX;
  canvas.height = PLANE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const margin = 5;
  const scale = (PLANE_PX - margin * 2) / 24;
  ctx.translate(margin, margin);
  ctx.scale(scale, scale);
  const plane = new Path2D(
    'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  );
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(plane);
  ctx.fillStyle = AIRPORT_BLUE;
  ctx.fill(plane);
  const image = ctx.getImageData(0, 0, PLANE_PX, PLANE_PX);
  if (!map.hasImage(AIRPORT_ICON)) map.addImage(AIRPORT_ICON, image, { pixelRatio: 2 });
}

/**
 * Airports render as a distinct sky-blue plane-icon reference layer, always
 * present but inserted beneath the sun-score circles so ranked places stay
 * dominant. While far out, collision detection thins the field so planes never
 * carpet the map — large hubs win ties via `symbol-sort-key`; from
 * {@link AIRPORT_DECLUTTER_MAX_ZOOM} in, every icon stays visible so you never
 * lose one mid-zoom. Flight mode brings them forward via {@link updateAirports}.
 * Call after addMapLayers so PLACE_CIRCLES_LAYER exists to anchor the insertion.
 */
export function addAirportLayers(map: MapLibreMap): void {
  registerPlaneIcon(map);
  map.addSource(AIRPORTS_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION });
  map.addLayer(
    {
      id: AIRPORT_ICONS_LAYER,
      type: 'symbol',
      source: AIRPORTS_SOURCE,
      layout: {
        'icon-image': AIRPORT_ICON,
        'icon-size': airportIconSize(false) as never,
        // Declutter only while far out; once zoomed in, let every plane stay.
        'icon-allow-overlap': ['step', ['zoom'], false, AIRPORT_DECLUTTER_MAX_ZOOM, true] as never,
        'icon-padding': 3,
        // Large hubs sort first, so collisions drop the smaller field first.
        'symbol-sort-key': ['case', ['get', 'large'], 0, 1] as never,
      },
      paint: {
        'icon-opacity': 0.8,
      },
    },
    PLACE_CIRCLES_LAYER,
  );
  map.addLayer(
    {
      id: AIRPORT_LABELS_LAYER,
      type: 'symbol',
      source: AIRPORTS_SOURCE,
      minzoom: 6,
      filter: AIRPORT_LABEL_FILTER_QUIET as never,
      layout: {
        'text-field': ['get', 'iata'] as never,
        'text-font': ['Noto Sans Bold'],
        'text-size': 10,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': '#1c3d5a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.2,
      },
    },
    PLACE_CIRCLES_LAYER,
  );
}

/**
 * Refresh the airport layer's data and emphasis. `emphasized` (flight mode)
 * enlarges the plane icons, raises their opacity, and labels every coded airport
 * from a lower zoom; otherwise airports stay a quiet reference layer.
 */
export function updateAirports(map: MapLibreMap, airports: Airport[], emphasized: boolean): void {
  const source = map.getSource(AIRPORTS_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: airports.map((a) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [a.lon, a.lat] },
      properties: { key: a.key, iata: a.iata, large: a.large },
    })),
  });
  if (map.getLayer(AIRPORT_ICONS_LAYER)) {
    map.setLayoutProperty(AIRPORT_ICONS_LAYER, 'icon-size', airportIconSize(emphasized) as never);
    map.setPaintProperty(AIRPORT_ICONS_LAYER, 'icon-opacity', emphasized ? 1 : 0.8);
  }
  if (map.getLayer(AIRPORT_LABELS_LAYER)) {
    map.setFilter(
      AIRPORT_LABELS_LAYER,
      (emphasized ? AIRPORT_LABEL_FILTER_EMPHASIZED : AIRPORT_LABEL_FILTER_QUIET) as never,
    );
    map.setLayerZoomRange(AIRPORT_LABELS_LAYER, emphasized ? 4 : 6, 24);
  }
}

/** Fill the banned-country overlay with the (already filtered) territories. */
export function updateBannedCountries(map: MapLibreMap, data: FeatureCollection): void {
  const source = map.getSource(BANNED_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(data);
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
