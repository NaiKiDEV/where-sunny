import { describe, expect, test } from 'vitest';
import { GROUND_LINK_MAX_KM, buildRome2RioLink } from './groundLinks';

describe('buildRome2RioLink', () => {
  test('builds the map URL for simple one-word names', () => {
    const url = buildRome2RioLink('Berlin', 'Prague');

    expect(url).toBe('https://www.rome2rio.com/map/Berlin/Prague');
  });

  test('turns spaces into hyphens', () => {
    const url = buildRome2RioLink('New York', 'Washington DC');

    expect(url).toBe('https://www.rome2rio.com/map/New-York/Washington-DC');
  });

  test('collapses runs of whitespace into a single hyphen', () => {
    const url = buildRome2RioLink('Rio  de   Janeiro', 'Lisbon');

    expect(url).toBe('https://www.rome2rio.com/map/Rio-de-Janeiro/Lisbon');
  });

  test('keeps existing hyphens and preserves diacritics through encodeURI', () => {
    const url = buildRome2RioLink('Saint-Malo', 'Málaga');

    expect(url).toBe(`https://www.rome2rio.com/map/Saint-Malo/${encodeURI('Málaga')}`);
    expect(url).toContain('M%C3%A1laga');
  });

  test('handles multi-word city and country combos with diacritics', () => {
    const url = buildRome2RioLink('São Paulo Brazil', 'Rio de Janeiro');

    expect(url).toBe(
      `https://www.rome2rio.com/map/${encodeURI('São-Paulo-Brazil')}/Rio-de-Janeiro`,
    );
  });

  test('strips slashes, question marks, and hashes from the path', () => {
    const url = buildRome2RioLink('Ronda/Málaga', 'Faro? #1');

    expect(url).not.toMatch(/[?#]/);
    expect(url.replace('https://', '')).not.toContain('//');
    expect(url).toBe(`https://www.rome2rio.com/map/${encodeURI('Ronda-Málaga')}/Faro-1`);
  });

  test('trims surrounding whitespace instead of hyphenating it', () => {
    const url = buildRome2RioLink('  Faro  ', 'Lagos');

    expect(url).toBe('https://www.rome2rio.com/map/Faro/Lagos');
  });

  test('throws on empty names', () => {
    expect(() => buildRome2RioLink('', 'Faro')).toThrow(/origin/);
    expect(() => buildRome2RioLink('Faro', '   ')).toThrow(/destination/);
  });

  test('throws when a name is nothing but path-breaking characters', () => {
    expect(() => buildRome2RioLink('#?/', 'Faro')).toThrow(/origin/);
  });
});

describe('GROUND_LINK_MAX_KM', () => {
  test('is the documented 800 km detail-panel threshold', () => {
    expect(GROUND_LINK_MAX_KM).toBe(800);
  });
});
