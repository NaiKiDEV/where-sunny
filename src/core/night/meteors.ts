import type { NightSkyBand } from './nightSky';

/** Which hemisphere a shower's radiant favours; 'both' means near-equatorial. */
export type ShowerHemisphere = 'north' | 'south' | 'both';

/** Year-agnostic calendar date: [month 1-12, day 1-31]. */
export type MonthDay = readonly [month: number, day: number];

export interface MeteorShower {
  name: string;
  /** Active window, inclusive; `to` may land after Jan 1 (Quadrantids). */
  from: MonthDay;
  to: MonthDay;
  peak: MonthDay;
  /** Zenithal hourly rate at peak under ideal dark skies. */
  zhr: number;
  hemisphere: ShowerHemisphere;
}

/**
 * The major annual showers - IMO working-list dates, rounded to whole days.
 * Hemisphere follows the radiant's declination: far-northern radiants
 * (Quadrantids +49°, Perseids +58°, Draconids +54°, Ursids +76°) never rise
 * usefully south of the equator; the Eta Aquariids (dec -1°, but the pre-dawn
 * radiant geometry strongly favours the south) are the reverse; the rest sit
 * close enough to the celestial equator to show from both hemispheres.
 */
export const MAJOR_SHOWERS: readonly MeteorShower[] = [
  { name: 'Quadrantids', from: [12, 28], to: [1, 12], peak: [1, 3], zhr: 110, hemisphere: 'north' },
  { name: 'Lyrids', from: [4, 14], to: [4, 30], peak: [4, 22], zhr: 18, hemisphere: 'both' },
  { name: 'Eta Aquariids', from: [4, 19], to: [5, 28], peak: [5, 6], zhr: 50, hemisphere: 'south' },
  { name: 'Delta Aquariids', from: [7, 12], to: [8, 23], peak: [7, 30], zhr: 25, hemisphere: 'both' },
  { name: 'Perseids', from: [7, 17], to: [8, 24], peak: [8, 12], zhr: 100, hemisphere: 'north' },
  { name: 'Southern Taurids', from: [9, 10], to: [11, 20], peak: [11, 5], zhr: 5, hemisphere: 'both' },
  { name: 'Orionids', from: [10, 2], to: [11, 7], peak: [10, 21], zhr: 20, hemisphere: 'both' },
  { name: 'Draconids', from: [10, 6], to: [10, 10], peak: [10, 8], zhr: 10, hemisphere: 'north' },
  { name: 'Northern Taurids', from: [10, 20], to: [12, 10], peak: [11, 12], zhr: 5, hemisphere: 'both' },
  { name: 'Leonids', from: [11, 6], to: [11, 30], peak: [11, 17], zhr: 15, hemisphere: 'both' },
  { name: 'Geminids', from: [12, 4], to: [12, 20], peak: [12, 14], zhr: 150, hemisphere: 'both' },
  { name: 'Ursids', from: [12, 17], to: [12, 26], peak: [12, 22], zhr: 10, hemisphere: 'north' },
];

export interface ActiveShower {
  shower: MeteorShower;
  /** True when the date is the shower's peak night (month/day match). */
  isPeakNight: boolean;
}

/** Encode a month/day as one comparable number (Aug 12 → 812). */
function monthDayValue([month, day]: MonthDay): number {
  return month * 100 + day;
}

/** Inclusive year-agnostic window test; handles windows that cross Jan 1. */
function isWithinWindow(value: number, from: number, to: number): boolean {
  if (from <= to) return value >= from && value <= to;
  return value >= from || value <= to;
}

function isVisibleFrom(hemisphere: ShowerHemisphere, lat: number): boolean {
  if (hemisphere === 'both') return true;
  return hemisphere === 'north' ? lat >= 0 : lat <= 0;
}

/**
 * The strongest (highest ZHR) shower active on `date` (YYYY-MM-DD) and
 * visible from latitude `lat`, or null when the night has none. Year-agnostic
 * month/day comparison - the caller decides what "tonight" is; nothing here
 * reads the clock.
 */
export function activeShower(date: string, lat: number): ActiveShower | null {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const tonight = month * 100 + day;

  let best: MeteorShower | null = null;
  for (const shower of MAJOR_SHOWERS) {
    if (!isVisibleFrom(shower.hemisphere, lat)) continue;
    if (!isWithinWindow(tonight, monthDayValue(shower.from), monthDayValue(shower.to))) continue;
    if (best === null || shower.zhr > best.zhr) best = shower;
  }
  return best === null ? null : { shower: best, isPeakNight: tonight === monthDayValue(best.peak) };
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short peak-date label for UI copy, e.g. 'Dec 14'. */
export function peakLabel(shower: MeteorShower): string {
  const [month, day] = shower.peak;
  return `${MONTH_ABBREVIATIONS[month - 1]} ${day}`;
}

/** Mirror nightSky's banding thresholds so the copy matches the verdict. */
const THIN_MOON_ILLUMINATION_MAX = 0.15;
const BRIGHT_MOON_ILLUMINATION_MIN = 0.85;

interface SkyForMeteors {
  band: NightSkyBand;
  /** Fraction of the moon's disc lit, 0-1 (from NightSkyOutlook). */
  moonIllumination: number;
}

/**
 * One extra sentence for NightSkyNote when a major shower is worth going out
 * for: a shower must be active and visible from `lat`, and tonight's existing
 * clearness verdict at least decent - cloudy nights stay silent. Peak nights
 * mention the moon only when the already-computed illumination clearly helps
 * (thin moon) or clearly hurts (bright moon).
 */
export function meteorNote(date: string, lat: number, sky: SkyForMeteors): string | null {
  if (sky.band === 'poor') return null;
  const active = activeShower(date, lat);
  if (active === null) return null;

  const { shower, isPeakNight } = active;
  if (!isPeakNight) return `The ${shower.name} are active (peak ${peakLabel(shower)}).`;
  if (sky.moonIllumination >= BRIGHT_MOON_ILLUMINATION_MIN) {
    return `${shower.name} peak tonight, though the bright moon will wash out fainter ones.`;
  }
  if (sky.moonIllumination <= THIN_MOON_ILLUMINATION_MAX) {
    return `${shower.name} peak tonight - clear skies and a thin moon make for good viewing.`;
  }
  return `${shower.name} peak tonight.`;
}
