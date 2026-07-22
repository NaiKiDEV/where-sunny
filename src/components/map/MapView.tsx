import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import type { Airport } from '../../core/airports/types';
import { airportToPlace } from '../../core/airports/types';
import { TRAVEL_TIERS } from '../../core/candidates/tiers';
import { fetchRadarIndex, RADAR_REFRESH_MS, radarFrames } from '../../core/radar/rainviewer';
import type { ScoredPlace } from '../../core/types';
import {
  fetchSteeringWind,
  gridPoints,
  MIN_ARROW_ZOOM,
  type GridBounds,
} from '../../core/wind/steering';
import { useBannedFilter } from '../../hooks/useBannedFilter';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAppStore } from '../../state/store';
import {
  addAirportLayers,
  addMapLayers,
  AIRPORT_ICONS_LAYER,
  fitToRadius,
  PLACE_CIRCLES_LAYER,
  updateAirports,
  updateBannedCountries,
  updateOverlay,
  updatePlaces,
  updateRadius,
  type FitPadding,
} from './mapLayers';
import { updateRadarLayer } from './radarLayer';
import { updateWindArrows } from './windArrowLayer';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const EUROPE_CENTER: [number, number] = [15, 50];
/** How long to wait after a pan/zoom settles before refetching arrow data. */
const ARROW_MOVE_DEBOUNCE_MS = 400;
/** Radar playback cadence: one frame step per this interval while playing. */
const RADAR_PLAY_INTERVAL_MS = 600;

/**
 * queryRenderedFeatures can throw "Out of bounds..." from MapLibre when a
 * queried GeoJSON source currently holds an empty tile - results not loaded
 * yet, or a layer's source sitting empty between updates (the wind-arrow source
 * when arrows are off or zoomed out). A failed hit-test just means "nothing
 * here", so treat a throw as no features rather than letting it surface.
 */
function safeQueryRenderedFeatures(
  map: maplibregl.Map,
  geometry: maplibregl.PointLike | [maplibregl.PointLike, maplibregl.PointLike],
  layers: string[],
): maplibregl.MapGeoJSONFeature[] {
  try {
    return map.queryRenderedFeatures(geometry, { layers });
  } catch {
    return [];
  }
}

function makeUserMarkerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'user-marker';
  el.innerHTML = '<div class="user-marker-pulse"></div><div class="user-marker-dot"></div>';
  return el;
}

const EMPTY_COUNTRIES: FeatureCollection = { type: 'FeatureCollection', features: [] };

// The FULL country collection is fetched once and cached so remounts and ban
// changes reuse it - only the (cheap) subset filter re-runs when the effective
// ban set changes. The overlay is non-critical, so a fetch failure resolves to
// an empty collection rather than throwing.
let allCountriesPromise: Promise<FeatureCollection> | null = null;

function loadAllCountries(): Promise<FeatureCollection> {
  if (!allCountriesPromise) {
    allCountriesPromise = fetch(`${import.meta.env.BASE_URL}data/countries.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`countries.json: HTTP ${res.status}`);
        return res.json() as Promise<FeatureCollection>;
      })
      .catch(() => EMPTY_COUNTRIES);
  }
  return allCountriesPromise;
}

function bannedSubset(all: FeatureCollection, codes: ReadonlySet<string>): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: all.features.filter((f) => {
      const code = f.properties?.code;
      return typeof code === 'string' && codes.has(code.toUpperCase());
    }),
  };
}

interface MapViewProps {
  results: ScoredPlace[];
  pinned: ScoredPlace[];
  airports: Airport[];
}

export function MapView({ results, pinned, airports }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Keyed lookup so the (once-registered) click handler can resolve an airport
  // hit to its full record without re-subscribing to the airports array.
  const airportsByKey = useRef<Map<string, Airport>>(new Map());
  const overlayFrameRef = useRef<number | null>(null);
  // Radar tile templates by frame index; kept out of the store (which holds only
  // frame times/kind) so the playback effects can swap tiles without re-renders.
  const radarFrameUrlsRef = useRef<string[]>([]);
  const [isMapReady, setMapReady] = useState(false);

  const origin = useAppStore((s) => s.origin);
  const tier = useAppStore((s) => s.tier);
  const selectedPlaceKey = useAppStore((s) => s.selectedPlaceKey);
  const overlay = useAppStore((s) => s.overlay);
  const overlayStyle = useAppStore((s) => s.overlayStyle);
  const windArrows = useAppStore((s) => s.windArrows);
  const radarFrameIndex = useAppStore((s) => s.radarFrameIndex);
  const radarPlaying = useAppStore((s) => s.radarPlaying);
  const { codes: bannedCodes } = useBannedFilter();
  const isMobile = useIsMobile();

  const fitPadding: FitPadding = isMobile
    ? { top: 130, bottom: Math.round(window.innerHeight * 0.28), left: 36, right: 36 }
    : { top: 110, bottom: 60, left: 460, right: 70 };

  useEffect(() => {
    if (!containerRef.current) return;
    const startOrigin = useAppStore.getState().origin;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: startOrigin ? [startOrigin.lon, startOrigin.lat] : EUROPE_CENTER,
      zoom: startOrigin ? 6 : 3.3,
      attributionControl: {
        compact: true,
        customAttribution: 'Weather: Open-Meteo · Places: GeoNames · Airports: OurAirports · Radar: RainViewer',
      },
    });

    map.on('load', () => {
      addMapLayers(map);
      addAirportLayers(map);
      setMapReady(true);
    });
    map.on('click', (e) => {
      if (!map.getLayer(PLACE_CIRCLES_LAYER)) return; // style still loading
      // A ranked place wins over an airport sharing the same spot; an airport
      // opens as a preview (its own forecast + detail), empty space closes.
      const placeHits = safeQueryRenderedFeatures(map, e.point, [PLACE_CIRCLES_LAYER]);
      if (placeHits.length > 0) {
        useAppStore.getState().selectPlace((placeHits[0].properties?.key as string) ?? null);
        return;
      }
      if (map.getLayer(AIRPORT_ICONS_LAYER)) {
        // Airports render as small plane icons, so query a few px around the click
        // instead of demanding a pixel-perfect hit, then take the nearest one.
        const pad = 8;
        const airportHits = safeQueryRenderedFeatures(
          map,
          [
            [e.point.x - pad, e.point.y - pad],
            [e.point.x + pad, e.point.y + pad],
          ],
          [AIRPORT_ICONS_LAYER],
        );
        let airport: Airport | undefined;
        let bestDist = Infinity;
        for (const hit of airportHits) {
          const found = airportsByKey.current.get(hit.properties?.key as string);
          if (!found) continue;
          const p = map.project([found.lon, found.lat]);
          const dist = (p.x - e.point.x) ** 2 + (p.y - e.point.y) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            airport = found;
          }
        }
        if (airport) {
          useAppStore.getState().setPreviewPlace(airportToPlace(airport));
          return;
        }
      }
      useAppStore.getState().selectPlace(null);
    });
    for (const layer of [PLACE_CIRCLES_LAYER, AIRPORT_ICONS_LAYER]) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isMapReady && mapRef.current) updatePlaces(mapRef.current, results, pinned, selectedPlaceKey);
  }, [isMapReady, results, pinned, selectedPlaceKey]);

  // airport reference layer: always shown, brought forward (emphasized) in
  // flight mode - the tier you'd actually fly for.
  useEffect(() => {
    airportsByKey.current = new Map(airports.map((a) => [a.key, a]));
    if (isMapReady && mapRef.current) updateAirports(mapRef.current, airports, tier === 'flight');
  }, [isMapReady, airports, tier]);

  // banned-country overlay: fetch all countries once, then repaint the banned
  // subset whenever the effective ban set changes so user picks shade at once.
  useEffect(() => {
    if (!isMapReady) return;
    let cancelled = false;
    loadAllCountries().then((all) => {
      const map = mapRef.current;
      if (!cancelled && map) updateBannedCountries(map, bannedSubset(all, bannedCodes));
    });
    return () => {
      cancelled = true;
    };
  }, [isMapReady, bannedCodes]);

  // Coalesce overlay refreshes to one per frame: as forecasts stream in,
  // results/pinned change in bursts and each field rebuild kicks off an async
  // image decode. Superseding an in-flight decode makes MapLibre log an aborted
  // "source image could not be decoded" error, so collapse bursts to the latest.
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    if (overlayFrameRef.current !== null) cancelAnimationFrame(overlayFrameRef.current);
    overlayFrameRef.current = requestAnimationFrame(() => {
      overlayFrameRef.current = null;
      // Radar mode paints provider tiles instead, so the forecast wash goes dark.
      const washMode = overlay === 'radar' ? 'off' : overlay;
      if (mapRef.current) updateOverlay(mapRef.current, results, pinned, washMode, overlayStyle);
    });
    return () => {
      if (overlayFrameRef.current !== null) {
        cancelAnimationFrame(overlayFrameRef.current);
        overlayFrameRef.current = null;
      }
    };
  }, [isMapReady, results, pinned, overlay, overlayStyle]);

  // Live rain radar: entering radar mode loads the full past+nowcast frame list
  // (for the timeline to scrub) and paints "now", refreshing on a fixed cadence;
  // leaving hides the layer and clears playback. Radar is non-critical, so a
  // failed load just keeps whatever is already shown. Tile templates live in a
  // ref; the store carries only frame times/kind + the playhead.
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;
    if (overlay !== 'radar') {
      updateRadarLayer(map, null);
      radarFrameUrlsRef.current = [];
      const store = useAppStore.getState();
      store.setRadarPlaying(false);
      store.setRadarFrames([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchRadarIndex()
        .then((index) => {
          if (cancelled || !mapRef.current) return;
          const frames = radarFrames(index);
          if (frames.length === 0) return;
          radarFrameUrlsRef.current = frames.map((f) => f.url);
          const store = useAppStore.getState();
          const wasEmpty = store.radarFrames.length === 0;
          const lastPast = frames.map((f) => f.kind).lastIndexOf('past');
          const nowIdx = lastPast === -1 ? frames.length - 1 : lastPast;
          // Home to "now" on first load or while paused; never yank a playing
          // animation off its current frame.
          const targetIdx =
            wasEmpty || !store.radarPlaying
              ? nowIdx
              : Math.min(store.radarFrameIndex, frames.length - 1);
          store.setRadarFrames(frames.map((f) => ({ time: f.time, kind: f.kind })));
          store.setRadarFrameIndex(targetIdx);
          updateRadarLayer(mapRef.current, radarFrameUrlsRef.current[targetIdx]);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, RADAR_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isMapReady, overlay]);

  // Radar playback: while playing, step the shared playhead on a fixed cadence.
  // The render effect below turns each index into a tile swap.
  useEffect(() => {
    if (overlay !== 'radar' || !radarPlaying) return;
    const timer = window.setInterval(() => {
      useAppStore.getState().stepRadarFrame();
    }, RADAR_PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [overlay, radarPlaying]);

  // Paint the frame the playhead points at (scrubbed or stepped by playback).
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || overlay !== 'radar') return;
    const url = radarFrameUrlsRef.current[radarFrameIndex];
    if (url) updateRadarLayer(map, url);
  }, [isMapReady, overlay, radarFrameIndex]);

  // Rain-movement arrows: only while enabled AND zoomed to a regional scale, so
  // a continental view never pulls a wall of wind data. A coarse grid over the
  // current viewport feeds one Open-Meteo request; pans/zooms refetch after a
  // debounce. Arrows are non-critical, so a failed fetch keeps the last frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;
    if (!windArrows) {
      updateWindArrows(map, null);
      return;
    }
    let cancelled = false;
    let requestToken = 0;
    let debounceTimer: number | null = null;

    const refresh = () => {
      const m = mapRef.current;
      if (!m) return;
      if (m.getZoom() < MIN_ARROW_ZOOM) {
        updateWindArrows(m, null);
        return;
      }
      const b = m.getBounds();
      const bounds: GridBounds = {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      };
      const token = ++requestToken;
      fetchSteeringWind(gridPoints(bounds))
        .then((arrows) => {
          if (!cancelled && token === requestToken && mapRef.current) {
            updateWindArrows(mapRef.current, arrows);
          }
        })
        .catch(() => {});
    };

    const onMoveEnd = () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(refresh, ARROW_MOVE_DEBOUNCE_MS);
    };

    refresh();
    map.on('moveend', onMoveEnd);
    return () => {
      cancelled = true;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      map.off('moveend', onMoveEnd);
      if (mapRef.current) updateWindArrows(mapRef.current, null);
    };
  }, [isMapReady, windArrows]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !origin) return;
    const radiusKm = TRAVEL_TIERS[tier].radiusKm;
    updateRadius(map, origin, radiusKm);
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({ element: makeUserMarkerElement() });
      userMarkerRef.current.setLngLat([origin.lon, origin.lat]).addTo(map);
    } else {
      userMarkerRef.current.setLngLat([origin.lon, origin.lat]);
    }
    fitToRadius(map, origin, radiusKm, fitPadding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapReady, origin, tier]);

  // center on the selected place so it is visible next to the panel/drawer
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || selectedPlaceKey === null) return;
    const selected =
      results.find((r) => r.place.key === selectedPlaceKey) ??
      pinned.find((r) => r.place.key === selectedPlaceKey);
    if (!selected) return;
    map.easeTo({ center: [selected.place.lon, selected.place.lat], duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapReady, selectedPlaceKey]);

  return <div ref={containerRef} className="map-container" aria-label="Map of sunny places" />;
}
