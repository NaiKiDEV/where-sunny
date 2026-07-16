import { describe, expect, it } from 'vitest';
import { scoreDays } from '../scoring/score';
import type { DayForecast } from '../types';
import { type BestWindowEntry, bestForecastWindow, bestWindow } from './bestWindow';

/** Entries on consecutive July 2026 days; a null date-slot is skipped entirely. */
function julyEntries(startDay: number, scores: (number | null)[]): BestWindowEntry[] {
  return scores.map((score, i) => ({
    date: `2026-07-${String(startDay + i).padStart(2, '0')}`,
    score,
  }));
}

function forecastDay(date: string, sunshineRatio: number, tempMax = 22): DayForecast {
  return {
    date,
    sunshineDuration: sunshineRatio * 50_000,
    daylightDuration: 50_000,
    cloudCoverMean: (1 - sunshineRatio) * 100,
    precipProbMax: 10,
    tempMax,
    tempMin: tempMax - 8,
    weatherCode: 1,
  };
}

describe('bestWindow', () => {
  it('picks the highest-average window on a clean consecutive series', () => {
    const result = bestWindow(julyEntries(15, [60, 70, 88, 96, 91, 60, 58]));
    expect(result).toEqual({
      startDate: '2026-07-18',
      endDate: '2026-07-19',
      avgScore: 93.5, // (96 + 91) / 2, unrounded - rounding is the display layer's job
      length: 2,
    });
  });

  it('prefers the longer window on an exact average tie', () => {
    const result = bestWindow(julyEntries(15, [80, 80, 80, 80, 80, 80]));
    expect(result).toEqual({
      startDate: '2026-07-15',
      endDate: '2026-07-17',
      avgScore: 80,
      length: 3,
    });
  });

  it('picks the earliest start among equal-average windows of the same length', () => {
    const result = bestWindow(julyEntries(15, [70, 90, 90, 70, 90, 90]), [2]);
    expect(result).toEqual({
      startDate: '2026-07-16',
      endDate: '2026-07-17',
      avgScore: 90,
      length: 2,
    });
  });

  it('never bridges a missing calendar day', () => {
    // 07-18 absent: bridging 07-17 + 07-19 would average 95 and win.
    const entries = [...julyEntries(15, [60, 70, 95]), ...julyEntries(19, [95, 60])];
    const result = bestWindow(entries);
    expect(result).toEqual({
      startDate: '2026-07-16',
      endDate: '2026-07-17',
      avgScore: 82.5,
      length: 2,
    });
  });

  it('breaks the window on a null-scored day exactly like a missing day', () => {
    const result = bestWindow(julyEntries(15, [60, 70, 95, null, 95, 60]));
    expect(result).toEqual({
      startDate: '2026-07-16',
      endDate: '2026-07-17',
      avgScore: 82.5,
      length: 2,
    });
  });

  it('only fits a 3-day window into a run of at least 3 consecutive days', () => {
    // 07-17 absent: the run 07-15..16 is too short for a 3-day window.
    const entries = [...julyEntries(15, [90, 90]), ...julyEntries(18, [90, 90, 90])];
    const result = bestWindow(entries, [3]);
    expect(result).toEqual({
      startDate: '2026-07-18',
      endDate: '2026-07-20',
      avgScore: 90,
      length: 3,
    });
  });

  it('respects a custom window length', () => {
    const result = bestWindow(julyEntries(15, [60, 80, 80, 80, 80, 60, 60]), [4]);
    expect(result).toEqual({
      startDate: '2026-07-16',
      endDate: '2026-07-19',
      avgScore: 80,
      length: 4,
    });
  });

  it('stays within a single-length input even when a longer window would tie', () => {
    const result = bestWindow(julyEntries(15, [80, 80, 80, 80, 80, 80]), [2]);
    expect(result).toEqual({
      startDate: '2026-07-15',
      endDate: '2026-07-16',
      avgScore: 80,
      length: 2,
    });
  });

  it('suppresses when the best average is below 55', () => {
    expect(bestWindow(julyEntries(15, [54, 54, 54, 54, 54]))).toBeNull();
  });

  it('keeps a window averaging exactly 55', () => {
    const result = bestWindow(julyEntries(15, [55, 55, 55, 55, 55]));
    expect(result).not.toBeNull();
    expect(result!.avgScore).toBe(55);
  });

  it('suppresses when fewer than 5 days are scoreable', () => {
    expect(bestWindow(julyEntries(15, [90, 90, 90, 90]))).toBeNull();
  });

  it('does not count null-scored entries toward the 5 scoreable days', () => {
    expect(bestWindow(julyEntries(15, [90, 90, null, 90, null, 90]))).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(bestWindow([])).toBeNull();
  });

  it('sorts unsorted entries by date before sliding', () => {
    const entries = julyEntries(15, [60, 70, 88, 96, 91, 60, 58]);
    const shuffled = [entries[4], entries[0], entries[6], entries[2], entries[1], entries[5], entries[3]];
    expect(bestWindow(shuffled)).toEqual(bestWindow(entries));
  });

  it('returns null when no usable window length is given', () => {
    const entries = julyEntries(15, [90, 90, 90, 90, 90]);
    expect(bestWindow(entries, [])).toBeNull();
    expect(bestWindow(entries, [0, -2, 1.5])).toBeNull();
  });
});

describe('bestForecastWindow', () => {
  it('scores days exactly like the day strip (scoring reuse parity)', () => {
    const days = [0.2, 0.5, 0.9, 0.9, 0.9, 0.4, 0.7, 0.8].map((ratio, i) =>
      forecastDay(`2026-07-${15 + i}`, ratio),
    );
    const viaScoreDays = bestWindow(
      scoreDays(days).map((day) => ({ date: day.date, score: day.score })),
    );
    expect(bestForecastWindow(days)).toEqual(viaScoreDays);
    expect(viaScoreDays).not.toBeNull();
  });

  it('moves the window with the comfort profile', () => {
    // Warm hazy stretch, then a freezing full-sun stretch: default comfort
    // keeps the warm days on top; a cold-tolerant profile flips the winner.
    const days = [
      ...[15, 16, 17, 18, 19].map((d) => forecastDay(`2026-07-${d}`, 0.6, 22)),
      ...[20, 21, 22].map((d) => forecastDay(`2026-07-${d}`, 1, -5)),
    ];
    expect(bestForecastWindow(days)!.startDate).toBe('2026-07-15');
    expect(bestForecastWindow(days, { idealMin: -10, idealMax: 20 })!.startDate).toBe('2026-07-20');
  });
});
