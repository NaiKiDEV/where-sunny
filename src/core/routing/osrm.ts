/**
 * OSRM demo-server routing client (docs/plans/travel-ready.md §5). Free, no
 * key, CORS `*`. Fair use: fetch only from explicit one-shot surfaces (detail
 * open, trips view) and cache aggressively - never per result-grid item. One
 * request returns one leg per consecutive coordinate pair, so a whole trip is
 * a single call. OSRM paths take lon,lat order - the classic trap. Fetching
 * injects `fetchImpl` for tests; URL building and parsing are pure helpers.
 */
import { haversineKm } from '../geo';
import type { LatLon } from '../types';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
/** 4 dp ≈ 11 m - ample routing precision, stable cache keys. */
const COORD_DECIMALS = 4;
/** Straight-line chain length beyond which it's flight territory - skip the request. */
const MAX_DRIVE_CHAIN_KM = 2000;

const SECONDS_PER_MINUTE = 60;
const METERS_PER_KM = 1000;

export interface DriveLeg {
  minutes: number;
  km: number;
}

export interface DriveRoute {
  legs: DriveLeg[];
  totalMinutes: number;
  totalKm: number;
}

/** Boundary validation for the routed URL: fail fast on malformed input. */
function assertRoutable(coords: LatLon[]): void {
  if (coords.length < 2) {
    throw new Error(`Drive route needs at least 2 coordinates, got ${coords.length}`);
  }
  for (const { lat, lon } of coords) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`Invalid coordinate (${lat}, ${lon}) - lat/lon must be finite numbers`);
    }
  }
}

/** Stable `lon,lat;lon,lat` path from 4-dp-rounded coords - shared by the URL and cache keys. */
export function driveCoordKey(coords: LatLon[]): string {
  return coords
    .map((c) => `${c.lon.toFixed(COORD_DECIMALS)},${c.lat.toFixed(COORD_DECIMALS)}`)
    .join(';');
}

/** Routed URL for the chain; `overview=false` drops the geometry we never render. */
export function buildDriveRouteUrl(coords: LatLon[]): string {
  assertRoutable(coords);
  return `${OSRM_BASE}/${driveCoordKey(coords)}?overview=false`;
}

/**
 * Whether a coordinate chain is plausibly drive-planning territory: at least
 * two finite coords whose summed straight-line distance stays within
 * 2,000 km. A gate, not a validator - malformed input answers false so
 * callers (the hook) simply skip the request.
 */
export function isWithinDriveRange(coords: LatLon[]): boolean {
  if (coords.length < 2) return false;
  if (coords.some(({ lat, lon }) => !Number.isFinite(lat) || !Number.isFinite(lon))) return false;
  let chainKm = 0;
  for (let i = 1; i < coords.length; i++) {
    chainKm += haversineKm(coords[i - 1], coords[i]);
  }
  return chainKm <= MAX_DRIVE_CHAIN_KM;
}

interface OsrmRouteJson {
  code?: string;
  routes?: {
    duration?: number; // seconds
    distance?: number; // meters
    legs?: { duration?: number; distance?: number }[];
  }[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toMinutes(seconds: number): number {
  return Math.round(seconds / SECONDS_PER_MINUTE);
}

/** One decimal keeps short hops meaningful ("55.5 km") without false precision. */
function toKm(meters: number): number {
  return Math.round((meters / METERS_PER_KM) * 10) / 10;
}

/**
 * Route payload → DriveRoute, or null for anything OSRM-shaped-but-unusable:
 * `code !== "Ok"`, missing/empty routes, a leg count that doesn't match the
 * requested chain, or non-finite numbers. Totals come from the route-level
 * sums, not re-added rounded legs.
 */
export function parseDriveRoute(json: unknown, expectedLegs: number): DriveRoute | null {
  const body = json as OsrmRouteJson;
  if (body.code !== 'Ok') return null;
  const route = body.routes?.[0];
  if (!route || !isFiniteNumber(route.duration) || !isFiniteNumber(route.distance)) return null;
  if (!route.legs || route.legs.length !== expectedLegs) return null;

  const legs: DriveLeg[] = [];
  for (const leg of route.legs) {
    if (!isFiniteNumber(leg.duration) || !isFiniteNumber(leg.distance)) return null;
    legs.push({ minutes: toMinutes(leg.duration), km: toKm(leg.distance) });
  }
  return { legs, totalMinutes: toMinutes(route.duration), totalKm: toKm(route.distance) };
}

/**
 * Driven route across the coordinate chain, or null whenever OSRM can't
 * answer (non-OK HTTP, `code !== "Ok"`, leg-count mismatch, network failure)
 * - callers silently fall back to the existing straight-line display. Throws
 * only on boundary-invalid input (fewer than 2 coords, non-finite numbers).
 */
export async function fetchDriveRoute(
  coords: LatLon[],
  fetchImpl: typeof fetch = fetch,
): Promise<DriveRoute | null> {
  const url = buildDriveRouteUrl(coords); // validates before any I/O
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    return parseDriveRoute(await res.json(), coords.length - 1);
  } catch {
    return null;
  }
}
