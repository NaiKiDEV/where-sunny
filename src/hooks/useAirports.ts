import { useQuery } from '@tanstack/react-query';
import { fetchAirports } from '../core/airports/loadAirports';
import type { Airport } from '../core/airports/types';

const EMPTY: Airport[] = [];

export interface AirportsResult {
  airports: Airport[];
  isLoading: boolean;
}

/**
 * The bundled airport list. Loaded once and cached forever (like the city
 * dataset); every consumer shares the single query, so the map and the search
 * dialog don't fetch it twice.
 */
export function useAirports(): AirportsResult {
  const query = useQuery({
    queryKey: ['airports'],
    queryFn: () => fetchAirports(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return { airports: query.data ?? EMPTY, isLoading: query.isLoading };
}
