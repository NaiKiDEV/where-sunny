import type { Origin } from '../types';
import type { Trip, TripStop } from './trip';

/**
 * Compact, URL-safe trip codec. A trip is base64url-encoded JSON with short
 * keys - small enough to live in a query string and text to a friend. Stops
 * carry their own snapshot (name/coords/elevation), so a shared trip renders
 * and forecasts on any device without the recipient's city dataset.
 */
const COORD_DECIMALS = 3;

interface SharePlace {
  k: string;
  n: string;
  c: string;
  /** ISO alpha-2 code, so a shared stop's country ban matches on any device. */
  cc?: string;
  la: number;
  lo: number;
  e?: number;
}

interface ShareTrip {
  v: 1;
  n: string;
  o?: { n: string; la: number; lo: number };
  s: SharePlace[];
}

export interface SharedTripData {
  name: string;
  origin?: Origin;
  stops: TripStop[];
}

function round(value: number): number {
  return Number(value.toFixed(COORD_DECIMALS));
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(param: string): string {
  const binary = atob(param.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeTrip(trip: Trip): string {
  const payload: ShareTrip = {
    v: 1,
    n: trip.name,
    o: trip.origin
      ? { n: trip.origin.label, la: round(trip.origin.lat), lo: round(trip.origin.lon) }
      : undefined,
    s: trip.stops.map((stop) => ({
      k: stop.place.key,
      n: stop.place.name,
      c: stop.place.country,
      la: round(stop.place.lat),
      lo: round(stop.place.lon),
      ...(stop.place.elevation !== undefined ? { e: Math.round(stop.place.elevation) } : {}),
      ...(stop.place.countryCode ? { cc: stop.place.countryCode } : {}),
    })),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharedTrip(param: string): SharedTripData | null {
  try {
    const data = JSON.parse(fromBase64Url(param)) as ShareTrip;
    if (data.v !== 1 || !Array.isArray(data.s)) return null;

    const stops: TripStop[] = data.s
      .filter((p) => typeof p.n === 'string' && Number.isFinite(p.la) && Number.isFinite(p.lo))
      .map((p) => {
        const key = typeof p.k === 'string' && p.k ? p.k : `s${p.la}_${p.lo}`;
        return {
          placeKey: key,
          place: {
            key,
            kind: 'pin',
            name: p.n,
            country: typeof p.c === 'string' ? p.c : '',
            lat: p.la,
            lon: p.lo,
            population: 0,
            ...(typeof p.e === 'number' ? { elevation: p.e } : {}),
            ...(typeof p.cc === 'string' && p.cc ? { countryCode: p.cc } : {}),
          },
        };
      });
    if (stops.length === 0) return null;

    const origin: Origin | undefined =
      data.o && Number.isFinite(data.o.la) && Number.isFinite(data.o.lo)
        ? { label: typeof data.o.n === 'string' && data.o.n ? data.o.n : 'Start', lat: data.o.la, lon: data.o.lo }
        : undefined;

    return {
      name: typeof data.n === 'string' && data.n.trim() ? data.n : 'Shared trip',
      origin,
      stops,
    };
  } catch {
    return null;
  }
}
