import { useQuery } from '@tanstack/react-query';
import {
  fetchExchangeRate,
  isConvertiblePair,
  type ExchangeRate,
} from '../core/practical/currency';

// ECB reference rates fix once per working day, so 12 h staleness (matching
// useNearbyPoi's budget) never shows a meaningfully outdated number.
const HOUR_MS = 60 * 60 * 1000;
const STALE_MS = 12 * HOUR_MS;
const GC_MS = 24 * HOUR_MS;

export interface ExchangeRateResult {
  rate: ExchangeRate | null;
  isLoading: boolean;
}

/**
 * Lazy ECB exchange rate for a currency pair. Enabled only when the pair is
 * actually convertible - different currencies, both quoted by Frankfurter -
 * so same-currency trips and exotic destinations cost zero network calls.
 * Pairs dedupe by query key, so reopening a detail panel reuses the cache.
 */
export function useExchangeRate(
  from: string | null | undefined,
  to: string | null | undefined,
): ExchangeRateResult {
  const enabled = !!from && !!to && isConvertiblePair(from, to);
  const query = useQuery({
    queryKey: ['exchangeRate', from, to],
    enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: () => fetchExchangeRate(from!, to!),
  });
  return { rate: query.data ?? null, isLoading: enabled && query.isLoading };
}
