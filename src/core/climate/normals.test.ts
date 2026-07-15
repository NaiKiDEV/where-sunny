import { describe, expect, it, vi } from 'vitest';
import {
  anomaly,
  archiveRange,
  bestMonths,
  buildArchiveUrl,
  dateNormal,
  describeDatePart,
  fetchClimateNormals,
  formatMonthRanges,
  monthScore,
  reduceNormals,
  type ClimateNormals,
  type MonthlyNormal,
} from './normals';

const BARCELONA = { lat: 41.39, lon: 2.17 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function emptyNormals(tmaxByDay: Record<string, number>): ClimateNormals {
  return { monthly: [], tmaxByDay, years: null };
}

function normal(overrides: Partial<MonthlyNormal> & { month: number }): MonthlyNormal {
  return { avgTmax: 15, rainDays: 8, sunshineHoursPerDay: 5, ...overrides };
}

describe('archiveRange', () => {
  it('covers the last ten full calendar years before now', () => {
    expect(archiveRange(new Date('2026-07-15'))).toEqual({
      startDate: '2016-01-01',
      endDate: '2025-12-31',
    });
  });

  it('never includes the current, incomplete year', () => {
    expect(archiveRange(new Date('2026-12-31')).endDate).toBe('2025-12-31');
  });
});

describe('buildArchiveUrl', () => {
  it('requests the three daily variables over the given range', () => {
    const url = new URL(buildArchiveUrl(BARCELONA, '2016-01-01', '2025-12-31'));
    expect(url.origin + url.pathname).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(url.searchParams.get('latitude')).toBe('41.39');
    expect(url.searchParams.get('longitude')).toBe('2.17');
    expect(url.searchParams.get('start_date')).toBe('2016-01-01');
    expect(url.searchParams.get('end_date')).toBe('2025-12-31');
    expect(url.searchParams.get('daily')).toBe(
      'temperature_2m_max,precipitation_sum,sunshine_duration',
    );
    expect(url.searchParams.get('timezone')).toBe('auto');
  });
});

describe('reduceNormals', () => {
  const daily = {
    time: ['2023-01-01', '2023-01-02', '2024-01-01', '2024-01-02', '2023-07-01', '2024-07-01'],
    temperature_2m_max: [10, 12, 14, 16, 30, 34],
    precipitation_sum: [0, 5, 2, 0, 0, 0.5],
    sunshine_duration: [3600, 7200, 3600, 7200, 36000, 36000],
  };

  it('averages tmax and sunshine per month', () => {
    const { monthly } = reduceNormals(daily);
    expect(monthly).toHaveLength(12);
    expect(monthly[0]).toEqual({
      month: 1,
      avgTmax: 13,
      rainDays: 1,
      sunshineHoursPerDay: 1.5,
    });
    expect(monthly[6].avgTmax).toBe(32);
    expect(monthly[6].sunshineHoursPerDay).toBe(10);
  });

  it('counts wet days at the 1 mm threshold, averaged per year', () => {
    const { monthly } = reduceNormals(daily);
    // Two wet January days (5 mm, 2 mm) across two years; July's 0.5 mm is dry.
    expect(monthly[0].rainDays).toBe(1);
    expect(monthly[6].rainDays).toBe(0);
  });

  it('averages tmax per calendar day across years', () => {
    const { tmaxByDay } = reduceNormals(daily);
    expect(tmaxByDay['01-01']).toBe(12);
    expect(tmaxByDay['01-02']).toBe(14);
    expect(tmaxByDay['07-01']).toBe(32);
  });

  it('records the year span and zeroes months without samples', () => {
    const result = reduceNormals(daily);
    expect(result.years).toEqual({ start: 2023, end: 2024 });
    expect(result.monthly[3]).toEqual({
      month: 4,
      avgTmax: 0,
      rainDays: 0,
      sunshineHoursPerDay: 0,
    });
  });

  it('skips null rows per variable', () => {
    const result = reduceNormals({
      time: ['2024-01-01', '2024-01-02'],
      temperature_2m_max: [null, 20],
      precipitation_sum: [3, null],
      sunshine_duration: [null, 7200],
    });
    expect(result.monthly[0].avgTmax).toBe(20);
    expect(result.monthly[0].rainDays).toBe(1);
    expect(result.monthly[0].sunshineHoursPerDay).toBe(2);
    expect(result.tmaxByDay['01-01']).toBeUndefined();
  });
});

describe('dateNormal', () => {
  it('averages the ±7-day window around a mid-year date', () => {
    const normals = emptyNormals({ '07-10': 30, '07-15': 32, '07-20': 34 });
    expect(dateNormal(normals, '2026-07-15')).toBe(32);
  });

  it("reaches into December for early January's window", () => {
    const normals = emptyNormals({
      '12-29': 4,
      '12-30': 6,
      '12-31': 8,
      '01-01': 10,
      '01-02': 12,
      '01-03': 14,
    });
    expect(dateNormal(normals, '2026-01-01')).toBe(9);
  });

  it("reaches into January for late December's window", () => {
    const normals = emptyNormals({ '12-31': 8, '01-02': 12 });
    expect(dateNormal(normals, '2026-12-30')).toBe(10);
  });

  it('returns null when the window has no samples or the date is invalid', () => {
    expect(dateNormal(emptyNormals({ '06-01': 25 }), '2026-01-15')).toBeNull();
    expect(dateNormal(emptyNormals({}), 'not-a-date')).toBeNull();
  });
});

describe('anomaly', () => {
  it('suppresses differences under ±3 °C and unknown normals', () => {
    expect(anomaly(29.9, 27)).toBeNull();
    expect(anomaly(24.5, 27)).toBeNull();
    expect(anomaly(30, null)).toBeNull();
  });

  it('bands a warmer forecast', () => {
    expect(anomaly(30, 27)).toEqual({ deltaC: 3, direction: 'warmer', band: 'notable' });
    expect(anomaly(34, 27)).toEqual({ deltaC: 7, direction: 'warmer', band: 'strong' });
  });

  it('bands a cooler forecast', () => {
    expect(anomaly(20, 27)).toEqual({ deltaC: -7, direction: 'cooler', band: 'strong' });
    expect(anomaly(23, 27)).toEqual({ deltaC: -4, direction: 'cooler', band: 'notable' });
  });
});

describe('monthScore / bestMonths', () => {
  it('prefers sunny, dry, pleasantly warm months', () => {
    const june = normal({ month: 6, avgTmax: 24, rainDays: 0, sunshineHoursPerDay: 10 });
    const november = normal({ month: 11, avgTmax: 8, rainDays: 14, sunshineHoursPerDay: 2 });
    expect(monthScore(june)).toBeGreaterThan(monthScore(november));
    expect(monthScore(june)).toBeCloseTo(1, 5);
  });

  it('returns the top months in calendar order', () => {
    const monthly = Array.from({ length: 12 }, (_, idx) =>
      normal({
        month: idx + 1,
        // peak appeal in May–July, dreary winter
        avgTmax: 24 - Math.abs(idx + 1 - 6) * 3,
        rainDays: 4 + Math.abs(idx + 1 - 6) * 2,
        sunshineHoursPerDay: 10 - Math.abs(idx + 1 - 6),
      }),
    );
    expect(bestMonths(monthly)).toEqual([5, 6, 7]);
    expect(bestMonths(monthly, 1)).toEqual([6]);
  });

  it('handles short input safely', () => {
    expect(bestMonths([])).toEqual([]);
  });
});

describe('formatMonthRanges', () => {
  it('collapses consecutive months into ranges', () => {
    expect(formatMonthRanges([6, 7, 8])).toBe('Jun–Aug');
    expect(formatMonthRanges([5, 6, 9])).toBe('May–Jun & Sep');
    expect(formatMonthRanges([4])).toBe('Apr');
    expect(formatMonthRanges([])).toBe('');
  });

  it('wraps a December–January run across the new year', () => {
    expect(formatMonthRanges([1, 11, 12])).toBe('Nov–Jan');
    expect(formatMonthRanges([1, 2, 7, 12])).toBe('Jul & Dec–Feb');
  });
});

describe('describeDatePart', () => {
  it('splits a month into early / mid / late', () => {
    expect(describeDatePart('2026-07-03')).toBe('early July');
    expect(describeDatePart('2026-07-15')).toBe('mid-July');
    expect(describeDatePart('2026-07-28')).toBe('late July');
  });
});

describe('fetchClimateNormals', () => {
  const payload = {
    daily: {
      time: ['2024-01-01', '2024-07-01'],
      temperature_2m_max: [10, 30],
      precipitation_sum: [5, 0],
      sunshine_duration: [3600, 36000],
    },
  };

  it('fetches the ten-year archive and reduces it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const result = await fetchClimateNormals(BARCELONA, {
      fetchImpl,
      now: new Date('2026-07-15'),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(url.searchParams.get('start_date')).toBe('2016-01-01');
    expect(url.searchParams.get('end_date')).toBe('2025-12-31');
    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[0].avgTmax).toBe(10);
    expect(result.tmaxByDay['07-01']).toBe(30);
  });

  it('throws on HTTP errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchClimateNormals(BARCELONA, { fetchImpl })).rejects.toThrow('HTTP 500');
  });

  it('throws on a malformed payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ daily: { time: [] } }));
    await expect(fetchClimateNormals(BARCELONA, { fetchImpl })).rejects.toThrow('malformed');
  });
});
