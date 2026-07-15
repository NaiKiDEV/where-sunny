import { CalendarRange } from 'lucide-react';
import { outlookDays } from '../../core/outlook/outlook';
import type { PlaceForecast, ScoredDay } from '../../core/types';
import { dayLabel, dayOfMonth } from '../../lib/format';
import { scoreColor } from '../../lib/scoreColor';
import { weatherVisual } from '../../lib/weatherIcon';
import { useAppStore } from '../../state/store';

function OutlookChip({ day }: { day: ScoredDay }) {
  const { Icon, color } = weatherVisual(day.weatherCode);
  return (
    <div className="outlook-chip">
      <span className="outlook-chip-label">
        {dayLabel(day.date)}{' '}
        <span className="outlook-chip-date">{dayOfMonth(day.date)}</span>
      </span>
      <Icon size={18} strokeWidth={2} color={color} aria-hidden />
      <span className="outlook-chip-dot" style={{ background: scoreColor(day.score) }} />
    </div>
  );
}

/**
 * Trend strip for the days beyond the main 7-day window — a low-precision
 * outlook, honestly labeled and visually muted vs. the main day strip. Renders
 * nothing while loading or on error: this is supplementary information, and an
 * empty gap degrades better than a spinner for a section the user didn't ask for.
 */
export function OutlookStrip({
  forecast,
  afterDate,
}: {
  /** Full extended forecast from usePlaceForecast (null until loaded). */
  forecast: PlaceForecast | null;
  /** Last date (YYYY-MM-DD) the main day strip shows; the outlook starts after it. */
  afterDate?: string;
}) {
  const comfort = useAppStore((s) => s.comfort);
  const days = forecast ? outlookDays(forecast.days, afterDate, comfort) : [];
  if (days.length === 0) return null;

  return (
    <section className="outlook" aria-label="Extended outlook, lower confidence">
      <div className="outlook-head">
        <CalendarRange size={16} strokeWidth={2} aria-hidden /> Further out{' '}
        <span className="outlook-head-hint">(lower confidence)</span>
      </div>
      <div className="outlook-strip">
        {days.map((d) => (
          <OutlookChip key={d.date} day={d} />
        ))}
      </div>
    </section>
  );
}
