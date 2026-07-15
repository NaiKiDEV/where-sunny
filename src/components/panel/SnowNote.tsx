import { Snowflake } from 'lucide-react';
import { snowNote } from '../../core/snow/snowNote';
import type { DayForecast, Place } from '../../core/types';
import { dayLabel } from '../../lib/format';

interface SnowNoteProps {
  /** The visible forecast window, from the single-place path (carries snow fields). */
  days: DayForecast[];
  place: Place;
  /** The day currently selected in the detail view (YYYY-MM-DD) - gates the season. */
  activeDate: string;
}

/**
 * One quiet line for snowy destinations - "Fresh snow Thu · ~35 cm base".
 * Sits in the day-stats conditions cluster alongside the night-sky note;
 * renders nothing when the forecast carries no meaningful snow (fresh
 * snowfall counts anywhere, standing base only in season - see
 * core/snow/snowNote). Silence is the default.
 */
export function SnowNote({ days, place, activeDate }: SnowNoteProps) {
  const note = snowNote(days, place, activeDate);
  if (!note?.show) return null;

  const parts: string[] = [];
  if (note.freshSnow) parts.push(`Fresh snow ${dayLabel(note.freshSnow.day)}`);
  if (note.baseDepthCm !== undefined) parts.push(`~${note.baseDepthCm} cm base`);

  const detail = [
    note.freshSnow && `${note.freshSnow.totalCm} cm fresh snow expected this window`,
    note.baseDepthCm !== undefined && `~${note.baseDepthCm} cm snow base`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <p className="snow-note" title={detail}>
      <Snowflake size={16} strokeWidth={2} aria-hidden /> {parts.join(' · ')}
    </p>
  );
}
