import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { circleRing } from '../../core/geo';
import type { LatLon, ScoredPlace } from '../../core/types';
import { scoreStepExpression, scoreTextStepExpression } from '../../lib/scoreColor';

export const PLACES_SOURCE = 'places';
export const PLACE_CIRCLES_LAYER = 'place-circles';
const PLACE_SCORES_TOP_LAYER = 'place-scores-top';
const PLACE_SCORES_REST_LAYER = 'place-scores-rest';
const RADIUS_SOURCE = 'travel-radius';
const RADIUS_LAYER = 'travel-radius-line';

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
