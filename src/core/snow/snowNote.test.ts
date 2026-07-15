import { describe, expect, it } from 'vitest';
import type { DayForecast } from '../types';
import { isSnowSeason, snowNote, type SnowPlace } from './snowNote';

/** Zermatt-ish: alpine northern hemisphere. */
const ALPINE_NORTH: SnowPlace = { lat: 46.02, elevation: 1620 };
/** Southern Alps (NZ): alpine southern hemisphere. */
const ALPINE_SOUTH: SnowPlace = { lat: -43.59, elevation: 1650 };

const JANUARY = '2026-01-15';
const JULY = '2026-07-15';

function day(date: string, snow?: { fallCm?: number; depthM?: number }): DayForecast {
  return {
    date,
    sunshineDuration: 30_000,
    daylightDuration: 34_000,
    cloudCoverMean: 20,
    precipProbMax: 10,
    tempMax: -2,
    tempMin: -9,
    weatherCode: 1,
    snowfallSum: snow?.fallCm,
    snowDepthMax: snow?.depthM,
  };
}

describe('isSnowSeason', () => {
  it('is Oct-Apr inclusive in the northern hemisphere', () => {
    expect(isSnowSeason('2026-10-01', 46)).toBe(true);
    expect(isSnowSeason('2026-01-15', 46)).toBe(true);
    expect(isSnowSeason('2026-04-30', 46)).toBe(true);
    expect(isSnowSeason('2026-05-01', 46)).toBe(false);
    expect(isSnowSeason('2026-09-30', 46)).toBe(false);
  });

  it('is Apr-Oct inclusive in the southern hemisphere', () => {
    expect(isSnowSeason('2026-04-01', -43)).toBe(true);
    expect(isSnowSeason('2026-07-15', -43)).toBe(true);
    expect(isSnowSeason('2026-10-31', -43)).toBe(true);
    expect(isSnowSeason('2026-11-01', -43)).toBe(false);
    expect(isSnowSeason('2026-03-15', -43)).toBe(false);
  });

  it('treats the equator as northern and rejects malformed dates', () => {
    expect(isSnowSeason('2026-12-15', 0)).toBe(true);
    expect(isSnowSeason('garbage', 46)).toBe(false);
  });
});

describe('snowNote gating', () => {
  const snowyDays = [day('2026-01-15', { fallCm: 12, depthM: 0.8 })];

  it('flags fresh forecast snowfall at any elevation - ski towns are valley cities', () => {
    // Bariloche-like: heavy snow at 768 m must not be hidden by a terrain gate.
    const note = snowNote(snowyDays, { lat: -41.13, elevation: 768 }, JULY);
    expect(note?.freshSnow).toEqual({ day: '2026-01-15', totalCm: 12 });
    expect(note?.show).toBe(true);
    expect(snowNote(snowyDays, { lat: 46, elevation: 12 }, JANUARY)?.show).toBe(true);
    expect(snowNote(snowyDays, { lat: 46, elevation: undefined }, JANUARY)?.show).toBe(true);
  });

  it('flags fresh forecast snowfall even out of season - a snow event is a snow event', () => {
    const freshOnly = [day('2026-07-15', { fallCm: 12 })];
    expect(snowNote(freshOnly, ALPINE_NORTH, JULY)?.freshSnow).toEqual({
      day: '2026-07-15',
      totalCm: 12,
    });
  });

  it('season-gates the standing base so glacier-cell depth cannot surface off-season', () => {
    const depthOnly = [day('2026-07-15', { fallCm: 0, depthM: 0.8 })];
    expect(snowNote(depthOnly, ALPINE_NORTH, JULY)?.show).toBe(false);
    expect(snowNote(depthOnly, ALPINE_NORTH, JULY)?.baseDepthCm).toBeUndefined();
    // Same data in the matching hemisphere's season: shows.
    expect(snowNote(depthOnly, ALPINE_SOUTH, JULY)?.baseDepthCm).toBe(80);
    expect(snowNote(depthOnly, ALPINE_SOUTH, JANUARY)?.show).toBe(false);
  });

  it('returns null when no day carries snow data (no data is not "no snow")', () => {
    const noData = [day('2026-01-15'), day('2026-01-16')];
    expect(snowNote(noData, ALPINE_NORTH, JANUARY)).toBeNull();
    expect(snowNote([], ALPINE_NORTH, JANUARY)).toBeNull();
  });
});

describe('snowNote banding', () => {
  it('flags fresh snow when the window sum reaches 5 cm, tagged with the snowiest day', () => {
    const days = [
      day('2026-01-15', { fallCm: 2, depthM: 0 }),
      day('2026-01-16', { fallCm: 4, depthM: 0 }),
    ];
    const note = snowNote(days, ALPINE_NORTH, JANUARY);
    expect(note?.freshSnow).toEqual({ day: '2026-01-16', totalCm: 6 });
    expect(note?.show).toBe(true);
  });

  it('skips fresh snow below 5 cm summed', () => {
    const days = [
      day('2026-01-15', { fallCm: 1, depthM: 0 }),
      day('2026-01-16', { fallCm: 3, depthM: 0 }),
    ];
    const note = snowNote(days, ALPINE_NORTH, JANUARY);
    expect(note?.freshSnow).toBeUndefined();
    expect(note?.show).toBe(false);
  });

  it('reports base depth in cm from the window max, only from ~20 cm up', () => {
    const shallow = snowNote([day('2026-01-15', { depthM: 0.1 })], ALPINE_NORTH, JANUARY);
    expect(shallow?.baseDepthCm).toBeUndefined();
    expect(shallow?.show).toBe(false);

    const deep = snowNote(
      [day('2026-01-15', { depthM: 0.35 }), day('2026-01-16', { depthM: 0.2 })],
      ALPINE_NORTH,
      JANUARY,
    );
    expect(deep?.baseDepthCm).toBe(35);
    expect(deep?.show).toBe(true);
  });

  it('combines both notes when both clear their thresholds', () => {
    const days = [
      day('2026-01-15', { fallCm: 8, depthM: 0.6 }),
      day('2026-01-16', { fallCm: 3, depthM: 0.68 }),
    ];
    expect(snowNote(days, ALPINE_NORTH, JANUARY)).toEqual({
      freshSnow: { day: '2026-01-15', totalCm: 11 },
      baseDepthCm: 68,
      show: true,
    });
  });

  it('treats days with partial fields as data and missing fields as 0 within them', () => {
    // Depth known but snowfall never reported: still a valid base note.
    const days = [day('2026-01-15', { depthM: 0.5 })];
    expect(snowNote(days, ALPINE_NORTH, JANUARY)).toEqual({
      freshSnow: undefined,
      baseDepthCm: 50,
      show: true,
    });
  });
});
