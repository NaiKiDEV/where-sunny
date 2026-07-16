/**
 * Peak-season crowd intelligence over the same ten-year monthly normals that
 * power ClimateProfile. Reuses `monthScore` (the sun/warmth/dryness blend) to
 * rank months, decides whether the most pleasant months coincide with the
 * school-holiday season for the place's hemisphere (Jul/Aug north, Dec/Jan
 * south), and finds shoulder months with similar weather outside the busy
 * window. Silence (null) is the default whenever the story is murky: flat
 * climates, incomplete data, or school months neither clearly peak nor
 * clearly worse.
 */
import { monthScore, type MonthlyNormal } from './normals';

const MONTHS_PER_YEAR = 12;
/** School summer holidays: Jul/Aug north of the equator, Dec/Jan south. */
const SCHOOL_MONTHS_NORTH = [7, 8];
const SCHOOL_MONTHS_SOUTH = [12, 1];
/** Below this max-min pleasantness spread the climate reads as flat - stay silent. */
const MIN_SCORE_SPREAD = 0.15;
/** "Similar weather": within 90% of the peak month's pleasantness. */
const SHOULDER_RATIO = 0.9;
/** School months under this share of the best month are clearly worse weather. */
const OFF_PEAK_RATIO = 0.75;
/** Tight band around the best month when the peak is not school-driven. */
const TOP_BAND_RATIO = 0.95;
/** Name at most this many shoulder months; the nearest to the peak win. */
const MAX_SHOULDER_MONTHS = 2;

export interface SeasonNote {
  /** 'school-peak': the busy school window is also the weather peak; 'pleasant-peak': it is not. */
  kind: 'school-peak' | 'pleasant-peak';
  /** Calendar-ordered months at the heart of the note. */
  peakMonths: number[];
  /** Calendar-ordered similar-weather months outside the busy window (may be empty). */
  shoulderMonths: number[];
  /** The school-holiday window for this hemisphere, calendar-ordered. */
  schoolMonths: number[];
}

/**
 * Classify a year of monthly normals into a peak/shoulder crowd note.
 * Returns null when there is nothing honest to say.
 */
export function seasonNote(months: MonthlyNormal[], latitude: number): SeasonNote | null {
  if (!Number.isFinite(latitude)) return null;
  const scores = scoreByMonth(months);
  if (!scores) return null;

  const values = [...scores.values()];
  const topScore = Math.max(...values);
  if (topScore - Math.min(...values) < MIN_SCORE_SPREAD) return null;

  const schoolMonths = latitude >= 0 ? SCHOOL_MONTHS_NORTH : SCHOOL_MONTHS_SOUTH;
  const scoreOf = (month: number): number => scores.get(month) ?? 0;
  const schoolPeak = schoolMonths.filter((month) => scoreOf(month) >= SHOULDER_RATIO * topScore);

  if (schoolPeak.length > 0) {
    const peakScore = Math.max(...schoolPeak.map(scoreOf));
    const shoulders = nearestShoulders(scores, schoolMonths, peakScore);
    // Without a similar-weather alternative the note has no crowd advice to give.
    if (shoulders.length === 0) return null;
    return {
      kind: 'school-peak',
      peakMonths: sortCalendar(schoolPeak),
      shoulderMonths: shoulders,
      schoolMonths: sortCalendar(schoolMonths),
    };
  }

  // School season is mid-pack: neither the weather peak nor clearly worse -
  // a pleasant-vs-busy contrast would overstate the case, so stay silent.
  if (Math.max(...schoolMonths.map(scoreOf)) >= OFF_PEAK_RATIO * topScore) return null;

  const peakMonths = sortCalendar(
    [...scores.keys()].filter((month) => scoreOf(month) >= TOP_BAND_RATIO * topScore),
  );
  return {
    kind: 'pleasant-peak',
    peakMonths,
    shoulderMonths: nearestShoulders(scores, peakMonths, topScore),
    schoolMonths: sortCalendar(schoolMonths),
  };
}

/** Pleasantness per month, or null unless exactly the 12 calendar months are present. */
function scoreByMonth(months: MonthlyNormal[]): Map<number, number> | null {
  if (months.length !== MONTHS_PER_YEAR) return null;
  const scores = new Map<number, number>();
  for (const normal of months) {
    if (normal.month < 1 || normal.month > MONTHS_PER_YEAR) return null;
    scores.set(normal.month, monthScore(normal));
  }
  return scores.size === MONTHS_PER_YEAR ? scores : null;
}

/**
 * Months outside `window` within SHOULDER_RATIO of `peakScore` - the nearest
 * (by circular month distance) MAX_SHOULDER_MONTHS of them, calendar-ordered.
 */
function nearestShoulders(
  scores: Map<number, number>,
  window: number[],
  peakScore: number,
): number[] {
  const candidates = [...scores.entries()]
    .filter(([month, score]) => !window.includes(month) && score >= SHOULDER_RATIO * peakScore)
    .map(([month]) => month)
    .sort((a, b) => distanceToWindow(a, window) - distanceToWindow(b, window) || a - b);
  return sortCalendar(candidates.slice(0, MAX_SHOULDER_MONTHS));
}

function distanceToWindow(month: number, window: number[]): number {
  return Math.min(...window.map((w) => circularMonthDistance(month, w)));
}

function circularMonthDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, MONTHS_PER_YEAR - diff);
}

function sortCalendar(months: number[]): number[] {
  return [...months].sort((a, b) => a - b);
}
