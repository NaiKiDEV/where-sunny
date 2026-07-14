import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { codeOf } from '../core/bannedCountries';
import {
  fetchLongWeekends,
  fetchPublicHolidays,
  yearsToFetch,
  type LongWeekend,
  type PublicHoliday,
} from '../core/calendar/holidays';
import type { Place } from '../core/types';
import { useLocalDate } from './useLocalDate';

// Holidays and long weekends barely change; keep them fresh for a day and cached
// for a week so opening several places in one country costs a single fetch each.
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_MS = DAY_MS;
const GC_MS = 7 * DAY_MS;

export interface CountryCalendar {
  /** Resolved ISO alpha-2 code, or undefined when the place has none. */
  code: string | undefined;
  holidaysByDate: Map<string, PublicHoliday[]>;
  longWeekends: LongWeekend[];
  isLoading: boolean;
  /** True when the country resolved but the API covers no calendar data for it. */
  isUnsupported: boolean;
}

/** A place's country as a fetchable code, or undefined when it isn't a clean alpha-2. */
function resolveCode(place: Place | null): string | undefined {
  if (!place) return undefined;
  const code = codeOf(place);
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

/**
 * Public holidays and long weekends for a place's country. Lazy and cached like
 * usePlaceInsight - two queries keyed by country code, so N places in the same
 * country share one fetch. Returns empty maps (never throws) when the country is
 * unknown or unsupported; the calling component hides itself in that case.
 */
export function useCountryCalendar(place: Place | null): CountryCalendar {
  const code = resolveCode(place);
  const todayIso = useLocalDate();
  const years = useMemo(() => yearsToFetch(todayIso), [todayIso]);

  const holidaysQuery = useQuery({
    queryKey: ['holidays', code, years],
    enabled: !!code,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: async () => {
      const perYear = await Promise.all(years.map((y) => fetchPublicHolidays(code!, y)));
      return perYear.flat();
    },
  });

  const longWeekendsQuery = useQuery({
    queryKey: ['longWeekends', code, years],
    enabled: !!code,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: async () => {
      const perYear = await Promise.all(years.map((y) => fetchLongWeekends(code!, y)));
      return perYear.flat();
    },
  });

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, PublicHoliday[]>();
    for (const holiday of holidaysQuery.data ?? []) {
      const existing = map.get(holiday.date);
      if (existing) existing.push(holiday);
      else map.set(holiday.date, [holiday]);
    }
    return map;
  }, [holidaysQuery.data]);

  const longWeekends = longWeekendsQuery.data ?? [];

  const isUnsupported =
    !!code &&
    holidaysQuery.isSuccess &&
    longWeekendsQuery.isSuccess &&
    holidaysByDate.size === 0 &&
    longWeekends.length === 0;

  return {
    code,
    holidaysByDate,
    longWeekends,
    isLoading: !!code && (holidaysQuery.isLoading || longWeekendsQuery.isLoading),
    isUnsupported,
  };
}
