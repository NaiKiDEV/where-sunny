import { type ComfortPrefs, DEFAULT_COMFORT, scoreDays } from '../scoring/score';
import type { DayForecast, ScoredDay } from '../types';
import { FORECAST_DAYS } from '../weather/openMeteo';

/**
 * Days beyond the main forecast window, scored with the exact same model as
 * the 7-day grid so a score dot here means the same thing as one there.
 *
 * When `afterDate` (the last date the main day strip shows) is given, days are
 * selected by calendar date rather than index: the extended fetch aggregates
 * on the destination's calendar (`timezone=auto`), which can sit a day off the
 * requester's calendar, and a date comparison can never duplicate a day the
 * main strip already covers. Without a boundary it falls back to dropping the
 * first FORECAST_DAYS entries.
 */
export function outlookDays(
  days: DayForecast[],
  afterDate?: string,
  prefs: ComfortPrefs = DEFAULT_COMFORT,
): ScoredDay[] {
  const tail =
    afterDate === undefined
      ? days.slice(FORECAST_DAYS)
      : days.filter((day) => day.date > afterDate);
  return scoreDays(tail, prefs);
}
