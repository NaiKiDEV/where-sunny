import { type ComfortPrefs, DEFAULT_COMFORT, scoreDays } from '../scoring/score';
import type { DayForecast } from '../types';

/** One candidate day for the sliding window; `score: null` = unscoreable. */
export interface BestWindowEntry {
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  score: number | null;
}

export interface BestWindowResult {
  startDate: string;
  endDate: string;
  /** Unrounded mean score across the window - round at the display layer. */
  avgScore: number;
  /** Window length in days. */
  length: number;
}

export const DEFAULT_WINDOW_LENGTHS = [2, 3];

// Never recommend a bad trip: suppress below this average, and when the
// forecast has too few scoreable days to make a recommendation meaningful.
const MIN_AVG_SCORE = 55;
const MIN_SCOREABLE_DAYS = 5;

const MS_PER_DAY = 86_400_000;

interface ScoreableDay {
  date: string;
  score: number;
  /** Days since the Unix epoch - consecutive dates differ by exactly 1. */
  dayNumber: number;
}

function toDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/** Splits chronologically sorted days into runs of consecutive calendar days. */
function consecutiveRuns(days: ScoreableDay[]): ScoreableDay[][] {
  const runs: ScoreableDay[][] = [];
  for (const day of days) {
    const run = runs[runs.length - 1];
    if (run && day.dayNumber === run[run.length - 1].dayNumber + 1) {
      run.push(day);
    } else {
      runs.push([day]);
    }
  }
  return runs;
}

function isBetterWindow(candidate: BestWindowResult, current: BestWindowResult | null): boolean {
  if (!current) return true;
  if (candidate.avgScore !== current.avgScore) return candidate.avgScore > current.avgScore;
  if (candidate.length !== current.length) return candidate.length > current.length;
  return candidate.startDate < current.startDate;
}

/**
 * The best stretch of consecutive days to travel, found by sliding windows of
 * the given lengths over the scoreable days. A missing calendar day or a
 * null-scored day breaks the window - gaps are never bridged. Selection:
 * highest average score; ties go to the longer window, then the earliest
 * start. Returns null when nothing is worth recommending: best average below
 * 55 or fewer than 5 scoreable days overall.
 */
export function bestWindow(
  entries: BestWindowEntry[],
  lengths: number[] = DEFAULT_WINDOW_LENGTHS,
): BestWindowResult | null {
  const scoreable = entries
    .filter((entry) => entry.score !== null && Number.isFinite(entry.score))
    .map((entry) => ({ date: entry.date, score: entry.score!, dayNumber: toDayNumber(entry.date) }))
    .sort((a, b) => a.dayNumber - b.dayNumber);
  if (scoreable.length < MIN_SCOREABLE_DAYS) return null;

  const usableLengths = lengths.filter((length) => Number.isInteger(length) && length >= 1);
  if (usableLengths.length === 0) return null;

  let best: BestWindowResult | null = null;
  for (const run of consecutiveRuns(scoreable)) {
    for (const length of usableLengths) {
      for (let start = 0; start + length <= run.length; start += 1) {
        const windowDays = run.slice(start, start + length);
        const candidate: BestWindowResult = {
          startDate: windowDays[0].date,
          endDate: windowDays[length - 1].date,
          avgScore: windowDays.reduce((sum, day) => sum + day.score, 0) / length,
          length,
        };
        if (isBetterWindow(candidate, best)) best = candidate;
      }
    }
  }

  if (!best || best.avgScore < MIN_AVG_SCORE) return null;
  return best;
}

/**
 * Best window over raw forecast days, scored with the exact same model as the
 * day strip and outlook strip (scoreDays + the user's comfort profile).
 * Convenience for callers holding a PlaceForecast: the best-window chip, and
 * stay links defaulting check-in/check-out to the window's dates.
 */
export function bestForecastWindow(
  days: DayForecast[],
  prefs: ComfortPrefs = DEFAULT_COMFORT,
  lengths: number[] = DEFAULT_WINDOW_LENGTHS,
): BestWindowResult | null {
  const scored = scoreDays(days, prefs);
  return bestWindow(
    scored.map((day) => ({ date: day.date, score: day.score })),
    lengths,
  );
}
