import type { LatLon } from '../types';
import type { HourPoint } from '../weather/hourly';

export type NightSkyBand = 'great' | 'decent' | 'poor';

export interface ClearWindow {
  /** Hour of day the clear stretch starts (22 → 22:00). */
  from: number;
  /** Hour of day the clear stretch ends, exclusive (3 → 03:00, past midnight). */
  to: number;
}

export interface NightSkyOutlook {
  /** Longest stretch of ≥2 consecutive clear dark hours, if any. */
  clearWindow?: ClearWindow;
  /** Mean cloud cover (0–100) over tonight's dark hours; 0 when there are none. */
  avgCloudCover: number;
  /** How many dark hours tonight has data for - 0 means "nothing to say"
      (hourly not loaded, or polar day), not "clear". */
  darkHours: number;
  /** Synodic phase fraction: 0 = new, 0.25 = first quarter, 0.5 = full. */
  moonPhase: number;
  /** Fraction of the moon's disc lit, 0–1. */
  moonIllumination: number;
  band: NightSkyBand;
}

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
/** Mean synodic month and a reference new moon (2000-01-06 18:14 UTC). */
const SYNODIC_MONTH_DAYS = 29.530588853;
const NEW_MOON_EPOCH_JD = 2_451_550.1;

/** An hour counts as clear-enough for stars up to this cloud cover. */
const CLEAR_CLOUD_MAX = 25;
const MIN_WINDOW_HOURS = 2;
const GREAT_WINDOW_HOURS = 4;
/** ≤ this illumination reads as a new-moon night (boosts the band). */
const NEW_MOON_ILLUMINATION_MAX = 0.15;
/** ≥ this illumination reads as a full-moon night (caps at decent). */
const FULL_MOON_ILLUMINATION_MIN = 0.85;

/**
 * Moon phase from the mean synodic cycle: Julian date → lunations since a
 * reference new moon, fractional part is the phase; illumination follows from
 * the phase angle. This is the classic short approximation (a simplification
 * of Meeus, "Astronomical Algorithms", ch. 49) - accurate to well under a day,
 * which is plenty for banding a night-sky note.
 */
export function moonPhaseAt(time: Date): { phase: number; illumination: number } {
  const julianDate = time.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
  const lunations = (julianDate - NEW_MOON_EPOCH_JD) / SYNODIC_MONTH_DAYS;
  const phase = lunations - Math.floor(lunations);
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { phase, illumination };
}

/** Human name for a phase fraction, cardinal points ±0.033 of a lunation wide. */
export function moonPhaseLabel(phase: number): string {
  if (phase < 0.033 || phase >= 0.967) return 'new moon';
  if (phase < 0.217) return 'waxing crescent';
  if (phase < 0.283) return 'first quarter';
  if (phase < 0.467) return 'waxing gibbous';
  if (phase < 0.533) return 'full moon';
  if (phase < 0.717) return 'waning gibbous';
  if (phase < 0.783) return 'last quarter';
  return 'waning crescent';
}

function nextDateIso(date: string): string {
  const next = new Date(new Date(`${date}T00:00:00Z`).getTime() + MS_PER_DAY);
  return next.toISOString().slice(0, 10);
}

/**
 * Hours to skip after sunset (and before sunrise) so the window starts in real
 * darkness: the sunset → astronomical-dusk gap is ~1 h in the tropics and
 * stretches with latitude. Rough, but the hourly grid is no finer anyway.
 */
function twilightTrim(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 40) return 1;
  if (absLat < 58) return 2;
  return 3;
}

interface TonightHours {
  evening: HourPoint[];
  morning: HourPoint[];
}

/** Tonight = non-day hours from `date`'s afternoon side + the next date's pre-noon side. */
function tonightHours(hourly: HourPoint[], date: string): TonightHours {
  const next = nextDateIso(date);
  const byHour = (a: HourPoint, b: HourPoint) => a.hour - b.hour;
  return {
    evening: hourly.filter((p) => p.date === date && !p.isDay && p.hour >= 12).sort(byHour),
    morning: hourly.filter((p) => p.date === next && !p.isDay && p.hour < 12).sort(byHour),
  };
}

/** Longest run of consecutive (hour-adjacent, midnight-wrapping) clear hours. */
function longestClearRun(points: HourPoint[]): HourPoint[] {
  let best: HourPoint[] = [];
  let run: HourPoint[] = [];
  for (const point of points) {
    if (point.cloud > CLEAR_CLOUD_MAX) {
      run = [];
      continue;
    }
    const prev = run[run.length - 1];
    const isConsecutive = prev !== undefined && point.hour === (prev.hour + 1) % 24;
    run = run.length === 0 || isConsecutive ? [...run, point] : [point];
    if (run.length > best.length) best = run;
  }
  return best;
}

function bandFor(windowHours: number, illumination: number): NightSkyBand {
  if (windowHours < MIN_WINDOW_HOURS) return 'poor';
  const base: NightSkyBand = windowHours >= GREAT_WINDOW_HOURS ? 'great' : 'decent';
  // New-moon darkness makes even a short clear window worth going out for;
  // a full moon washes out the sky, so it never rates better than decent.
  if (illumination <= NEW_MOON_ILLUMINATION_MAX) return 'great';
  if (illumination >= FULL_MOON_ILLUMINATION_MIN) return 'decent';
  return base;
}

/**
 * Derive tonight's stargazing outlook for `date` purely from already-fetched
 * hourly cloud cover plus a locally computed moon phase - zero network calls.
 * `isDay` flags are the day/night ground truth; a latitude-based twilight trim
 * approximates astronomical dusk (and dawn, when the next morning is in range).
 */
export function nightSkyOutlook(hourly: HourPoint[], date: string, coords: LatLon): NightSkyOutlook {
  const { evening, morning } = tonightHours(hourly, date);
  const trim = twilightTrim(coords.lat);
  const night = [...evening, ...morning];
  // Drop dusk twilight at the start; drop dawn twilight only when the data
  // actually reaches the next morning (the last forecast day just ends).
  const darkEnd = morning.length > 0 ? night.length - trim : night.length;
  const dark = trim < darkEnd ? night.slice(trim, darkEnd) : [];

  // Phase moves ~3% per day, so one instant within the night is representative.
  const midnight = new Date(`${nextDateIso(date)}T00:00:00Z`);
  const { phase: moonPhase, illumination: moonIllumination } = moonPhaseAt(midnight);

  const avgCloudCover =
    dark.length === 0 ? 0 : Math.round(dark.reduce((sum, p) => sum + p.cloud, 0) / dark.length);

  const run = longestClearRun(dark);
  const clearWindow: ClearWindow | undefined =
    run.length >= MIN_WINDOW_HOURS
      ? { from: run[0].hour, to: (run[run.length - 1].hour + 1) % 24 }
      : undefined;

  return {
    clearWindow,
    avgCloudCover,
    darkHours: dark.length,
    moonPhase,
    moonIllumination,
    band: bandFor(run.length, moonIllumination),
  };
}
