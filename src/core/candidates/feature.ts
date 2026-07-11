/**
 * Terrain context derived from a place's elevation. The bundled GeoNames data
 * is populated-places only (feature class `P`), so it can't tell us "beach" or
 * "lake" - but elevation is carried per row, and mountain-ness falls straight
 * out of it. Coastal/sea context comes from a Marine API probe on trip stops,
 * not from this dataset. See docs/TRIP-PLANNER.md §3.
 */
export type Terrain = 'alpine' | 'highland' | 'lowland';

/** Alpine ~ tree-line towns and resorts; highland ~ hill country. Metres. */
export const ALPINE_MIN_M = 1500;
export const HIGHLAND_MIN_M = 500;

export const TERRAIN_LABEL: Record<Terrain, string> = {
  alpine: 'Alpine',
  highland: 'Highland',
  lowland: 'Lowland',
};

export function terrainOf(elevation: number | undefined): Terrain | undefined {
  if (elevation === undefined || !Number.isFinite(elevation)) return undefined;
  if (elevation >= ALPINE_MIN_M) return 'alpine';
  if (elevation >= HIGHLAND_MIN_M) return 'highland';
  return 'lowland';
}

/** Terrain worth calling out on a compact card - lowland is the unremarkable default. */
export function isNotableTerrain(terrain: Terrain | undefined): terrain is 'alpine' | 'highland' {
  return terrain === 'alpine' || terrain === 'highland';
}
