import { CalendarClock, CalendarDays, PartyPopper } from 'lucide-react';
import {
  holidaysInRange,
  upcomingLongWeekends,
  type PublicHoliday,
} from '../../core/calendar/holidays';
import type { Place } from '../../core/types';
import { useCountryCalendar } from '../../hooks/useCountryCalendar';
import { useLocalDate } from '../../hooks/useLocalDate';
import { dayLabel, formatWeekendDate } from '../../lib/format';

const MAX_LONG_WEEKENDS = 2;

interface CalendarNoteProps {
  place: Place;
  /** The day currently selected in the detail view (YYYY-MM-DD). */
  activeDate: string;
  /** Every date in the forecast window (YYYY-MM-DD). */
  windowDates: string[];
}

/** Join holiday names for a compact one-liner, keeping the local name. */
function holidayNames(holidays: PublicHoliday[]): string {
  return [...new Set(holidays.map((h) => h.localName))].join(', ');
}

/**
 * Turns a destination's country calendar into travel context: a holiday on the
 * selected day (closures/crowds), other holidays within the forecast window, and
 * the next long weekends. Renders nothing when the country is unknown,
 * unsupported, or has no relevant dates - it degrades silently.
 */
export function CalendarNote({ place, activeDate, windowDates }: CalendarNoteProps) {
  const { holidaysByDate, longWeekends, isUnsupported } = useCountryCalendar(place);
  const todayIso = useLocalDate();

  if (isUnsupported) return null;

  const allHolidays = [...holidaysByDate.values()].flat();
  const onActiveDay = holidaysByDate.get(activeDate) ?? [];

  const sortedWindow = [...windowDates].sort();
  const windowStart = sortedWindow[0] ?? activeDate;
  const windowEnd = sortedWindow[sortedWindow.length - 1] ?? activeDate;
  // Holidays elsewhere in the forecast window, excluding the active day (already shown above).
  const thisWeek = holidaysInRange(allHolidays, windowStart, windowEnd).filter(
    (h) => h.date !== activeDate,
  );

  const nextWeekends = upcomingLongWeekends(longWeekends, todayIso, MAX_LONG_WEEKENDS);

  if (onActiveDay.length === 0 && thisWeek.length === 0 && nextWeekends.length === 0) {
    return null;
  }

  return (
    <section className="calendar-note" aria-label="Holidays and long weekends">
      {onActiveDay.length > 0 && (
        <div className="calendar-callout">
          <PartyPopper size={18} strokeWidth={2} aria-hidden />
          <div className="calendar-callout-body">
            <strong>Public holiday: {holidayNames(onActiveDay)}</strong>
            <p>Expect closures and crowds; many attractions may keep holiday hours.</p>
          </div>
        </div>
      )}

      {thisWeek.length > 0 && (
        <div className="calendar-row">
          <CalendarDays size={16} strokeWidth={2} aria-hidden />
          <span className="calendar-row-text">
            <span className="calendar-row-label">Holidays this week</span>
            {thisWeek.map((h) => (
              <span key={`${h.date}-${h.name}`} className="calendar-tag">
                {h.localName} <span className="calendar-tag-day">{dayLabel(h.date)}</span>
              </span>
            ))}
          </span>
        </div>
      )}

      {nextWeekends.length > 0 && (
        <div className="calendar-row calendar-row-weekends">
          <CalendarClock size={16} strokeWidth={2} aria-hidden />
          <span className="calendar-row-text">
            <span className="calendar-row-label">
              {nextWeekends.length > 1 ? 'Long weekends ahead' : 'Next long weekend'}
              <span className="calendar-row-hint"> · public holidays in this country</span>
            </span>
            {nextWeekends.map((w) => {
              const cause = holidaysInRange(allHolidays, w.startDate, w.endDate);
              const reason = cause.length > 0 ? holidayNames(cause) : null;
              return (
                <span key={w.startDate} className="calendar-weekend">
                  <span className="calendar-weekend-dates">
                    {formatWeekendDate(w.startDate)} – {formatWeekendDate(w.endDate)}
                    <span className="calendar-tag-day"> · {w.dayCount} days off</span>
                  </span>
                  {(reason || w.needBridgeDay) && (
                    <span className="calendar-weekend-reason">
                      {reason ? `for ${reason}` : 'around a public holiday'}
                      {w.needBridgeDay ? ' · needs a bridge day off' : ''}
                    </span>
                  )}
                </span>
              );
            })}
          </span>
        </div>
      )}
    </section>
  );
}
