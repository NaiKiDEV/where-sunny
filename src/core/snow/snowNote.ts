/**
 * Snow note for snowy destinations. In winter, "sunny" alone undersells a
 * mountain town - sun plus fresh snow is the jackpot. This derives a compact
 * note from the snow fields the single-place forecast path carries
 * (DayForecast.snowfallSum / snowDepthMax) and stays silent everywhere else.
 *
 * The gates are data-driven, not terrain-driven: ski towns are valley cities
 * (Bariloche 768 m, Innsbruck 574 m), so an alpine-elevation gate would hide
 * the note exactly where snow matters most. Forecast snowfall clears the bar
 * at any elevation; the standing-base note is additionally season-gated so a
 * grid cell's year-round glacier depth can't surface off-season.
 */
import type { DayForecast, Place } from '../types';

/** Summed fresh snowfall across the window worth calling out. Centimetres. */
export const FRESH_SNOW_MIN_CM = 5;
/** Minimum base depth worth mentioning - below this it's a dusting. Centimetres. */
export const BASE_DEPTH_MIN_CM = 20;

/** The lat/elevation slice of Place the note needs - keeps tests and callers light. */
export type SnowPlace = Pick<Place, 'lat' | 'elevation'>;

export interface FreshSnow {
  /** YYYY-MM-DD of the snowiest day in the window. */
  day: string;
  /** Fresh snowfall summed across the window, rounded to whole cm. */
  totalCm: number;
}

export interface SnowNote {
  freshSnow?: FreshSnow;
  /** Max snow depth on the ground across the window, in whole cm. */
  baseDepthCm?: number;
  /** True when at least one of the notes clears its threshold. */
  show: boolean;
}

/**
 * Snow season, hemisphere-aware: Oct-Apr north of the equator, Apr-Oct south
 * (both ends inclusive). Month comes from the selected date's ISO string, so
 * no timezone maths is involved.
 */
export function isSnowSeason(isoDate: string, lat: number): boolean {
  const month = Number(isoDate.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  return lat >= 0 ? month >= 10 || month <= 4 : month >= 4 && month <= 10;
}

/**
 * Derive the snow note for a place's visible forecast window.
 *
 * Returns null when no day carries snow data (no data is not "no snow" - the
 * grid path and stale caches simply never request these fields). Otherwise
 * returns the banded values with `show` flagging whether anything cleared its
 * threshold - render only when `show` is true. Fresh snowfall counts at any
 * elevation in any month; the standing-base note only counts in the
 * hemisphere's snow season (see module doc).
 */
export function snowNote(days: DayForecast[], place: SnowPlace, date: string): SnowNote | null {
  const withData = days.filter(
    (d) => d.snowfallSum !== undefined || d.snowDepthMax !== undefined,
  );
  if (withData.length === 0) return null;

  let totalCm = 0;
  let snowiestDay: string | undefined;
  let snowiestCm = 0;
  let maxDepthM = 0;
  for (const day of withData) {
    const fall = day.snowfallSum ?? 0;
    totalCm += fall;
    if (fall > snowiestCm) {
      snowiestCm = fall;
      snowiestDay = day.date;
    }
    maxDepthM = Math.max(maxDepthM, day.snowDepthMax ?? 0);
  }

  const freshSnow: FreshSnow | undefined =
    totalCm >= FRESH_SNOW_MIN_CM && snowiestDay !== undefined
      ? { day: snowiestDay, totalCm: Math.round(totalCm) }
      : undefined;

  const depthCm = Math.round(maxDepthM * 100);
  const baseDepthCm =
    depthCm >= BASE_DEPTH_MIN_CM && isSnowSeason(date, place.lat) ? depthCm : undefined;

  return { freshSnow, baseDepthCm, show: freshSnow !== undefined || baseDepthCm !== undefined };
}
