import { useQuery } from '@tanstack/react-query';
import { fetchClimateNormals, type ClimateNormals } from '../core/climate/normals';
import type { LatLon } from '../core/types';

export interface ClimateNormalsResult {
  normals: ClimateNormals | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Ten-year climate normals for a coordinate. Keys round to 1 decimal (~11 km)
 * because normals vary slowly - nearby detail opens share one archive fetch.
 * Normals never change, so the query never goes stale and is kept for the
 * session; consumers pass `enabled: false` to defer the (~115 kB) fetch until
 * the user actually asks for climate context.
 */
export function useClimateNormals(coords: LatLon | null, enabled = true): ClimateNormalsResult {
  const query = useQuery({
    queryKey: ['climate-normals', coords?.lat.toFixed(1), coords?.lon.toFixed(1)],
    enabled: enabled && !!coords,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => fetchClimateNormals(coords!),
  });

  return {
    normals: query.data,
    isLoading: enabled && !!coords && query.isLoading,
    isError: enabled && !!coords && query.isError,
  };
}
