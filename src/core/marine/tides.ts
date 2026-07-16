/**
 * Tide times from Open-Meteo Marine hourly sea_level_height_msl. A pure
 * local-extrema finder: neighbor comparison over the non-null series, with
 * plateau runs collapsing to their middle hour and series edges (hour 0/23)
 * counting when they beat their single neighbor. Feed it the full multi-day
 * series when available - extrema are found across day boundaries and then
 * filtered to the requested date, so midnight flanks don't fake events.
 * Silence gates live here too: an all-null / uncovered day and micro-tidal
 * coasts (daily range below 0.5 m, e.g. most of the Mediterranean) return
 * null so callers render nothing.
 */
import type { SeaLevelHour } from './marine';

export interface TideEvent {
  time: string; // destination-local ISO minute time, passed through untouched
  height: number; // metres relative to mean sea level
}

export interface TideDay {
  highs: TideEvent[];
  lows: TideEvent[];
  /** Metres between the day's highest and lowest hourly water level. */
  range: number;
}

/** Below this daily range the tide is not worth mentioning at all. */
export const MIN_TIDAL_RANGE_M = 0.5;

/** At or above this (macro-tidal coasts) the range itself is a planning fact. */
export const NOTABLE_TIDAL_RANGE_M = 4;

interface SeaLevelPoint {
  time: string;
  height: number;
}

/** A stretch of consecutive equal heights; extrema are judged run-to-run. */
interface Run {
  start: number; // index into the compacted points, inclusive
  end: number;
  height: number;
}

function toRuns(points: SeaLevelPoint[]): Run[] {
  const runs: Run[] = [];
  points.forEach((point, i) => {
    const last = runs[runs.length - 1];
    if (last && last.height === point.height) {
      runs[runs.length - 1] = { ...last, end: i };
    } else {
      runs.push({ start: i, end: i, height: point.height });
    }
  });
  return runs;
}

function findExtrema(points: SeaLevelPoint[]): { highs: TideEvent[]; lows: TideEvent[] } {
  const runs = toRuns(points);
  const highs: TideEvent[] = [];
  const lows: TideEvent[] = [];
  if (runs.length < 2) return { highs, lows }; // flat or empty: nothing turns
  runs.forEach((run, i) => {
    const prev = runs[i - 1]?.height;
    const next = runs[i + 1]?.height;
    const isHigh =
      (prev === undefined || run.height > prev) && (next === undefined || run.height > next);
    const isLow =
      (prev === undefined || run.height < prev) && (next === undefined || run.height < next);
    if (!isHigh && !isLow) return;
    // A plateau's flat stretch is represented by its middle hour.
    const mid = points[Math.floor((run.start + run.end) / 2)];
    (isHigh ? highs : lows).push({ time: mid.time, height: run.height });
  });
  return { highs, lows };
}

/**
 * Highs, lows and tidal range for one local day (YYYY-MM-DD), or null when
 * there is nothing worth saying: no non-null hours on that day (inland, or
 * the series doesn't cover it), a daily range under MIN_TIDAL_RANGE_M, or a
 * day that never turns (needs at least one high and one low).
 */
export function tidesForDay(hours: SeaLevelHour[], date: string): TideDay | null {
  const points = hours.filter((hour): hour is SeaLevelPoint => hour.height !== null);

  const dayHeights = points
    .filter((point) => point.time.startsWith(date))
    .map((point) => point.height);
  if (dayHeights.length === 0) return null;

  const range = Math.max(...dayHeights) - Math.min(...dayHeights);
  if (range < MIN_TIDAL_RANGE_M) return null;

  const { highs, lows } = findExtrema(points);
  const dayHighs = highs.filter((event) => event.time.startsWith(date));
  const dayLows = lows.filter((event) => event.time.startsWith(date));
  if (dayHighs.length === 0 || dayLows.length === 0) return null;

  return { highs: dayHighs, lows: dayLows, range };
}
