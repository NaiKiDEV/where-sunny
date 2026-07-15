import { ThermometerSnowflake, ThermometerSun } from 'lucide-react';
import { anomaly, dateNormal, describeDatePart } from '../../core/climate/normals';
import type { LatLon } from '../../core/types';
import { useClimateNormals } from '../../hooks/useClimateNormals';
import { useAppStore } from '../../state/store';

const FAHRENHEIT_PER_CELSIUS = 1.8;

interface AnomalyNoteProps {
  coords: LatLon;
  /** The day whose forecast is shown (YYYY-MM-DD). */
  date: string;
  /** Forecast daily maximum for that day, °C. */
  forecastTmax: number;
}

/**
 * "~6° warmer than typical for mid-July" - the selected day's forecast tmax
 * against the ten-year normal for that calendar date. Renders nothing while
 * normals load, on error, or when the difference is within ±3 °C, so it only
 * appears when there is genuinely something to say.
 */
export function AnomalyNote({ coords, date, forecastTmax }: AnomalyNoteProps) {
  const { normals } = useClimateNormals(coords);
  const unit = useAppStore((s) => s.unit);

  if (!normals) return null;
  const result = anomaly(forecastTmax, dateNormal(normals, date));
  if (!result) return null;

  // A temperature *difference* scales by 9/5 only - no +32 offset, so the
  // absolute-temp helpers in lib/format don't apply here.
  const shownDelta = Math.round(
    Math.abs(unit === 'f' ? result.deltaC * FAHRENHEIT_PER_CELSIUS : result.deltaC),
  );
  const Icon = result.direction === 'warmer' ? ThermometerSun : ThermometerSnowflake;

  return (
    <p className={`anomaly-note anomaly-note-${result.direction}`}>
      <Icon size={16} strokeWidth={2} aria-hidden />
      ~{shownDelta}° {result.direction} than typical for {describeDatePart(date)}
    </p>
  );
}
