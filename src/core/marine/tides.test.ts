import { describe, expect, it } from 'vitest';
import type { SeaLevelHour } from './marine';
import { MIN_TIDAL_RANGE_M, NOTABLE_TIDAL_RANGE_M, tidesForDay } from './tides';

const DATE = '2026-07-16';

function hoursFor(date: string, heights: (number | null)[]): SeaLevelHour[] {
  return heights.map((height, i) => ({
    time: `${date}T${String(i).padStart(2, '0')}:00`,
    height,
  }));
}

/** Semidiurnal-ish triangle wave: trough 00:00, peak 08:00, trough 16:00, rising to 23:00. */
const SINE_LIKE = [
  -3, -2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4, 3, 2.4, 1.6, 0.8, 0, -0.8, -1.6, -2.4, -3, -2.4, -1.6,
  -0.8, 0, 0.8, 1.6, 2.4,
];

describe('tidesForDay', () => {
  it('finds highs and lows on a sine-like day and reports the range', () => {
    const tides = tidesForDay(hoursFor(DATE, SINE_LIKE), DATE);
    expect(tides).not.toBeNull();
    // Interior peak at 08:00 plus the rising series edge at 23:00.
    expect(tides?.highs.map((h) => h.time)).toEqual([`${DATE}T08:00`, `${DATE}T23:00`]);
    expect(tides?.highs.map((h) => h.height)).toEqual([3, 2.4]);
    // Edge trough at 00:00 and interior trough at 16:00.
    expect(tides?.lows.map((l) => l.time)).toEqual([`${DATE}T00:00`, `${DATE}T16:00`]);
    expect(tides?.lows.map((l) => l.height)).toEqual([-3, -3]);
    expect(tides?.range).toBe(6);
  });

  it('passes local time strings through untouched', () => {
    const tides = tidesForDay(hoursFor(DATE, SINE_LIKE), DATE);
    for (const event of [...(tides?.highs ?? []), ...(tides?.lows ?? [])]) {
      expect(event.time).toMatch(new RegExp(`^${DATE}T\\d{2}:00$`));
    }
  });

  it('counts a series-edge maximum at hour 0', () => {
    // Monotonic fall all day: high right at the edge, low at the other edge.
    const falling = Array.from({ length: 24 }, (_, h) => 3 - h * 0.25);
    const tides = tidesForDay(hoursFor(DATE, falling), DATE);
    expect(tides?.highs.map((h) => h.time)).toEqual([`${DATE}T00:00`]);
    expect(tides?.lows.map((l) => l.time)).toEqual([`${DATE}T23:00`]);
  });

  it('counts a series-edge maximum at hour 23', () => {
    const rising = Array.from({ length: 24 }, (_, h) => -3 + h * 0.25);
    const tides = tidesForDay(hoursFor(DATE, rising), DATE);
    expect(tides?.highs.map((h) => h.time)).toEqual([`${DATE}T23:00`]);
    expect(tides?.lows.map((l) => l.time)).toEqual([`${DATE}T00:00`]);
  });

  it('represents a flat plateau by its middle hour', () => {
    // Peak plateau across 07:00-11:00 -> 09:00; trough plateau 16:00-17:00 -> 16:00.
    const heights = [
      0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 3.5, 3.5, 3.5, 3.5, 3, 2, 1, 0, -1, -1, 0, 1, 1.5, 2, 2.5,
      2.8,
    ];
    const tides = tidesForDay(hoursFor(DATE, heights), DATE);
    expect(tides?.highs.map((h) => h.time)).toContain(`${DATE}T09:00`);
    expect(tides?.lows.map((l) => l.time)).toEqual([`${DATE}T00:00`, `${DATE}T16:00`]);
  });

  it('skips null gaps and still compares across them', () => {
    const heights: (number | null)[] = [...SINE_LIKE];
    heights[7] = null; // hole right before the peak
    heights[9] = null; // and right after
    heights[15] = null;
    const tides = tidesForDay(hoursFor(DATE, heights), DATE);
    expect(tides?.highs.map((h) => h.time)).toContain(`${DATE}T08:00`);
    expect(tides?.lows.map((l) => l.time)).toContain(`${DATE}T16:00`);
  });

  it('returns null for an all-null (inland) series', () => {
    expect(tidesForDay(hoursFor(DATE, Array.from({ length: 24 }, () => null)), DATE)).toBeNull();
  });

  it('returns null when the series does not cover the requested day', () => {
    expect(tidesForDay(hoursFor('2026-07-15', SINE_LIKE), DATE)).toBeNull();
  });

  it('suppresses micro-tidal days below the range threshold', () => {
    const mediterranean = SINE_LIKE.map((h) => h * 0.06); // 0.36 m range
    expect(tidesForDay(hoursFor(DATE, mediterranean), DATE)).toBeNull();
    expect(MIN_TIDAL_RANGE_M).toBe(0.5);
    expect(NOTABLE_TIDAL_RANGE_M).toBeGreaterThan(MIN_TIDAL_RANGE_M);
  });

  it('judges day-boundary hours against real neighbors from adjacent days', () => {
    // Yesterday ends falling into today: today's 00:00 sits mid-flank and must
    // not fake an event; the true low at 02:00 is interior thanks to context.
    const yesterday = hoursFor('2026-07-15', [
      0.8, 1.6, 2.4, 3, 2.4, 1.6, 0.8, 0, -0.8, -1.6, -2.4, -3, -2.4, -1.6, -0.8, 0, 0.8, 1.6,
      2.4, 3, 2.4, 1.6, 0.8, 0,
    ]);
    const today = hoursFor(DATE, [
      -1.6, -2.4, -3, -2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4, 3, 2.4, 1.6, 0.8, 0, -0.8, -1.6, -2.4,
      -3, -2.4, -1.6, -0.8, 0, 0.8,
    ]);
    const tomorrow = hoursFor('2026-07-17', [1.6, 2.4, 3]);
    const tides = tidesForDay([...yesterday, ...today, ...tomorrow], DATE);
    expect(tides?.lows.map((l) => l.time)).toEqual([`${DATE}T02:00`, `${DATE}T18:00`]);
    expect(tides?.highs.map((h) => h.time)).toEqual([`${DATE}T10:00`]);
    // Yesterday's own extrema never leak into today's answer.
    for (const event of [...(tides?.highs ?? []), ...(tides?.lows ?? [])]) {
      expect(event.time.startsWith(DATE)).toBe(true);
    }
  });
});
