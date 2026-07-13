import { describe, expect, it } from 'vitest';
import type { Place } from '../types';
import {
  addStop,
  moveStopDay,
  orderByProximity,
  orderedStops,
  removeStop,
  stopDay,
  tripDayCount,
  tripLegs,
  tripTotalKm,
  type Trip,
} from './trip';

function place(key: string, lat: number, lon: number, name = key): Place {
  return { key, kind: 'city', name, country: 'XX', lat, lon, population: 1000 };
}

function trip(overrides: Partial<Trip> = {}): Trip {
  return { id: 't1', name: 'Trip', stops: [], createdAt: '2026-07-12T00:00:00Z', ...overrides };
}

describe('addStop / removeStop', () => {
  it('appends in order and ignores duplicates', () => {
    let t = trip();
    t = addStop(t, place('a', 0, 0));
    t = addStop(t, place('b', 1, 1));
    t = addStop(t, place('a', 0, 0));
    expect(t.stops.map((s) => s.placeKey)).toEqual(['a', 'b']);
  });

  it('removes a stop, leaving the rest ordered', () => {
    let t = trip();
    ['a', 'b', 'c'].forEach((k, i) => (t = addStop(t, place(k, i, i))));
    t = removeStop(t, 'b');
    expect(t.stops.map((s) => s.placeKey)).toEqual(['a', 'c']);
  });
});

describe('days', () => {
  it('lands new stops on the current last day', () => {
    let t = trip();
    t = addStop(t, place('a', 0, 0));
    t = addStop(t, place('b', 1, 1));
    expect(tripDayCount(t)).toBe(1);
    t = moveStopDay(t, 'b', 1);
    t = addStop(t, place('c', 2, 2)); // lands on the last day (2)
    expect(stopDay(t.stops.find((s) => s.placeKey === 'c')!)).toBe(2);
  });

  it('moves a stop to a new day, then compacts gaps on removal', () => {
    let t = trip();
    ['a', 'b', 'c'].forEach((k, i) => (t = addStop(t, place(k, i, i))));
    t = moveStopDay(t, 'c', 1);
    expect(stopDay(t.stops.find((s) => s.placeKey === 'c')!)).toBe(2);
    expect(tripDayCount(t)).toBe(2);
    t = removeStop(t, 'a'); // day 1 still has b, no gap
    t = removeStop(t, 'b'); // day 1 now empty -> c's day 2 compacts to day 1
    expect(stopDay(t.stops[0])).toBe(1);
    expect(tripDayCount(t)).toBe(1);
  });

  it('orders stops by day then insertion order', () => {
    let t = trip();
    ['a', 'b', 'c'].forEach((k, i) => (t = addStop(t, place(k, i, i))));
    t = moveStopDay(t, 'a', 1);
    expect(orderedStops(t).map((s) => s.placeKey)).toEqual(['b', 'c', 'a']);
  });
});

describe('tripLegs / tripTotalKm', () => {
  it('includes the origin leg and sums consecutive distances', () => {
    let t = trip({ origin: { lat: 0, lon: 0, label: 'Home' } });
    t = addStop(t, place('a', 0, 1, 'A'));
    t = addStop(t, place('b', 0, 2, 'B'));
    const legs = tripLegs(t);
    expect(legs.map((l) => `${l.from}→${l.to}`)).toEqual(['Home→A', 'A→B']);
    expect(tripTotalKm(t)).toBeCloseTo(legs[0].km + legs[1].km, 5);
    expect(tripTotalKm(t)).toBeGreaterThan(0);
  });

  it('omits the origin leg when there is no origin', () => {
    let t = trip();
    t = addStop(t, place('a', 0, 1, 'A'));
    t = addStop(t, place('b', 0, 2, 'B'));
    expect(tripLegs(t)).toHaveLength(1);
  });
});

describe('orderByProximity', () => {
  it('greedily visits the nearest next stop from the origin', () => {
    let t = trip({ origin: { lat: 0, lon: 0, label: 'Home' } });
    // deliberately out of order: far, near, mid
    t = addStop(t, place('far', 0, 10, 'Far'));
    t = addStop(t, place('near', 0, 1, 'Near'));
    t = addStop(t, place('mid', 0, 5, 'Mid'));
    expect(orderByProximity(t).stops.map((s) => s.placeKey)).toEqual(['near', 'mid', 'far']);
  });

  it('leaves trips of fewer than 3 stops untouched', () => {
    let t = trip({ origin: { lat: 0, lon: 0, label: 'Home' } });
    t = addStop(t, place('far', 0, 10));
    t = addStop(t, place('near', 0, 1));
    expect(orderByProximity(t).stops.map((s) => s.placeKey)).toEqual(['far', 'near']);
  });
});
