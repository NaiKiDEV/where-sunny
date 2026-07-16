import { CalendarCheck } from 'lucide-react';
import { bestForecastWindow } from '../../core/outlook/bestWindow';
import type { PlaceForecast } from '../../core/types';
import { dayOfMonth, shortDayLabel } from '../../lib/format';
import { scoreColor, scoreTextColor } from '../../lib/scoreColor';
import { useAppStore } from '../../state/store';

/**
 * One glanceable line answering "which stretch of days is the trip": the
 * highest-scoring 2-3 day window across the full extended forecast, scored
 * with the user's comfort profile - the exact model behind the day strip and
 * outlook dots. Bonus-tier: renders nothing while the forecast loads, on
 * error, or when no window is worth recommending (suppression rules live in
 * core/outlook/bestWindow).
 */
export function BestWindowChip({
  forecast,
  onSelectDay,
}: {
  /** Full extended forecast from usePlaceForecast (null until loaded). */
  forecast: PlaceForecast | null;
  /** Called with the window's first date (YYYY-MM-DD) so a tap selects that day chip. */
  onSelectDay?: (date: string) => void;
}) {
  const comfort = useAppStore((s) => s.comfort);
  const best = forecast ? bestForecastWindow(forecast.days, comfort) : null;
  if (!best) return null;

  const avg = Math.round(best.avgScore);
  const content = (
    <>
      <CalendarCheck size={16} strokeWidth={2} aria-hidden />
      <span className="best-window-text">
        Best {best.length}-day window: {shortDayLabel(best.startDate)} {dayOfMonth(best.startDate)}{' '}
        - {shortDayLabel(best.endDate)} {dayOfMonth(best.endDate)} · avg{' '}
        <span
          className="best-window-avg"
          style={{ background: scoreColor(avg), color: scoreTextColor(avg) }}
        >
          {avg}
        </span>
      </span>
    </>
  );

  if (!onSelectDay) return <p className="best-window">{content}</p>;
  return (
    <button type="button" className="best-window" onClick={() => onSelectDay(best.startDate)}>
      {content}
    </button>
  );
}
