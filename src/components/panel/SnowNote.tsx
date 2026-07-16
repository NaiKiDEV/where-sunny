import { Snowflake } from 'lucide-react';
import { snowNote } from '../../core/snow/snowNote';
import type { DayForecast, Place } from '../../core/types';
import { dayLabel, formatSnowDepth } from '../../lib/format';
import { useAppStore } from '../../state/store';

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
  const system = useAppStore((s) => s.unitSystem);
  const note = snowNote(days, place, activeDate);
  if (!note?.show) return null;

  const parts: string[] = [];
  if (note.freshSnow) parts.push(`Fresh snow ${dayLabel(note.freshSnow.day)}`);
  if (note.baseDepthCm !== undefined) parts.push(`~${formatSnowDepth(note.baseDepthCm, system)} base`);

  const detail = [
    note.freshSnow && `${formatSnowDepth(note.freshSnow.totalCm, system)} fresh snow expected this window`,
    note.baseDepthCm !== undefined && `~${formatSnowDepth(note.baseDepthCm, system)} snow base`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <p className="snow-note" title={detail}>
      <Snowflake size={16} strokeWidth={2} aria-hidden /> {parts.join(' · ')}
    </p>
  );
}
