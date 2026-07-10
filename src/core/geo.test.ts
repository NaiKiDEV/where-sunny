import { describe, expect, it } from 'vitest';
import { circleRing, haversineKm, snapToGrid } from './geo';

const VILNIUS = { lat: 54.687, lon: 25.28 };
const KAUNAS = { lat: 54.897, lon: 23.89 };

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(VILNIUS, VILNIUS)).toBe(0);
  });

  it('matches the known Vilnius–Kaunas distance (~92 km)', () => {
    const distance = haversineKm(VILNIUS, KAUNAS);
    expect(distance).toBeGreaterThan(88);
    expect(distance).toBeLessThan(96);
  });

  it('is symmetric', () => {
    expect(haversineKm(VILNIUS, KAUNAS)).toBeCloseTo(haversineKm(KAUNAS, VILNIUS), 10);
  });
});

describe('snapToGrid', () => {
  it('snaps to the default 0.05° grid', () => {
    expect(snapToGrid(54.687)).toBeCloseTo(54.7, 10);
    expect(snapToGrid(25.28)).toBeCloseTo(25.3, 10);
  });

  it('keeps nearby coordinates on the same cell', () => {
    expect(snapToGrid(54.6871)).toBe(snapToGrid(54.6899));
  });
});

describe('circleRing', () => {
  it('produces a closed ring with steps+1 points', () => {
    const ring = circleRing(VILNIUS, 100, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
  });

  it('keeps every point at the requested radius', () => {
    const ring = circleRing(VILNIUS, 300, 16);
    for (const [lon, lat] of ring) {
      expect(haversineKm(VILNIUS, { lat, lon })).toBeCloseTo(300, 0);
    }
  });
});
