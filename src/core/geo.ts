import type { LatLon } from './types';

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.lat * DEG_TO_RAD) * Math.cos(b.lat * DEG_TO_RAD) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Snap a coordinate to a coarse grid so nearby origins share cache keys. */
export function snapToGrid(value: number, step = 0.05): number {
  return Math.round(value / step) * step;
}

/**
 * Circle around a center as a closed GeoJSON ring ([lon, lat] pairs),
 * computed with the spherical destination-point formula.
 */
export function circleRing(center: LatLon, radiusKm: number, steps = 96): [number, number][] {
  const latRad = center.lat * DEG_TO_RAD;
  const lonRad = center.lon * DEG_TO_RAD;
  const angular = radiusKm / EARTH_RADIUS_KM;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(latRad) * Math.cos(angular) +
        Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
    );
    const lon =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(lat),
      );
    ring.push([lon * RAD_TO_DEG, lat * RAD_TO_DEG]);
  }
  return ring;
}
