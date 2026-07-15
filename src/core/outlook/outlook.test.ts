import { describe, expect, it } from 'vitest';
import { scoreDay } from '../scoring/score';
import type { DayForecast } from '../types';
import { outlookDays } from './outlook';

function forecastDay(date: string, sunshineRatio = 0.8): DayForecast {
  return {
    date,
    sunshineDuration: sunshineRatio * 50_000,
    daylightDuration: 50_000,
    cloudCoverMean: (1 - sunshineRatio) * 100,
    precipProbMax: 10,
    tempMax: 22,
    tempMin: 14,
    weatherCode: 1,
  };
}

/** `count` consecutive July 2026 days starting at the given day-of-month. */
function julyDays(startDay: number, count: number): DayForecast[] {
  return Array.from({ length: count }, (_, i) =>
    forecastDay(`2026-07-${String(startDay + i).padStart(2, '0')}`, (i % 5) / 5),
  );
}

describe('outlookDays', () => {
  it('drops the first 7 days when no boundary date is given', () => {
    const outlook = outlookDays(julyDays(15, 16));
    expect(outlook).toHaveLength(9);
    expect(outlook[0].date).toBe('2026-07-22');
    expect(outlook[outlook.length - 1].date).toBe('2026-07-30');
  });

  it('keeps only days after the boundary date', () => {
    const outlook = outlookDays(julyDays(15, 16), '2026-07-21');
    expect(outlook).toHaveLength(9);
    expect(outlook.every((day) => day.date > '2026-07-21')).toBe(true);
  });

  it('never duplicates a main-strip day when the destination calendar is offset', () => {
    // Destination a day behind the requester: the 16-day fetch starts 07-14,
    // so index 7 (07-21) is a date the main strip already shows.
    const offsetForecast = julyDays(14, 16);
    const outlook = outlookDays(offsetForecast, '2026-07-21');
    expect(outlook[0].date).toBe('2026-07-22');
    expect(outlook.some((day) => day.date <= '2026-07-21')).toBe(false);
  });

  it('scores every day exactly like the main grid (scoring reuse parity)', () => {
    const days = julyDays(15, 16);
    const outlook = outlookDays(days);
    for (const scored of outlook) {
      const source = days.find((day) => day.date === scored.date)!;
      expect(scored.score).toBe(scoreDay(source));
    }
  });

  it('respects comfort prefs the same way the main grid does', () => {
    const coldDay = { ...forecastDay('2026-07-23', 1), tempMax: 10 };
    const [mild] = outlookDays([coldDay], '2026-07-22');
    const [tolerant] = outlookDays([coldDay], '2026-07-22', { idealMin: 5, idealMax: 20 });
    expect(tolerant.score).toBeGreaterThan(mild.score);
  });

  it('carries snow fields through untouched', () => {
    const snowy = { ...forecastDay('2026-07-23'), snowfallSum: 4, snowDepthMax: 0.6 };
    const [scored] = outlookDays([snowy], '2026-07-22');
    expect(scored.snowfallSum).toBe(4);
    expect(scored.snowDepthMax).toBe(0.6);
  });

  it('returns empty when the forecast has no days beyond the window', () => {
    expect(outlookDays([])).toEqual([]);
    expect(outlookDays(julyDays(15, 7))).toEqual([]);
    expect(outlookDays(julyDays(15, 7), '2026-07-21')).toEqual([]);
  });
});
