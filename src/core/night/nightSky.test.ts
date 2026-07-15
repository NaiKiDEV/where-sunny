import { describe, expect, it } from 'vitest';
import type { HourPoint } from '../weather/hourly';
import { moonPhaseAt, moonPhaseLabel, nightSkyOutlook } from './nightSky';

function hp(date: string, hour: number, cloud: number, isDay = false): HourPoint {
  return { date, hour, temp: 15, cloud, precipProb: 0, isDay };
}

/**
 * Evening of `date` (sunset ~20:00) into the next morning (sunrise ~06:00),
 * with the given cloud covers for night hours 20–23 then 00–05.
 */
function buildNight(date: string, nextDate: string, clouds: number[]): HourPoint[] {
  const eveningHours = [20, 21, 22, 23];
  const morningHours = [0, 1, 2, 3, 4, 5];
  return [
    hp(date, 18, 10, true),
    hp(date, 19, 10, true),
    ...eveningHours.map((hour, i) => hp(date, hour, clouds[i])),
    ...morningHours.map((hour, i) => hp(nextDate, hour, clouds[eveningHours.length + i])),
    hp(nextDate, 6, 10, true),
  ];
}

describe('moonPhaseAt', () => {
  // Eclipse dates pin the true phase exactly: a solar eclipse is a new moon,
  // a lunar eclipse is a full moon.
  it('matches the new moon of the 2024-04-08 total solar eclipse', () => {
    const { phase, illumination } = moonPhaseAt(new Date('2024-04-08T18:21:00Z'));
    expect(illumination).toBeLessThan(0.03);
    expect(Math.min(phase, 1 - phase)).toBeLessThan(0.05);
  });

  it('matches the full moon of the 2025-03-14 total lunar eclipse', () => {
    const { phase, illumination } = moonPhaseAt(new Date('2025-03-14T06:55:00Z'));
    expect(illumination).toBeGreaterThan(0.97);
    expect(phase).toBeCloseTo(0.5, 1);
  });

  it('matches the new moon of the 2026-02-17 annular solar eclipse', () => {
    const { illumination } = moonPhaseAt(new Date('2026-02-17T12:01:00Z'));
    expect(illumination).toBeLessThan(0.03);
  });

  it('matches the 2024-10-17 supermoon and the 2024-04-15 first quarter', () => {
    const full = moonPhaseAt(new Date('2024-10-17T11:26:00Z'));
    expect(full.illumination).toBeGreaterThan(0.97);

    const quarter = moonPhaseAt(new Date('2024-04-15T19:13:00Z'));
    expect(quarter.phase).toBeGreaterThan(0.22);
    expect(quarter.phase).toBeLessThan(0.28);
    expect(quarter.illumination).toBeGreaterThan(0.4);
    expect(quarter.illumination).toBeLessThan(0.6);
  });
});

describe('moonPhaseLabel', () => {
  it('names the cardinal points and the phases between them', () => {
    expect(moonPhaseLabel(0)).toBe('new moon');
    expect(moonPhaseLabel(0.99)).toBe('new moon');
    expect(moonPhaseLabel(0.13)).toBe('waxing crescent');
    expect(moonPhaseLabel(0.25)).toBe('first quarter');
    expect(moonPhaseLabel(0.4)).toBe('waxing gibbous');
    expect(moonPhaseLabel(0.5)).toBe('full moon');
    expect(moonPhaseLabel(0.62)).toBe('waning gibbous');
    expect(moonPhaseLabel(0.75)).toBe('last quarter');
    expect(moonPhaseLabel(0.9)).toBe('waning crescent');
  });
});

describe('nightSkyOutlook', () => {
  const lowLat = { lat: 38, lon: 23 }; // 1-hour twilight trim

  it('finds a clear window that crosses midnight', () => {
    // Dark hours after the 1 h dusk/dawn trim: 21..23 + 00..04.
    // Clear run 22,23,00,01 → 22:00–02:00.
    const hours = buildNight(
      '2026-08-12',
      '2026-08-13',
      [70, 80, 10, 20, 15, 10, 90, 85, 80, 60],
    );
    const outlook = nightSkyOutlook(hours, '2026-08-12', lowLat);
    expect(outlook.clearWindow).toEqual({ from: 22, to: 2 });
    expect(outlook.avgCloudCover).toBe(49); // mean of the 8 trimmed dark hours
  });

  it('rates a long clear window on a new-moon night as great (2026-08-12 total solar eclipse)', () => {
    const hours = buildNight(
      '2026-08-12',
      '2026-08-13',
      [70, 80, 10, 20, 15, 10, 90, 85, 80, 60],
    );
    const outlook = nightSkyOutlook(hours, '2026-08-12', lowLat);
    expect(outlook.moonIllumination).toBeLessThan(0.15);
    expect(outlook.band).toBe('great');
  });

  it('boosts a short window to great on a new-moon night', () => {
    // Only a 2 h clear run (22–23), which alone would be decent.
    const hours = buildNight(
      '2026-08-12',
      '2026-08-13',
      [70, 80, 10, 20, 90, 90, 90, 85, 80, 60],
    );
    const outlook = nightSkyOutlook(hours, '2026-08-12', lowLat);
    expect(outlook.clearWindow).toEqual({ from: 22, to: 0 });
    expect(outlook.band).toBe('great');
  });

  it('caps a perfect night at decent under a full moon (2026-03-03 total lunar eclipse)', () => {
    const hours = buildNight('2026-03-03', '2026-03-04', [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    const outlook = nightSkyOutlook(hours, '2026-03-03', lowLat);
    expect(outlook.moonIllumination).toBeGreaterThan(0.85);
    expect(outlook.clearWindow?.from).toBe(21);
    expect(outlook.band).toBe('decent');
  });

  it('rates a cloudy night as poor with no window', () => {
    const hours = buildNight(
      '2026-08-12',
      '2026-08-13',
      [80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
    );
    const outlook = nightSkyOutlook(hours, '2026-08-12', lowLat);
    expect(outlook.clearWindow).toBeUndefined();
    expect(outlook.band).toBe('poor');
  });

  it('needs at least two consecutive clear hours', () => {
    // Single clear hours separated by cloud never form a window.
    const hours = buildNight(
      '2026-08-12',
      '2026-08-13',
      [80, 10, 80, 10, 80, 10, 80, 10, 80, 80],
    );
    const outlook = nightSkyOutlook(hours, '2026-08-12', lowLat);
    expect(outlook.clearWindow).toBeUndefined();
    expect(outlook.band).toBe('poor');
  });

  it('is poor when there are no dark hours (polar day)', () => {
    const hours = Array.from({ length: 24 }, (_, hour) => hp('2026-06-21', hour, 5, true));
    const outlook = nightSkyOutlook(hours, '2026-06-21', { lat: 69, lon: 18 });
    expect(outlook.clearWindow).toBeUndefined();
    expect(outlook.avgCloudCover).toBe(0);
    expect(outlook.band).toBe('poor');
  });

  it('handles the last forecast day (no next-morning data) without dawn trimming', () => {
    // Evening only: sunset 20:00, clear 21–23 → window 21:00–00:00.
    const hours = [
      hp('2026-08-12', 19, 10, true),
      hp('2026-08-12', 20, 70),
      hp('2026-08-12', 21, 10),
      hp('2026-08-12', 22, 15),
      hp('2026-08-12', 23, 20),
    ];
    const outlook = nightSkyOutlook(hours, '2026-08-12', lowLat);
    expect(outlook.clearWindow).toEqual({ from: 21, to: 0 });
  });

  it('applies a longer twilight trim at high latitude', () => {
    // lat 60 → 3 h trim: dark hours are 23..02, so the 20–22 clear run is
    // twilight and only 23,00 remain clear-adjacent.
    const hours = buildNight(
      '2026-08-12',
      '2026-08-13',
      [10, 10, 10, 10, 10, 90, 90, 80, 80, 60],
    );
    const outlook = nightSkyOutlook(hours, '2026-08-12', { lat: 60, lon: 25 });
    expect(outlook.clearWindow).toEqual({ from: 23, to: 1 });
  });
});
