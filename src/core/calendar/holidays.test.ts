import { describe, expect, it, vi } from 'vitest';
import {
  fetchLongWeekends,
  fetchPublicHolidays,
  holidaysInRange,
  holidaysOnDate,
  upcomingLongWeekends,
  yearsToFetch,
  type LongWeekend,
  type PublicHoliday,
} from './holidays';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const RAW_HOLIDAY = {
  date: '2026-07-14',
  localName: 'Fête nationale',
  name: 'Bastille Day',
  countryCode: 'FR',
  fixed: true,
  global: true,
  counties: null,
  launchYear: 1880,
  types: ['Public'],
};

const HOLIDAYS: PublicHoliday[] = [
  { date: '2026-07-10', localName: 'A', name: 'A', global: true, counties: null, types: ['Public'] },
  { date: '2026-07-14', localName: 'B', name: 'B', global: true, counties: null, types: ['Public'] },
  { date: '2026-07-14', localName: 'C', name: 'C', global: false, counties: ['FR-75'], types: ['Public'] },
  { date: '2026-07-20', localName: 'D', name: 'D', global: true, counties: null, types: ['Public'] },
];

describe('fetchPublicHolidays', () => {
  it('returns [] on 404 (unsupported country) without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    await expect(fetchPublicHolidays('XX', 2026, { fetchImpl })).resolves.toEqual([]);
  });

  it('parses the fields the UI needs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([RAW_HOLIDAY]));
    const result = await fetchPublicHolidays('FR', 2026, { fetchImpl });
    expect(result).toEqual([
      {
        date: '2026-07-14',
        localName: 'Fête nationale',
        name: 'Bastille Day',
        global: true,
        counties: null,
        types: ['Public'],
      },
    ]);
  });

  it('requests the given year and country code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    await fetchPublicHolidays('FR', 2027, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toContain('/PublicHolidays/2027/FR');
  });

  it('throws on a genuine server error so the query can retry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: true }, 500));
    await expect(fetchPublicHolidays('FR', 2026, { fetchImpl })).rejects.toThrow(/HTTP 500/);
  });
});

describe('fetchLongWeekends', () => {
  it('returns [] on 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    await expect(fetchLongWeekends('XX', 2026, { fetchImpl })).resolves.toEqual([]);
  });

  it('parses start/end/count/bridge', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        { startDate: '2026-07-14', endDate: '2026-07-16', dayCount: 3, needBridgeDay: true, bridgeDays: ['x'] },
      ]),
    );
    const result = await fetchLongWeekends('FR', 2026, { fetchImpl });
    expect(result).toEqual([
      { startDate: '2026-07-14', endDate: '2026-07-16', dayCount: 3, needBridgeDay: true },
    ]);
  });
});

describe('holidaysOnDate', () => {
  it('returns every holiday on the exact date', () => {
    expect(holidaysOnDate(HOLIDAYS, '2026-07-14').map((h) => h.name)).toEqual(['B', 'C']);
  });

  it('returns [] when nothing falls on the date', () => {
    expect(holidaysOnDate(HOLIDAYS, '2026-07-15')).toEqual([]);
  });
});

describe('holidaysInRange', () => {
  it('includes both boundaries', () => {
    const inRange = holidaysInRange(HOLIDAYS, '2026-07-10', '2026-07-14');
    expect(inRange.map((h) => h.name)).toEqual(['A', 'B', 'C']);
  });

  it('excludes dates outside the range', () => {
    const inRange = holidaysInRange(HOLIDAYS, '2026-07-11', '2026-07-13');
    expect(inRange).toEqual([]);
  });

  it('tolerates a reversed range', () => {
    const inRange = holidaysInRange(HOLIDAYS, '2026-07-14', '2026-07-10');
    expect(inRange.map((h) => h.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('upcomingLongWeekends', () => {
  const WEEKENDS: LongWeekend[] = [
    { startDate: '2026-08-01', endDate: '2026-08-03', dayCount: 3, needBridgeDay: false },
    { startDate: '2026-01-01', endDate: '2026-01-04', dayCount: 4, needBridgeDay: true },
    { startDate: '2026-07-10', endDate: '2026-07-13', dayCount: 4, needBridgeDay: false },
  ];

  it('drops past weekends, sorts ascending, and caps to the limit', () => {
    const result = upcomingLongWeekends(WEEKENDS, '2026-07-12', 2);
    // 2026-01-* is fully past; the 07-10→07-13 one is still ongoing so it stays.
    expect(result.map((w) => w.startDate)).toEqual(['2026-07-10', '2026-08-01']);
  });

  it('returns [] when a zero limit is requested', () => {
    expect(upcomingLongWeekends(WEEKENDS, '2026-01-01', 0)).toEqual([]);
  });
});

describe('yearsToFetch', () => {
  it('returns the current year and the next so a window can cross Dec 31', () => {
    expect(yearsToFetch('2026-12-30')).toEqual([2026, 2027]);
    expect(yearsToFetch('2026-01-05')).toEqual([2026, 2027]);
  });
});
