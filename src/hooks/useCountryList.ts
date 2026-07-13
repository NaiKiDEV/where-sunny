import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

/** One selectable country for the ban picker: ISO alpha-2 code + English name. */
export interface CountryOption {
  code: string;
  name: string;
}

export interface CountryListResult {
  countries: CountryOption[];
  isLoading: boolean;
}

// { "AF": "Afghanistan", ... } - built by scripts/build-countries.mjs. Keys are
// uppercase alpha-2, matching Place.countryCode and effectiveBannedCodes().
async function fetchCountryNames(): Promise<Record<string, string>> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/country-names.json`);
  if (!res.ok) throw new Error(`country-names.json: HTTP ${res.status}`);
  return res.json() as Promise<Record<string, string>>;
}

/**
 * The full ISO country list for the ban picker, sorted by name. Cached forever
 * (the same as the bundled cities query). A fetch failure resolves quietly to an
 * empty list - the picker just shows nothing rather than surfacing an error.
 */
export function useCountryList(): CountryListResult {
  const query = useQuery({
    queryKey: ['country-names'],
    queryFn: fetchCountryNames,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const countries = useMemo<CountryOption[]>(() => {
    if (!query.data) return [];
    return Object.entries(query.data)
      .map(([code, name]) => ({ code: code.toUpperCase(), name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return { countries, isLoading: query.isLoading };
}
