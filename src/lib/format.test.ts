import { describe, expect, it } from 'vitest';
import {
  countryDisplayName,
  formatDistance,
  formatDriveTime,
  formatElevation,
  formatSeaHeight,
  formatSnowDepth,
  formatTemp,
  formatTempBare,
  formatWind,
  toDisplayTemp,
} from './format';

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

describe('formatDriveTime', () => {
  it('shows bare minutes under an hour', () => {
    expect(formatDriveTime(45)).toBe('45 min');
    expect(formatDriveTime(59)).toBe('59 min');
  });

  it('shows hours with zero-padded minutes from an hour up', () => {
    expect(formatDriveTime(60)).toBe('1 h');
    expect(formatDriveTime(100)).toBe('1 h 40 min');
    expect(formatDriveTime(185)).toBe('3 h 05 min');
  });
});

describe('formatDistance', () => {
  it('shows km with one decimal under 10, whole numbers above', () => {
    expect(formatDistance(0.4, 'metric')).toBe('< 1 km');
    expect(formatDistance(5.23, 'metric')).toBe('5.2 km');
    expect(formatDistance(128.6, 'metric')).toBe('129 km');
  });

  it('converts to miles with the same rounding rules', () => {
    expect(formatDistance(1.2, 'imperial')).toBe('< 1 mi');
    expect(formatDistance(8, 'imperial')).toBe('5.0 mi');
    expect(formatDistance(160.9344, 'imperial')).toBe('100 mi');
  });

  it('groups thousands with a comma regardless of the runtime locale', () => {
    expect(formatDistance(3000, 'metric')).toBe('3,000 km');
    expect(formatDistance(3000, 'imperial')).toBe('1,864 mi');
  });
});

describe('formatWind', () => {
  it('rounds km/h in metric', () => {
    expect(formatWind(19.6, 'metric')).toBe('20 km/h');
  });

  it('converts to mph in imperial', () => {
    expect(formatWind(32, 'imperial')).toBe('20 mph');
  });
});

describe('formatElevation', () => {
  it('shows whole metres in metric', () => {
    expect(formatElevation(957.4, 'metric')).toBe('957 m');
  });

  it('converts to whole feet in imperial', () => {
    expect(formatElevation(100, 'imperial')).toBe('328 ft');
  });

  it('groups thousands with a comma regardless of the runtime locale', () => {
    expect(formatElevation(3200, 'metric')).toBe('3,200 m');
  });
});

describe('formatSeaHeight', () => {
  it('keeps one decimal under 10', () => {
    expect(formatSeaHeight(0.42, 'metric')).toBe('0.4 m');
    expect(formatSeaHeight(0.4, 'imperial')).toBe('1.3 ft');
  });

  it('drops the decimal from 10 up', () => {
    expect(formatSeaHeight(16, 'metric')).toBe('16 m');
    expect(formatSeaHeight(16, 'imperial')).toBe('52 ft');
  });
});

describe('formatSnowDepth', () => {
  it('shows whole centimetres in metric', () => {
    expect(formatSnowDepth(35, 'metric')).toBe('35 cm');
  });

  it('converts to whole inches in imperial', () => {
    expect(formatSnowDepth(35, 'imperial')).toBe('14 in');
  });
});

describe('countryDisplayName', () => {
  it('resolves an ISO code to its English name', () => {
    expect(countryDisplayName({ country: 'PT' })).toBe('Portugal');
    expect(countryDisplayName({ countryCode: 'ES', country: 'Spain' })).toBe('Spain');
  });

  it('passes a full geocoded name through', () => {
    expect(countryDisplayName({ country: 'Portugal' })).toBe('Portugal');
  });

  it('returns undefined when nothing resolves', () => {
    expect(countryDisplayName({})).toBeUndefined();
  });
});
