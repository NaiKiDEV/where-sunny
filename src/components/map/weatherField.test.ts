import { describe, expect, it } from 'vitest';
import { edgeEnvelope } from './weatherField';

const GRID = 96;

describe('edgeEnvelope', () => {
  it('is fully transparent on all four borders', () => {
    // Arrange / Act / Assert - each border cell must vanish so no rectangle shows.
    expect(edgeEnvelope(0, 0, GRID)).toBe(0);
    expect(edgeEnvelope(GRID - 1, 0, GRID)).toBe(0);
    expect(edgeEnvelope(0, GRID - 1, GRID)).toBe(0);
    expect(edgeEnvelope(GRID - 1, GRID - 1, GRID)).toBe(0);
    expect(edgeEnvelope(GRID / 2, 0, GRID)).toBe(0);
    expect(edgeEnvelope(0, GRID / 2, GRID)).toBe(0);
  });

  it('is fully opaque in the interior past the fade band', () => {
    expect(edgeEnvelope(GRID / 2, GRID / 2, GRID)).toBe(1);
  });

  it('ramps monotonically from border toward center', () => {
    const y = GRID / 2;
    let prev = -1;
    for (let x = 0; x <= GRID / 2; x++) {
      const v = edgeEnvelope(x, y, GRID);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('stays within [0, 1]', () => {
    for (let x = 0; x < GRID; x++) {
      const v = edgeEnvelope(x, 3, GRID);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is symmetric across opposite edges', () => {
    for (let x = 0; x < GRID; x++) {
      expect(edgeEnvelope(x, 10, GRID)).toBeCloseTo(edgeEnvelope(GRID - 1 - x, 10, GRID), 10);
    }
  });
});
