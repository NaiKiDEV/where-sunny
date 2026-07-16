import { describe, expect, it } from 'vitest';
import { addIsoDays, windowDates } from './window';

// 2026-07-10 is a Friday
const FRIDAY = new Date(2026, 6, 10, 15, 30);
const SATURDAY = new Date(2026, 6, 11);
const SUNDAY = new Date(2026, 6, 12);
const MONDAY = new Date(2026, 6, 13);

describe('windowDates', () => {
  it('today is the single current local date', () => {
    expect(windowDates('today', FRIDAY)).toEqual(['2026-07-10']);
  });

  it('tomorrow is the single next local date', () => {
    expect(windowDates('tomorrow', FRIDAY)).toEqual(['2026-07-11']);
  });

  it('weekend from a weekday is the upcoming Sat+Sun', () => {
    expect(windowDates('weekend', FRIDAY)).toEqual(['2026-07-11', '2026-07-12']);
    expect(windowDates('weekend', MONDAY)).toEqual(['2026-07-18', '2026-07-19']);
  });

  it('weekend on Saturday still covers both days', () => {
    expect(windowDates('weekend', SATURDAY)).toEqual(['2026-07-11', '2026-07-12']);
  });

  it('weekend on Sunday is what is left of it', () => {
    expect(windowDates('weekend', SUNDAY)).toEqual(['2026-07-12']);
  });

  it('week is 7 consecutive dates, crossing month boundaries', () => {
    const dates = windowDates('week', new Date(2026, 6, 28));
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-07-28');
    expect(dates[6]).toBe('2026-08-03');
  });

  it('every window fits inside the 7-day forecast horizon', () => {
    for (const id of ['today', 'tomorrow', 'weekend', 'week'] as const) {
      for (let dow = 0; dow < 7; dow++) {
        const now = new Date(2026, 6, 5 + dow); // 2026-07-05 is a Sunday
        const horizon = windowDates('week', now);
        for (const date of windowDates(id, now)) {
          expect(horizon).toContain(date);
        }
      }
    }
  });
});

describe('addIsoDays', () => {
  it('adds days within a month', () => {
    expect(addIsoDays('2026-07-10', 1)).toBe('2026-07-11');
    expect(addIsoDays('2026-07-10', 3)).toBe('2026-07-13');
  });

  it('rolls over month and year boundaries', () => {
    expect(addIsoDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addIsoDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
