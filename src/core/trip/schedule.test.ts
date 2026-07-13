import { describe, expect, it } from 'vitest';
import type { ScoredDay } from '../types';
import { planTrip } from './schedule';
import type { TripStop } from './trip';

function stop(placeKey: string, day = 1): TripStop {
  return {
    placeKey,
    day,
    place: { key: placeKey, kind: 'city', name: placeKey, country: 'XX', lat: 0, lon: 0, population: 1 },
  };
}

function scoredDay(date: string, score: number): ScoredDay {
  return {
    date,
    score,
    sunshineDuration: 0,
    daylightDuration: 50_000,
    cloudCoverMean: 0,
    precipProbMax: 0,
    tempMax: 20,
    tempMin: 12,
    weatherCode: 0,
  };
}

const DATES = ['2026-07-12', '2026-07-13', '2026-07-14'];

describe('planTrip', () => {
  it('maps each stop to its assigned day and picks that day forecast', () => {
    const byStop = [
      [scoredDay(DATES[0], 40), scoredDay(DATES[1], 90), scoredDay(DATES[2], 10)],
      [scoredDay(DATES[0], 50), scoredDay(DATES[1], 55), scoredDay(DATES[2], 80)],
    ];
    // both stops on day 1 -> same date (multiple cities in one day)
    const sameDay = planTrip([stop('a', 1), stop('b', 1)], byStop, DATES);
    expect(sameDay[0].assignedDate).toBe(DATES[0]);
    expect(sameDay[1].assignedDate).toBe(DATES[0]);
    expect(sameDay[1].forecast?.score).toBe(50);

    const nextDay = planTrip([stop('a', 1), stop('b', 2)], byStop, DATES);
    expect(nextDay[1].dayIndex).toBe(1);
    expect(nextDay[1].forecast?.score).toBe(55);
  });

  it('reports the sunniest day in the horizon as best', () => {
    const byStop = [[scoredDay(DATES[0], 40), scoredDay(DATES[1], 90), scoredDay(DATES[2], 10)]];
    const plan = planTrip([stop('a')], byStop, DATES);
    expect(plan[0].best?.date).toBe(DATES[1]);
    expect(plan[0].best?.score).toBe(90);
  });

  it('clamps a day beyond the horizon to the last date', () => {
    const plan = planTrip([stop('a', 9)], [[scoredDay(DATES[2], 30)]], DATES);
    expect(plan[0].dayIndex).toBe(2);
    expect(plan[0].assignedDate).toBe(DATES[2]);
  });

  it('tolerates missing forecast data', () => {
    const plan = planTrip([stop('a')], [], DATES);
    expect(plan[0].forecast).toBeNull();
    expect(plan[0].best).toBeNull();
  });
});
