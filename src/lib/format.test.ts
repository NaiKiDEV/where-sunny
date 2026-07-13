import { describe, expect, it } from 'vitest';
import { formatTemp, formatTempBare, toDisplayTemp } from './format';

describe('toDisplayTemp', () => {
  it('returns Celsius unchanged in Celsius mode', () => {
    expect(toDisplayTemp(20, 'c')).toBe(20);
    expect(toDisplayTemp(-5, 'c')).toBe(-5);
  });

  it('converts Celsius to Fahrenheit', () => {
    expect(toDisplayTemp(0, 'f')).toBe(32);
    expect(toDisplayTemp(100, 'f')).toBe(212);
    expect(toDisplayTemp(20, 'f')).toBe(68);
  });
});

describe('formatTemp', () => {
  it('rounds and appends a °C symbol in Celsius mode', () => {
    expect(formatTemp(20.4, 'c')).toBe('20°C');
    expect(formatTemp(20.6, 'c')).toBe('21°C');
  });

  it('converts, rounds, and appends a °F symbol in Fahrenheit mode', () => {
    expect(formatTemp(20, 'f')).toBe('68°F');
    expect(formatTemp(0, 'f')).toBe('32°F');
  });
});

describe('formatTempBare', () => {
  it('shows a degree symbol without the unit letter', () => {
    expect(formatTempBare(20, 'c')).toBe('20°');
    expect(formatTempBare(20, 'f')).toBe('68°');
  });
});
