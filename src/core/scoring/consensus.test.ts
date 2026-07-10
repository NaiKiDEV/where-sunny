import { describe, expect, it } from 'vitest';
import type { DayForecast } from '../types';
import type { ModelForecast } from '../weather/models';
import { modelConsensus } from './consensus';

function day(date: string, sunshineRatio: number): DayForecast {
  return {
    date,
    sunshineDuration: sunshineRatio * 50_000,
    daylightDuration: 50_000,
    cloudCoverMean: (1 - sunshineRatio) * 100,
    precipProbMax: 0,
    tempMax: 22,
    tempMin: 14,
    weatherCode: 1,
  };
}

function model(id: string, label: string, days: DayForecast[]): ModelForecast {
  return { model: id as ModelForecast['model'], label, days };
}

describe('modelConsensus', () => {
  it('marks close scores as high agreement', () => {
    const consensus = modelConsensus([
      model('a', 'A', [day('2026-07-11', 0.9)]),
      model('b', 'B', [day('2026-07-11', 0.85)]),
      model('c', 'C', [day('2026-07-11', 0.88)]),
    ]);
    expect(consensus).toHaveLength(1);
    expect(consensus[0].scores).toHaveLength(3);
    expect(consensus[0].level).toBe('high');
  });

  it('marks widely diverging scores as low agreement', () => {
    const consensus = modelConsensus([
      model('a', 'A', [day('2026-07-11', 0.95)]),
      model('b', 'B', [day('2026-07-11', 0.2)]),
    ]);
    expect(consensus[0].level).toBe('low');
    expect(consensus[0].spread).toBeGreaterThan(30);
  });

  it('skips models missing a date instead of failing', () => {
    const consensus = modelConsensus([
      model('a', 'A', [day('2026-07-11', 0.5), day('2026-07-12', 0.5)]),
      model('b', 'B', [day('2026-07-12', 0.6)]),
    ]);
    expect(consensus[0].scores).toHaveLength(1);
    expect(consensus[1].scores).toHaveLength(2);
  });

  it('returns empty for no usable models', () => {
    expect(modelConsensus([])).toEqual([]);
    expect(modelConsensus([model('a', 'A', [])])).toEqual([]);
  });
});
