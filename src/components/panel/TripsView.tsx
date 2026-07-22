import { useState } from 'react';
import {
  BedDouble,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Plus,
  Route,
  Share2,
  Sunrise,
  Trash2,
  Waves,
  Wand2,
  X,
} from 'lucide-react';
import { haversineKm } from '../../core/geo';
import { buildBookingUrl } from '../../core/lodging/stayLinks';
import type { DriveLeg } from '../../core/routing/osrm';
import { addIsoDays, windowDates } from '../../core/scoring/window';
import { encodeTrip } from '../../core/trip/share';
import {
  orderedStops,
  stopDay,
  tripDayCount,
  type Trip,
  type TripStop,
} from '../../core/trip/trip';
import type { Place } from '../../core/types';
import { useBannedFilter } from '../../hooks/useBannedFilter';
import { useCountryCalendar } from '../../hooks/useCountryCalendar';
import { useDriveRoute } from '../../hooks/useDriveRoute';
import { useTripPlan, type StopInsight } from '../../hooks/useTripPlan';
import {
  countryDisplayName,
  countryFlag,
  dayLabel,
  formatDistance,
  formatDriveTime,
  formatTemp,
} from '../../lib/format';
import { scoreColor, scoreTextColor } from '../../lib/scoreColor';
import { weatherVisual } from '../../lib/weatherIcon';
import { useAppStore } from '../../state/store';
import { TerrainTag } from './TerrainTag';

// Only nudge "sunnier on X" when the better day is meaningfully better.
const BETTER_DAY_MARGIN = 12;

function StopMeta({ insight }: { insight: StopInsight }) {
  const unit = useAppStore((s) => s.unit);
  const { plan, sunrise, sunset, seaTempC } = insight;
  const { forecast, best, assignedDate } = plan;
  if (!forecast) return null;
  const { Icon: WeatherGlyph, color } = weatherVisual(forecast.weatherCode);
  const betterElsewhere =
    best && best.date !== assignedDate && best.score - forecast.score >= BETTER_DAY_MARGIN;

  return (
    <span className="trip-stop-meta">
      <span
        className="trip-score-dot"
        style={{ background: scoreColor(forecast.score), color: scoreTextColor(forecast.score) }}
      >
        {forecast.score}
      </span>
      <WeatherGlyph size={14} strokeWidth={2} color={color} aria-hidden />
      {sunrise && sunset && (
        <span className="trip-stop-timing">
          <Sunrise size={13} strokeWidth={2} aria-hidden /> {sunrise}–{sunset}
        </span>
      )}
      {seaTempC !== undefined && (
        <span className="trip-stop-sea">
          <Waves size={13} strokeWidth={2} aria-hidden /> {formatTemp(seaTempC, unit)}
        </span>
      )}
      {betterElsewhere && <span className="trip-stop-better">sunnier {dayLabel(best!.date)}</span>}
    </span>
  );
}

/**
 * A small "Holiday" flag when the stop's country has a public holiday on the
 * day it's planned for. Reuses useCountryCalendar, which dedupes by country in
 * the TanStack cache, so several stops in one country cost a single fetch.
 */
function StopHolidayFlag({ place, date }: { place: Place; date: string }) {
  const { holidaysByDate } = useCountryCalendar(place);
  if (!date) return null;
  const holidays = holidaysByDate.get(date) ?? [];
  if (holidays.length === 0) return null;
  return (
    <span
      className="trip-stop-holiday"
      title={holidays.map((h) => h.localName).join(', ')}
    >
      <CalendarDays size={13} strokeWidth={2} aria-hidden /> Holiday
    </span>
  );
}

function TripStopRow({
  stop,
  legKm,
  driveLeg,
  insight,
  stayUrl,
}: {
  stop: TripStop;
  legKm: number | null;
  /** Routed leg from the previous stop; null keeps the straight-line display. */
  driveLeg?: DriveLeg | null;
  insight?: StopInsight;
  /** Pre-built Booking.com link for this stop's nights; absent = no link. */
  stayUrl?: string;
}) {
  const setPreviewPlace = useAppStore((s) => s.setPreviewPlace);
  const removeFromTrip = useAppStore((s) => s.removeFromTrip);
  const moveTripStopDay = useAppStore((s) => s.moveTripStopDay);
  const system = useAppStore((s) => s.unitSystem);

  return (
    // .reveal (§5.3): a newly added or moved stop rises in on mount so the user
    // sees where it landed. Only newly inserted <li>s animate - existing rows
    // keep their DOM node across renders and don't re-run the entrance.
    <li className="trip-stop reveal">
      {legKm !== null && (
        <span className="trip-leg">
          ↳{' '}
          {driveLeg
            ? `${formatDriveTime(driveLeg.minutes)} · ${formatDistance(driveLeg.km, system)}`
            : formatDistance(legKm, system)}
        </span>
      )}
      <div className="trip-stop-row">
        <button type="button" className="trip-stop-main" onClick={() => setPreviewPlace(stop.place)}>
          <span className="place-name">
            {stop.place.name} <span className="place-flag">{countryFlag(stop.place.country)}</span>
            <TerrainTag elevation={stop.place.elevation} />
          </span>
          {insight && <StopMeta insight={insight} />}
          {insight && <StopHolidayFlag place={stop.place} date={insight.plan.assignedDate} />}
        </button>
        <span className="trip-stop-actions">
          {stayUrl && (
            <a
              className="trip-icon-btn"
              href={stayUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Stay in ${stop.place.name}`}
            >
              <BedDouble size={16} aria-hidden />
            </a>
          )}
          <button
            type="button"
            className="trip-icon-btn"
            aria-label="Move to an earlier day"
            disabled={stopDay(stop) <= 1}
            onClick={() => moveTripStopDay(stop.placeKey, -1)}
          >
            <ChevronUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="trip-icon-btn"
            aria-label="Move to a later day"
            onClick={() => moveTripStopDay(stop.placeKey, 1)}
          >
            <ChevronDown size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="trip-icon-btn trip-icon-remove"
            aria-label={`Remove ${stop.place.name}`}
            onClick={() => removeFromTrip(stop.placeKey)}
          >
            <X size={16} aria-hidden />
          </button>
        </span>
      </div>
    </li>
  );
}

function ShareTripButton({ trip }: { trip: Trip }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?trip=${encodeTrip(trip)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, url });
        return;
      } catch {
        // user dismissed the share sheet - fall through to copy
      }
    }
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked (e.g. insecure context) - nothing more we can do
    }
  };
  return (
    <button type="button" className="trip-action" onClick={share}>
      <Share2 size={15} aria-hidden /> {copied ? 'Link copied' : 'Share'}
    </button>
  );
}

function ActiveTrip({ trip }: { trip: Trip }) {
  const renameActiveTrip = useAppStore((s) => s.renameActiveTrip);
  const optimizeTripOrder = useAppStore((s) => s.optimizeTripOrder);
  const deleteTrip = useAppStore((s) => s.deleteTrip);
  const currency = useAppStore((s) => s.currency);
  const system = useAppStore((s) => s.unitSystem);
  const { byKey, isLoading } = useTripPlan(trip);
  const { isBanned } = useBannedFilter();

  // Banned stops are hidden from the itinerary without renumbering days or
  // mutating the saved trip - un-banning brings them straight back.
  const ordered = orderedStops(trip).filter((stop) => !isBanned(stop.place));
  const dayCount = tripDayCount(trip);
  const dates = windowDates('week');

  // Leg distance from the previous stop in visiting order (origin for the first).
  const legByKey = new Map<string, number | null>();
  ordered.forEach((stop, i) => {
    const prev = i === 0 ? trip.origin : ordered[i - 1].place;
    legByKey.set(stop.placeKey, prev ? haversineKm(prev, stop.place) : null);
  });

  // Header total over the same visible (ban-filtered, origin-inclusive) chain
  // as the drive time below - identical to tripTotalKm when nothing is banned.
  const visibleTotalKm = ordered.reduce(
    (sum, stop) => sum + (legByKey.get(stop.placeKey) ?? 0),
    0,
  );

  // One routed request for the origin (when set) plus the whole stop chain,
  // so the drive-time total measures the same journey as tripTotalKm. Null
  // while loading / skipped / unroutable - legs keep the straight-line km.
  const stopCoords = ordered.map((s) => ({ lat: s.place.lat, lon: s.place.lon }));
  const driveChain = trip.origin
    ? [{ lat: trip.origin.lat, lon: trip.origin.lon }, ...stopCoords]
    : stopCoords;
  const { route: driveRoute } = useDriveRoute(driveChain.length >= 2 ? driveChain : null);
  // With an origin, legs[0] is origin→first stop, so each stop's incoming leg
  // is legs[i]; without one, the first stop has no leg and legs shift by one.
  const driveLegByKey = new Map<string, DriveLeg>();
  driveRoute?.legs.forEach((leg, i) => {
    const stop = trip.origin ? ordered[i] : ordered[i + 1];
    if (stop) driveLegByKey.set(stop.placeKey, leg);
  });

  // A stop's nights run from its scheduled day to the next stop's (last stop:
  // one night). A zero-night gap (next stop shares the day) makes the builder
  // throw, which quietly means "no stay link" for that stop.
  const stayUrlByKey = new Map<string, string>();
  ordered.forEach((stop, i) => {
    const insight = byKey.get(stop.placeKey);
    if (!insight) return;
    const checkIn = insight.plan.assignedDate;
    const next = ordered[i + 1] ? byKey.get(ordered[i + 1].placeKey) : undefined;
    const checkOut = next?.plan.assignedDate ?? addIsoDays(checkIn, 1);
    try {
      stayUrlByKey.set(
        stop.placeKey,
        buildBookingUrl({
          placeName: stop.place.name,
          countryName: countryDisplayName(stop.place),
          checkIn,
          checkOut,
          currency,
        }),
      );
    } catch {
      // zero-night gap or malformed dates - skip the link for this stop
    }
  });

  const canOptimize = trip.origin !== undefined && trip.stops.length >= 3;

  return (
    <section className="active-trip">
      <div className="trip-heading">
        <input
          key={trip.id}
          className="trip-name-input"
          defaultValue={trip.name}
          aria-label="Trip name"
          placeholder="Name this trip"
          onBlur={(e) => renameActiveTrip(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <p className="trip-meta">
          {trip.origin && <span>From {trip.origin.label}</span>}
          {trip.stops.length > 0 && (
            <>
              <span>
                {dayCount} {dayCount === 1 ? 'day' : 'days'}
              </span>
              <span>
                {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'}
              </span>
              <span>
                {formatDistance(visibleTotalKm, system)}
                {driveRoute ? ` · ${formatDriveTime(driveRoute.totalMinutes)} by car` : ''}
                {isLoading ? ' · planning…' : ''}
              </span>
            </>
          )}
        </p>
      </div>

      {trip.stops.length === 0 ? (
        <p className="trip-empty">
          No stops yet. Add places from the map, a search, or any place's detail - they land here.
          Use the arrows on a stop to spread it across days.
        </p>
      ) : (
        Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => {
          const dayStops = ordered.filter((s) => stopDay(s) === day);
          // A day left empty only by banned stops is skipped, but its number is
          // never reused - the surviving days keep their original Day N badges.
          if (dayStops.length === 0) return null;
          const headerDate = dates[Math.min(day - 1, dates.length - 1)];
          return (
            <div className="trip-day" key={day}>
              <div className="trip-day-head">
                <span className="trip-day-badge">Day {day}</span>
                <span className="trip-day-date">{dayLabel(headerDate)}</span>
                <span className="trip-day-count">
                  {dayStops.length} {dayStops.length === 1 ? 'stop' : 'stops'}
                </span>
              </div>
              <ol className="trip-stops">
                {dayStops.map((stop) => (
                  <TripStopRow
                    key={stop.placeKey}
                    stop={stop}
                    legKm={legByKey.get(stop.placeKey) ?? null}
                    driveLeg={driveLegByKey.get(stop.placeKey) ?? null}
                    insight={byKey.get(stop.placeKey)}
                    stayUrl={stayUrlByKey.get(stop.placeKey)}
                  />
                ))}
              </ol>
            </div>
          );
        })
      )}

      <div className="trip-footer">
        {canOptimize && (
          <button type="button" className="trip-action" onClick={optimizeTripOrder}>
            <Wand2 size={15} aria-hidden /> Optimize order
          </button>
        )}
        {trip.stops.length > 0 && <ShareTripButton trip={trip} />}
        <button
          type="button"
          className="trip-action trip-action-danger"
          onClick={() => deleteTrip(trip.id)}
        >
          <Trash2 size={15} aria-hidden /> Delete trip
        </button>
      </div>
    </section>
  );
}

export function TripsView() {
  const trips = useAppStore((s) => s.trips);
  const activeTripId = useAppStore((s) => s.activeTripId);
  const closeTrips = useAppStore((s) => s.closeTrips);
  const createTrip = useAppStore((s) => s.createTrip);
  const setActiveTrip = useAppStore((s) => s.setActiveTrip);

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;

  return (
    <div className="trips-view">
      <header className="panel-sticky-header">
        <button type="button" className="back-button" onClick={closeTrips}>
          <ChevronLeft size={16} aria-hidden /> Back
        </button>
        <h2 className="trips-title">
          <Route size={20} strokeWidth={2.2} aria-hidden /> Trips
        </h2>
      </header>

      {trips.length === 0 ? (
        <div className="trips-empty">
          <p>Plan a sunny route. Collect places into a trip and see the whole itinerary - which day, when the sun's up, how far between stops.</p>
          <button type="button" className="trip-action trip-action-primary" onClick={() => createTrip()}>
            <Plus size={15} aria-hidden /> New trip
          </button>
        </div>
      ) : (
        <>
          <div className="trip-chips" role="tablist" aria-label="Your trips">
            {trips.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === activeTripId}
                className={`trip-chip${t.id === activeTripId ? ' is-active' : ''}`}
                onClick={() => setActiveTrip(t.id)}
              >
                {t.name}
                <span className="trip-chip-count">{t.stops.length}</span>
              </button>
            ))}
            <button
              type="button"
              className="trip-chip trip-chip-new"
              aria-label="New trip"
              onClick={() => createTrip()}
            >
              <Plus size={15} aria-hidden />
            </button>
          </div>
          {activeTrip && <ActiveTrip trip={activeTrip} />}
        </>
      )}
    </div>
  );
}
