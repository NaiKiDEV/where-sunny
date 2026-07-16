import { describe, expect, it } from 'vitest';
import type { MonthlyNormal } from './normals';
import { seasonNote } from './season';

const NORTH_LAT = 48.2;
const SOUTH_LAT = -33.9;

/** A dreary baseline month (score ~0.26) that never competes with a peak. */
function normal(overrides: Partial<MonthlyNormal> & { month: number }): MonthlyNormal {
  return { avgTmax: 12, rainDays: 10, sunshineHoursPerDay: 4, ...overrides };
}

function year(overrides: Record<number, Partial<MonthlyNormal>> = {}): MonthlyNormal[] {
  return Array.from({ length: 12 }, (_, idx) => normal({ month: idx + 1, ...overrides[idx + 1] }));
}

/** Mediterranean-style summer: Jul/Aug best, Jun/Sep close behind, May not quite. */
const SUMMER_PEAK: Record<number, Partial<MonthlyNormal>> = {
  5: { avgTmax: 19, sunshineHoursPerDay: 7.5, rainDays: 6 },
  6: { avgTmax: 23, sunshineHoursPerDay: 9, rainDays: 4 },
  7: { avgTmax: 26, sunshineHoursPerDay: 10, rainDays: 2 },
  8: { avgTmax: 27, sunshineHoursPerDay: 9.5, rainDays: 2 },
  9: { avgTmax: 23, sunshineHoursPerDay: 8.5, rainDays: 4 },
};

describe('seasonNote', () => {
  it('marks Jul-Aug as school-season peak with Jun/Sep shoulders in the north', () => {
    expect(seasonNote(year(SUMMER_PEAK), NORTH_LAT)).toEqual({
      kind: 'school-peak',
      peakMonths: [7, 8],
      shoulderMonths: [6, 9],
      schoolMonths: [7, 8],
    });
  });

  it('marks Dec-Jan as school-season peak south of the equator', () => {
    const months = year({
      1: { avgTmax: 27, sunshineHoursPerDay: 9.5, rainDays: 2 },
      2: { avgTmax: 23, sunshineHoursPerDay: 8.5, rainDays: 4 },
      11: { avgTmax: 23, sunshineHoursPerDay: 9, rainDays: 4 },
      12: { avgTmax: 26, sunshineHoursPerDay: 10, rainDays: 2 },
    });
    expect(seasonNote(months, SOUTH_LAT)).toEqual({
      kind: 'school-peak',
      peakMonths: [1, 12],
      shoulderMonths: [2, 11],
      schoolMonths: [1, 12],
    });
  });

  it('drops the school framing when summer is oppressive (desert climates)', () => {
    const months = year({
      3: { avgTmax: 24, sunshineHoursPerDay: 10, rainDays: 1 },
      4: { avgTmax: 25, sunshineHoursPerDay: 10, rainDays: 1 },
      7: { avgTmax: 43, sunshineHoursPerDay: 12, rainDays: 0 },
      8: { avgTmax: 42, sunshineHoursPerDay: 12, rainDays: 0 },
    });
    expect(seasonNote(months, NORTH_LAT)).toEqual({
      kind: 'pleasant-peak',
      peakMonths: [3, 4],
      shoulderMonths: [],
      schoolMonths: [7, 8],
    });
  });

  it('stays silent when school months are neither peak nor clearly worse', () => {
    const months = year({
      3: { avgTmax: 24, sunshineHoursPerDay: 10, rainDays: 1 },
      7: { avgTmax: 33, sunshineHoursPerDay: 12, rainDays: 0 },
    });
    expect(seasonNote(months, NORTH_LAT)).toBeNull();
  });

  it('stays silent for flat tropical climates', () => {
    const months = year(
      Object.fromEntries(
        Array.from({ length: 12 }, (_, idx) => [
          idx + 1,
          { avgTmax: 31, sunshineHoursPerDay: 5.5, rainDays: 13 + (idx % 3) },
        ]),
      ),
    );
    expect(seasonNote(months, 1.35)).toBeNull();
  });

  it('stays silent when months are missing', () => {
    expect(seasonNote(year(SUMMER_PEAK).slice(0, 11), NORTH_LAT)).toBeNull();
  });

  it('stays silent when no month rivals the peak outside school season', () => {
    const months = year({
      7: { avgTmax: 26, sunshineHoursPerDay: 10, rainDays: 2 },
      8: { avgTmax: 27, sunshineHoursPerDay: 9.5, rainDays: 2 },
    });
    expect(seasonNote(months, NORTH_LAT)).toBeNull();
  });

  it('prefers the shoulders adjacent to the peak window', () => {
    const shoulder = { avgTmax: 23, sunshineHoursPerDay: 9, rainDays: 4 };
    const months = year({
      5: shoulder,
      6: shoulder,
      7: { avgTmax: 26, sunshineHoursPerDay: 10, rainDays: 2 },
      8: { avgTmax: 27, sunshineHoursPerDay: 9.5, rainDays: 2 },
      9: shoulder,
      10: shoulder,
    });
    expect(seasonNote(months, NORTH_LAT)?.shoulderMonths).toEqual([6, 9]);
  });

  it('stays silent for a non-finite latitude', () => {
    expect(seasonNote(year(SUMMER_PEAK), Number.NaN)).toBeNull();
  });
});
