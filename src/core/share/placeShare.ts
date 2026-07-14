import type { Place } from '../types';

/**
 * Compact, URL-safe single-place codec. Mirrors the trip codec
 * (src/core/trip/share.ts): base64url-encoded JSON with short keys, small
 * enough to live in a query string and text to a friend. The place carries its
 * own snapshot (name/country/countryCode/coords/elevation), so a shared link
 * renders and forecasts on any device without the recipient's city dataset.
 */
const COORD_DECIMALS = 3;

interface SharePlacePayload {
  v: 1;
  k?: string;
  n: string;
  c: string;
  /** ISO alpha-2 code, so a shared place's country ban matches on any device. */
  cc?: string;
  la: number;
  lo: number;
  e?: number;
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

export function encodePlace(place: Place): string {
  const payload: SharePlacePayload = {
    v: 1,
    k: place.key,
    n: place.name,
    c: place.country,
    la: round(place.lat),
    lo: round(place.lon),
    ...(place.elevation !== undefined ? { e: Math.round(place.elevation) } : {}),
    ...(place.countryCode ? { cc: place.countryCode } : {}),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharedPlace(param: string): Place | null {
  try {
    const data = JSON.parse(fromBase64Url(param)) as SharePlacePayload;
    if (data.v !== 1) return null;
    if (typeof data.n !== 'string' || !data.n.trim()) return null;
    if (!Number.isFinite(data.la) || !Number.isFinite(data.lo)) return null;

    const key = typeof data.k === 'string' && data.k ? data.k : `s${data.la}_${data.lo}`;
    return {
      key,
      kind: 'pin',
      name: data.n,
      country: typeof data.c === 'string' ? data.c : '',
      lat: data.la,
      lon: data.lo,
      population: 0,
      ...(typeof data.e === 'number' && Number.isFinite(data.e) ? { elevation: data.e } : {}),
      ...(typeof data.cc === 'string' && data.cc ? { countryCode: data.cc } : {}),
    };
  } catch {
    return null;
  }
}
