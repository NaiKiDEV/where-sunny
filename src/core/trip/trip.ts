import { haversineKm } from '../geo';
import type { LatLon, Origin, Place } from '../types';

/** One stop on a trip. The place is a denormalized snapshot: bundled-city keys
 * are index-based and would drift across dataset rebuilds, so a saved trip must
 * carry enough to render and forecast itself without the live candidate list. */
export interface TripStop {
  placeKey: string;
  place: Place;
  /** 1-based day this stop is planned for. Several stops can share a day. */
  day?: number;
  note?: string;
}

/** A saved itinerary. Stops are grouped into days; order within a day is the
 * visiting sequence. */
export interface Trip {
  id: string;
  name: string;
  /** Departure snapshot, used for the first leg + proximity ordering. */
  origin?: Origin;
  stops: TripStop[];
  createdAt: string;
}

export interface TripLeg {
  from: string;
  to: string;
  km: number;
}

/** A stop's day, defaulting to 1 (covers legacy stops persisted before days). */
export function stopDay(stop: TripStop): number {
  return typeof stop.day === 'number' && stop.day >= 1 ? Math.floor(stop.day) : 1;
}

/** How many days the trip spans (0 when empty). */
export function tripDayCount(trip: Trip): number {
  return trip.stops.length === 0 ? 0 : trip.stops.reduce((max, s) => Math.max(max, stopDay(s)), 1);
}

/** Stops in visiting order: by day, then insertion order within a day. */
export function orderedStops(trip: Trip): TripStop[] {
  return trip.stops
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => stopDay(a.stop) - stopDay(b.stop) || a.index - b.index)
    .map((entry) => entry.stop);
}

/** Close any gaps in day numbers (e.g. 1,3 -> 1,2) so days stay contiguous. */
function normalizeDays(stops: TripStop[]): TripStop[] {
  const used = [...new Set(stops.map(stopDay))].sort((a, b) => a - b);
  const remap = new Map(used.map((day, i) => [day, i + 1]));
  return stops.map((s) => ({ ...s, day: remap.get(stopDay(s)) ?? 1 }));
}

export function addStop(trip: Trip, place: Place): Trip {
  if (trip.stops.some((s) => s.placeKey === place.key)) return trip;
  // Land new stops on the current last day - adding several in a row groups
  // them onto the same day, which is the common case ("a few towns in a day").
  const day = trip.stops.length === 0 ? 1 : tripDayCount(trip);
  return { ...trip, stops: [...trip.stops, { placeKey: place.key, place, day }] };
}

export function removeStop(trip: Trip, placeKey: string): Trip {
  if (!trip.stops.some((s) => s.placeKey === placeKey)) return trip;
  return { ...trip, stops: normalizeDays(trip.stops.filter((s) => s.placeKey !== placeKey)) };
}

/**
 * Shift a stop to an earlier (-1) or later (+1) day. +1 past the last day opens
 * a new one; days are re-compacted so numbers never gap.
 */
export function moveStopDay(trip: Trip, placeKey: string, delta: -1 | 1): Trip {
  if (!trip.stops.some((s) => s.placeKey === placeKey)) return trip;
  const ceiling = tripDayCount(trip) + 1;
  const stops = trip.stops.map((s) =>
    s.placeKey === placeKey ? { ...s, day: Math.min(Math.max(1, stopDay(s) + delta), ceiling) } : s,
  );
  return { ...trip, stops: normalizeDays(stops) };
}

export function renameTrip(trip: Trip, name: string): Trip {
  const trimmed = name.trim();
  return trimmed && trimmed !== trip.name ? { ...trip, name: trimmed } : trip;
}

/** Consecutive straight-line legs in visiting order, incl. origin -> first stop. */
export function tripLegs(trip: Trip): TripLeg[] {
  const points: { label: string; coord: LatLon }[] = [];
  if (trip.origin) points.push({ label: trip.origin.label, coord: trip.origin });
  for (const stop of orderedStops(trip)) points.push({ label: stop.place.name, coord: stop.place });

  const legs: TripLeg[] = [];
  for (let i = 1; i < points.length; i++) {
    legs.push({ from: points[i - 1].label, to: points[i].label, km: haversineKm(points[i - 1].coord, points[i].coord) });
  }
  return legs;
}

export function tripTotalKm(trip: Trip): number {
  return tripLegs(trip).reduce((sum, leg) => sum + leg.km, 0);
}

/**
 * Greedy nearest-neighbour reordering within each day, chaining the cursor from
 * the origin through the days. Straight-line only - a genuinely shorter tour
 * would need real routing, which stays out of scope (no free keyless routing).
 */
export function orderByProximity(trip: Trip): Trip {
  if (trip.stops.length < 3) return trip;
  let cursor: LatLon = trip.origin ?? orderedStops(trip)[0].place;
  const result: TripStop[] = [];

  for (let day = 1; day <= tripDayCount(trip); day++) {
    const remaining = trip.stops.filter((s) => stopDay(s) === day);
    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestKm = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const km = haversineKm(cursor, remaining[i].place);
        if (km < bestKm) {
          bestKm = km;
          bestIndex = i;
        }
      }
      const [next] = remaining.splice(bestIndex, 1);
      result.push(next);
      cursor = next.place;
    }
  }
  return { ...trip, stops: result };
}
