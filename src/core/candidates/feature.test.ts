import { describe, expect, it } from 'vitest';
import { isNotableTerrain, terrainOf } from './feature';

describe('terrainOf', () => {
  it('classifies by elevation band', () => {
    expect(terrainOf(2400)).toBe('alpine');
    expect(terrainOf(1500)).toBe('alpine');
    expect(terrainOf(900)).toBe('highland');
    expect(terrainOf(500)).toBe('highland');
    expect(terrainOf(120)).toBe('lowland');
    expect(terrainOf(0)).toBe('lowland');
  });

  it('returns undefined when elevation is unknown', () => {
    expect(terrainOf(undefined)).toBeUndefined();
    expect(terrainOf(Number.NaN)).toBeUndefined();
  });
});

describe('isNotableTerrain', () => {
  it('surfaces only alpine and highland', () => {
    expect(isNotableTerrain('alpine')).toBe(true);
    expect(isNotableTerrain('highland')).toBe(true);
    expect(isNotableTerrain('lowland')).toBe(false);
    expect(isNotableTerrain(undefined)).toBe(false);
  });
});
