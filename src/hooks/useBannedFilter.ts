import { useMemo } from 'react';
import { effectiveBannedCodes, isEffectivelyBanned } from '../core/bannedCountries';
import { useAppStore } from '../state/store';

export interface BannedFilter {
  /** Built-in codes ∪ the user's own picks, all uppercase. */
  codes: ReadonlySet<string>;
  /** True when a place belongs to any effectively-banned country. */
  isBanned: (place: { country?: string; countryCode?: string }) => boolean;
}

/**
 * The reactive banned-country filter. Recomputes only when the user's ban list
 * changes, so every consumer (search, suggestions, pins, map, trips) hides the
 * same places without duplicating the merge. `isEffectivelyBanned` re-checks the
 * built-ins internally, so handing it the full effective set is correct.
 */
export function useBannedFilter(): BannedFilter {
  const userBans = useAppStore((s) => s.userBannedCountries);
  return useMemo<BannedFilter>(() => {
    const codes = effectiveBannedCodes(userBans);
    return { codes, isBanned: (place) => isEffectivelyBanned(place, codes) };
  }, [userBans]);
}
