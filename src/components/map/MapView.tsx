import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { TRAVEL_TIERS } from '../../core/candidates/tiers';
import type { ScoredPlace } from '../../core/types';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAppStore } from '../../state/store';
import {
  addMapLayers,
  fitToRadius,
  PLACE_CIRCLES_LAYER,
  updatePlaces,
  updateRadius,
  type FitPadding,
} from './mapLayers';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const EUROPE_CENTER: [number, number] = [15, 50];

function makeUserMarkerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'user-marker';
  el.innerHTML = '<div class="user-marker-pulse"></div><div class="user-marker-dot"></div>';
  return el;
}

interface MapViewProps {
  results: ScoredPlace[];
  pinned: ScoredPlace[];
}

export function MapView({ results, pinned }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [isMapReady, setMapReady] = useState(false);

  const origin = useAppStore((s) => s.origin);
  const tier = useAppStore((s) => s.tier);
  const selectedPlaceKey = useAppStore((s) => s.selectedPlaceKey);
  const isMobile = useIsMobile();

  const fitPadding: FitPadding = isMobile
    ? { top: 130, bottom: Math.round(window.innerHeight * 0.28), left: 36, right: 36 }
    : { top: 110, bottom: 60, left: 460, right: 70 };

  // map lifecycle — init once
  useEffect(() => {
    if (!containerRef.current) return;
    const startOrigin = useAppStore.getState().origin;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: startOrigin ? [startOrigin.lon, startOrigin.lat] : EUROPE_CENTER,
      zoom: startOrigin ? 6 : 3.3,
      attributionControl: { compact: true, customAttribution: 'Weather: Open-Meteo · Places: GeoNames' },
    });

    map.on('load', () => {
      addMapLayers(map);
      setMapReady(true);
    });
    map.on('click', (e) => {
      if (!map.getLayer(PLACE_CIRCLES_LAYER)) return; // style still loading
      const hits = map.queryRenderedFeatures(e.point, { layers: [PLACE_CIRCLES_LAYER] });
      const key = hits.length > 0 ? (hits[0].properties?.key as string) : null;
      useAppStore.getState().selectPlace(key ?? null);
    });
    map.on('mouseenter', PLACE_CIRCLES_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', PLACE_CIRCLES_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // place markers follow results + pins + selection
  useEffect(() => {
    if (isMapReady && mapRef.current) updatePlaces(mapRef.current, results, pinned, selectedPlaceKey);
  }, [isMapReady, results, pinned, selectedPlaceKey]);

  // origin marker, radius ring, and camera follow origin + tier
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
