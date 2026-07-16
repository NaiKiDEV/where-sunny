import { describe, expect, it } from 'vitest';
import { activeShower, meteorNote, MAJOR_SHOWERS, peakLabel } from './meteors';

const north = 45;
const south = -30;

describe('activeShower', () => {
  it('finds the Perseids on their peak night in the north', () => {
    const active = activeShower('2026-08-12', north);
    expect(active?.shower.name).toBe('Perseids');
    expect(active?.isPeakNight).toBe(true);
  });

  it('reports a non-peak night inside the window', () => {
    const active = activeShower('2026-08-02', north);
    expect(active?.shower.name).toBe('Perseids');
    expect(active?.isPeakNight).toBe(false);
  });

  it('is null when nothing is active (mid-March lull)', () => {
    expect(activeShower('2026-03-15', north)).toBeNull();
    expect(activeShower('2026-03-15', south)).toBeNull();
  });

  it('handles the year-crossing Quadrantids window on both sides of Jan 1', () => {
    const december = activeShower('2025-12-30', north);
    expect(december?.shower.name).toBe('Quadrantids');
    expect(december?.isPeakNight).toBe(false);

    const january = activeShower('2026-01-05', north);
    expect(january?.shower.name).toBe('Quadrantids');
    expect(january?.isPeakNight).toBe(false);

    const peak = activeShower('2026-01-03', north);
    expect(peak?.shower.name).toBe('Quadrantids');
    expect(peak?.isPeakNight).toBe(true);
  });

  it('gates by hemisphere: Eta Aquariids show at -30 but not at 45', () => {
    // May 6: nothing else is active, so the north sees no shower at all.
    expect(activeShower('2026-05-06', north)).toBeNull();

    const active = activeShower('2026-05-06', south);
    expect(active?.shower.name).toBe('Eta Aquariids');
    expect(active?.isPeakNight).toBe(true);
  });

  it('gates northern showers out of the southern sky (Quadrantids at -30)', () => {
    expect(activeShower('2026-01-03', south)).toBeNull();
  });

  it('sees both-hemisphere and same-sign showers from the equator', () => {
    expect(activeShower('2026-05-06', 0)?.shower.name).toBe('Eta Aquariids');
    expect(activeShower('2026-08-12', 0)?.shower.name).toBe('Perseids');
  });

  it('picks the strongest of overlapping showers by ZHR', () => {
    // Early August in the north: Delta Aquariids (25) lose to Perseids (100).
    expect(activeShower('2026-08-02', north)?.shower.name).toBe('Perseids');
    // Same night in the south: the Perseids are gated, Delta Aquariids win.
    expect(activeShower('2026-08-02', south)?.shower.name).toBe('Delta Aquariids');
  });

  it('reports isPeakNight for the chosen shower, not any overlapping one', () => {
    // Lyrids' peak night in the south, but the Eta Aquariids' higher ZHR
    // wins the pick - so the night does not count as a peak.
    const active = activeShower('2026-04-22', south);
    expect(active?.shower.name).toBe('Eta Aquariids');
    expect(active?.isPeakNight).toBe(false);
  });

  it('is null for a malformed date string', () => {
    expect(activeShower('not-a-date', north)).toBeNull();
    expect(activeShower('', north)).toBeNull();
  });
});

describe('MAJOR_SHOWERS', () => {
  it('covers the ten headline showers', () => {
    const names = MAJOR_SHOWERS.map((s) => s.name);
    for (const required of [
      'Quadrantids',
      'Lyrids',
      'Eta Aquariids',
      'Delta Aquariids',
      'Perseids',
      'Draconids',
      'Orionids',
      'Leonids',
      'Geminids',
      'Ursids',
    ]) {
      expect(names).toContain(required);
    }
  });
});

describe('peakLabel', () => {
  it('formats month/day peaks as short labels', () => {
    const geminids = MAJOR_SHOWERS.find((s) => s.name === 'Geminids');
    const quadrantids = MAJOR_SHOWERS.find((s) => s.name === 'Quadrantids');
    expect(peakLabel(geminids!)).toBe('Dec 14');
    expect(peakLabel(quadrantids!)).toBe('Jan 3');
  });
});

describe('meteorNote', () => {
  it('is silent on a cloudy (poor) night even at a shower peak', () => {
    expect(meteorNote('2026-08-12', north, { band: 'poor', moonIllumination: 0.05 })).toBeNull();
  });

  it('is silent when no shower is active', () => {
    expect(meteorNote('2026-03-15', north, { band: 'great', moonIllumination: 0.05 })).toBeNull();
  });

  it('is silent in the wrong hemisphere', () => {
    expect(meteorNote('2026-05-06', north, { band: 'great', moonIllumination: 0.05 })).toBeNull();
  });

  it('gives the full pitch on a clear peak night with a thin moon', () => {
    expect(meteorNote('2026-08-12', north, { band: 'great', moonIllumination: 0.05 })).toBe(
      'Perseids peak tonight - clear skies and a thin moon make for good viewing.',
    );
  });

  it('softens the claim under a bright moon', () => {
    expect(meteorNote('2026-08-12', north, { band: 'decent', moonIllumination: 0.95 })).toBe(
      'Perseids peak tonight, though the bright moon will wash out fainter ones.',
    );
  });

  it('leaves the moon out of it at middling illumination', () => {
    expect(meteorNote('2026-08-12', north, { band: 'great', moonIllumination: 0.5 })).toBe(
      'Perseids peak tonight.',
    );
  });

  it('names the peak date on an active non-peak night', () => {
    expect(meteorNote('2026-12-10', north, { band: 'decent', moonIllumination: 0.5 })).toBe(
      'The Geminids are active (peak Dec 14).',
    );
  });
});
