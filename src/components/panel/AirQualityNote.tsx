import { ChevronDown, Flower2, Wind } from 'lucide-react';
import { useState } from 'react';
import {
  aqiBand,
  type AirDaySummary,
  type AqiBand,
  type DominantPollen,
} from '../../core/air/airQuality';
import type { LatLon } from '../../core/types';
import { useAirQuality } from '../../hooks/useAirQuality';
import { dayLabel } from '../../lib/format';

interface AirQualityNoteProps {
  /** Where to sample air quality (a Place works - it extends LatLon). */
  coords: LatLon | null;
  /** The day currently selected in the detail view (YYYY-MM-DD). */
  activeDate: string;
  /** Every date in the forecast window (YYYY-MM-DD). */
  windowDates: string[];
}

const POLLEN_NOUN: Record<DominantPollen['kind'], string> = {
  birch: 'Birch',
  grass: 'Grass',
  olive: 'Olive',
  ragweed: 'Ragweed',
};

function bandOf(day: AirDaySummary): AqiBand | null {
  return day.maxEuropeanAqi === null ? null : aqiBand(day.maxEuropeanAqi);
}

/** A day earns a mention when its air is worse than good or pollen is up. */
function isNoteworthy(day: AirDaySummary): boolean {
  const band = bandOf(day);
  return (band !== null && band !== 'good') || day.dominantPollen !== undefined;
}

function bandClass(band: AqiBand): string {
  return `air-badge air-badge-${band.replace(' ', '-')}`;
}

function pollenClass(level: DominantPollen['level']): string {
  return `air-badge air-badge-pollen-${level}`;
}

function DayBadges({ day, showNumeric = false }: { day: AirDaySummary; showNumeric?: boolean }) {
  const band = bandOf(day);
  return (
    <>
      {band !== null && (
        <span className={bandClass(band)}>
          {band}
          {showNumeric && day.maxEuropeanAqi !== null && (
            <>
              {' '}
              · <span className="air-badge-value">{day.maxEuropeanAqi}</span>
            </>
          )}
        </span>
      )}
      {day.dominantPollen && (
        <span className={pollenClass(day.dominantPollen.level)}>
          <Flower2 size={12} strokeWidth={2} aria-hidden />
          {POLLEN_NOUN[day.dominantPollen.kind]} pollen {day.dominantPollen.level}
        </span>
      )}
    </>
  );
}

/**
 * Air quality + pollen caveat for the forecast window. Silence is the default:
 * renders nothing while loading, on error, without data, or when every day is
 * good air with no notable pollen - a warning is the feature (the same
 * philosophy as the dim-range hint). The collapsed card is just the labeled
 * title (badges wrap and inflate the header otherwise); expanding reveals the
 * per-day detail.
 */
export function AirQualityNote({ coords, activeDate, windowDates }: AirQualityNoteProps) {
  const { days, isLoading, isError } = useAirQuality(coords);
  const [isExpanded, setIsExpanded] = useState(false);

  // Supplementary info: degrade silently rather than showing spinners/errors.
  if (isLoading || isError) return null;

  const inWindow = new Set(windowDates);
  const windowDays = days.filter(
    (d) => inWindow.has(d.date) && (d.maxEuropeanAqi !== null || d.dominantPollen),
  );
  const noteworthy = windowDays.filter(isNoteworthy);
  if (noteworthy.length === 0) return null;

  return (
    <section className="air-note" aria-label="Air quality and pollen">
      <button
        type="button"
        className="air-note-summary"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
      >
        <span className="air-note-title">
          <Wind size={16} strokeWidth={2} aria-hidden />
          Air quality & pollen
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={isExpanded ? 'air-note-chevron air-note-chevron-open' : 'air-note-chevron'}
        />
      </button>

      {isExpanded && (
        <ul className="air-note-days">
          {windowDays.map((day) => {
            const isActive = day.date === activeDate;
            return (
              <li
                key={day.date}
                className={isActive ? 'air-note-day-row air-note-day-active' : 'air-note-day-row'}
              >
                <span className="air-note-day-label">{dayLabel(day.date)}</span>
                <span className="air-note-badges">
                  <DayBadges day={day} showNumeric />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
