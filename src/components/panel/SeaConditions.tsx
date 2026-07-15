import { useState } from 'react';
import { ChevronDown, Waves } from 'lucide-react';
import {
  swimBand,
  waveComfort,
  type MarineDay,
  type SwimBand,
  type WaveComfort,
} from '../../core/marine/marine';
import type { Place } from '../../core/types';
import { useMarine } from '../../hooks/useMarine';
import { dayLabel, formatTemp, formatTempBare, type TempUnit } from '../../lib/format';

const BAND_LABEL: Record<SwimBand, string> = {
  cold: 'Cold',
  fresh: 'Fresh',
  pleasant: 'Pleasant',
  warm: 'Warm',
};

const WAVE_LABEL: Record<WaveComfort, string> = {
  calm: 'Calm sea',
  moderate: 'Some waves',
  rough: 'Rough sea',
};

interface SeaConditionsProps {
  place: Place;
  /** The day currently selected in the detail view (YYYY-MM-DD). */
  activeDate: string;
  unit: TempUnit;
}

function waveNote(day: MarineDay): string | null {
  if (day.waveHeightMax === null) return null;
  return `${WAVE_LABEL[waveComfort(day.waveHeightMax)]} · ${day.waveHeightMax.toFixed(1)} m`;
}

/**
 * Sea temperature and wave comfort for coastal places, from the Open-Meteo
 * Marine API. Renders nothing for inland places (the useMarine pre-filter plus
 * the API's null answer decide that), and degrades silently on errors - sea
 * data is a bonus, never a blocker. Expanding shows the full forecast window.
 */
export function SeaConditions({ place, activeDate, unit }: SeaConditionsProps) {
  const { days, isLoading, isError } = useMarine(place);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <section className="sea-conditions" aria-label="Sea conditions">
        <button type="button" className="sea-summary" disabled>
          <Waves size={16} strokeWidth={2} aria-hidden />
          <span className="sea-row-text sea-row-loading">Checking sea conditions…</span>
        </button>
      </section>
    );
  }

  // Inland (null), failed probe, or empty series: silence is the default.
  if (isError || !days) return null;

  const active =
    days.find((d) => d.date === activeDate && d.seaTempMax !== null) ??
    days.find((d) => d.seaTempMax !== null);
  if (!active || active.seaTempMax === null) return null;

  const band = swimBand(active.seaTempMax);
  const note = waveNote(active);
  const canExpand = days.length > 1;

  return (
    <section className="sea-conditions" aria-label="Sea conditions">
      <button
        type="button"
        className="sea-summary"
        onClick={() => canExpand && setExpanded((v) => !v)}
        aria-expanded={canExpand ? expanded : undefined}
        disabled={!canExpand}
      >
        <Waves size={16} strokeWidth={2} aria-hidden />
        <span className="sea-row-text">
          <span className="sea-row-label">
            Sea {formatTemp(active.seaTempMax, unit)}
            {active.date !== activeDate && (
              <span className="sea-row-hint"> · {dayLabel(active.date)}</span>
            )}
          </span>
          <span className={`sea-band sea-band-${band}`}>{BAND_LABEL[band]}</span>
          {note && <span className="sea-wave">{note}</span>}
        </span>
        {canExpand && (
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={expanded ? 'sea-chevron sea-chevron-open' : 'sea-chevron'}
          />
        )}
      </button>

      {expanded && (
        <ul className="sea-days">
          {days.map((d) => (
            <li key={d.date} className={`sea-day${d.date === activeDate ? ' is-active' : ''}`}>
              <span className="sea-day-label">{dayLabel(d.date)}</span>
              {d.seaTempMax === null ? (
                <span className="sea-day-empty">no data</span>
              ) : (
                <>
                  <span className="sea-day-temp">{formatTempBare(d.seaTempMax, unit)}</span>
                  <span className={`sea-band sea-band-${swimBand(d.seaTempMax)}`}>
                    {BAND_LABEL[swimBand(d.seaTempMax)]}
                  </span>
                  {d.waveHeightMax !== null && (
                    <span className="sea-day-wave">{d.waveHeightMax.toFixed(1)} m</span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
