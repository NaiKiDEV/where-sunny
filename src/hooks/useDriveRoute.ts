import { useQuery } from '@tanstack/react-query';
import {
  driveCoordKey,
  fetchDriveRoute,
  isWithinDriveRange,
  type DriveRoute,
} from '../core/routing/osrm';
import type { LatLon } from '../core/types';

export interface DriveRouteResult {
  /** Routed legs + totals, or null while loading / skipped / unroutable. */
  route: DriveRoute | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Real drive time for an ordered coordinate chain: [origin, place] on a
 * detail open, or a trip's stop list. One OSRM request per distinct rounded
 * chain, cached for the whole session (roads don't change mid-session).
 * Disabled when the input is null/too short or the straight-line chain
 * exceeds 2,000 km (flight territory - save the demo server the request):
 * `route` stays null and callers keep the straight-line display.
 *
 * Fair use (OSRM demo server): one-shot, on-demand surfaces only - never
 * mount this per result-grid item.
 */
export function useDriveRoute(coords: LatLon[] | null): DriveRouteResult {
  const enabled = !!coords && isWithinDriveRange(coords);
  const query = useQuery({
    queryKey: ['drive-route', enabled ? driveCoordKey(coords!) : null],
    enabled,
    staleTime: Infinity,
    queryFn: () => fetchDriveRoute(coords!),
  });

  return {
    route: query.data ?? null,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
  };
}
