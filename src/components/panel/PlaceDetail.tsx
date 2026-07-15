import { useState } from 'react';
import { ChevronLeft, MapPin, Navigation, Route, Star } from 'lucide-react';
import type { ScoredDay, ScoredPlace } from '../../core/types';
import { isNotableTerrain, terrainOf, TERRAIN_LABEL } from '../../core/candidates/feature';
import { usePlaceForecast } from '../../hooks/usePlaceForecast';
import { usePlaceInsight } from '../../hooks/usePlaceInsight';
import {
  countryFlag,
  dayLabel,
  dayOfMonth,
  describeWeather,
  directionsUrl,
  formatDistance,
  formatElevation,
  formatSunHours,
  formatTemp,
  formatTempBare,
  formatWind,
  shortDayLabel,
  type TempUnit,
  uvBand,
} from '../../lib/format';
import { scoreColor, scoreTextColor } from '../../lib/scoreColor';
import { scoreWord } from '../../lib/scoreLabel';
import { weatherVisual } from '../../lib/weatherIcon';
import { useAppStore } from '../../state/store';
import { FlightLinks } from '../flights/FlightLinks';
import { AboutPlace } from './AboutPlace';
import { AirQualityNote } from './AirQualityNote';
import { AnomalyNote } from './AnomalyNote';
import { CalendarNote } from './CalendarNote';
import { ClimateProfile } from './ClimateProfile';
import { ConsensusBlock } from './ConsensusBlock';
import { NearbyPoi } from './NearbyPoi';
import { NightSkyNote } from './NightSkyNote';
import { OutlookStrip } from './OutlookStrip';
import { PracticalInfo } from './PracticalInfo';
import { ScoreBreakdown } from './ScoreBreakdown';
import { SeaConditions } from './SeaConditions';
import { SharePlaceButton } from './SharePlaceButton';
import { SnowNote } from './SnowNote';
import { SunTimeline } from './SunTimeline';

function DayChip({
  day,
  unit,
  isActive,
  isInWindow,
  onClick,
}: {
  day: ScoredDay;
  unit: TempUnit;
  isActive: boolean;
  isInWindow: boolean;
  onClick: () => void;
}) {
  const { Icon, color } = weatherVisual(day.weatherCode);
  return (
    <button
      type="button"
      className={`day-chip${isActive ? ' is-active' : ''}${isInWindow ? ' is-window' : ''}`}
      onClick={onClick}
    >
      <span className="day-chip-label">
        {shortDayLabel(day.date)}{' '}
        <span className="day-chip-date">{dayOfMonth(day.date)}</span>
      </span>
      <Icon size={18} strokeWidth={2} color={color} aria-hidden />
      <span className="day-chip-dot" style={{ background: scoreColor(day.score) }} />
      <span className="day-chip-temp">{formatTemp(day.tempMax, unit)}</span>
    </button>
  );
}

export function PlaceDetail({ scored }: { scored: ScoredPlace }) {
  const closeDetail = useAppStore((s) => s.closeDetail);
  const setOrigin = useAppStore((s) => s.setOrigin);
  const unit = useAppStore((s) => s.unit);
  const pinned = useAppStore((s) => s.pinned);
  const addPin = useAppStore((s) => s.addPin);
  const removePin = useAppStore((s) => s.removePin);
  const trips = useAppStore((s) => s.trips);
  const activeTripId = useAppStore((s) => s.activeTripId);
  const addToTrip = useAppStore((s) => s.addToTrip);
  const removeFromTrip = useAppStore((s) => s.removeFromTrip);

  const [activeDate, setActiveDate] = useState(scored.best.date);
  const day = scored.days.find((d) => d.date === activeDate) ?? scored.best;
  const weatherLabel = describeWeather(day.weatherCode);
  const { Icon: WeatherGlyph, color: weatherColor } = weatherVisual(day.weatherCode);
  const windowDates = new Set(scored.windowDays.map((d) => d.date));

  const insight = usePlaceInsight(scored.place);
  const extended = usePlaceForecast(scored.place);
  const consensus = insight.consensusByDate.get(day.date);
  const hours = insight.hoursByDate.get(day.date) ?? [];

  const { place } = scored;
  const terrain = terrainOf(place.elevation);
  const elevationText =
    place.elevation === undefined
      ? null
      : `${isNotableTerrain(terrain) ? `${TERRAIN_LABEL[terrain]} · ` : ''}${formatElevation(place.elevation)}`;
  const isHome = place.kind === 'home';
  const pinKey = place.kind === 'pin' ? place.key : `p:${place.key}`;
  const isPinned = pinned.some((p) => p.key === pinKey);

  const togglePin = () => {
    if (isPinned) {
      removePin(pinKey);
    } else {
      addPin({ ...place, kind: 'pin', key: pinKey });
    }
  };

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;
  const inTrip = activeTrip?.stops.some((s) => s.placeKey === place.key) ?? false;
  const toggleTrip = () => (inTrip ? removeFromTrip(place.key) : addToTrip(place));

  const startFromHere = () => setOrigin({ lat: place.lat, lon: place.lon, label: place.name });

  return (
    <div className="place-detail">
      <header className="panel-sticky-header">
        <button type="button" className="back-button" onClick={closeDetail}>
          <ChevronLeft size={16} aria-hidden /> Back
        </button>

        <div className="place-detail-title">
          <div className="place-detail-title-text">
            <h2 className="place-detail-name">
              {place.name} <span className="place-flag">{countryFlag(place.country)}</span>
            </h2>
            <p className="place-detail-sub">
              {isHome ? 'Your starting point' : `${formatDistance(scored.distanceKm)} away`} · best on{' '}
              {dayLabel(scored.best.date)}
              {elevationText && ` · ${elevationText}`}
            </p>
          </div>
          <span className="score-badge-stack">
            <span
              className="score-badge score-badge-lg"
              style={{ background: scoreColor(scored.score), color: scoreTextColor(scored.score) }}
            >
              {scored.score}
            </span>
            <span className="score-word">{scoreWord(scored.score)}</span>
          </span>
        </div>

        {!isHome && (
          <div className="place-detail-actions">
            <button
              type="button"
              className={`trip-toggle${inTrip ? ' is-in-trip' : ''}`}
              onClick={toggleTrip}
            >
              <Route size={15} strokeWidth={2} aria-hidden />
              {inTrip ? 'In trip' : 'Add to trip'}
            </button>
            <button
              type="button"
              className={`pin-toggle pin-toggle-detail${isPinned ? ' is-pinned' : ''}`}
              onClick={togglePin}
            >
              <Star size={15} strokeWidth={2} fill={isPinned ? 'currentColor' : 'none'} aria-hidden />
              {isPinned ? 'Watching' : 'Watch'}
            </button>
            <SharePlaceButton place={place} />
          </div>
        )}
      </header>

      {place.airport && (
        <div className="airport-info">
          <div className="airport-codes">
            {place.airport.iata && <span className="airport-code">{place.airport.iata}</span>}
            {place.airport.icao && (
              <span className="airport-code airport-code-secondary">{place.airport.icao}</span>
            )}
            {place.airport.municipality && (
              <span className="airport-serves">Serves {place.airport.municipality}</span>
            )}
          </div>
          {(place.airport.runways || place.airport.longestRunwayM) && (
            <p className="airport-facts">
              {place.airport.runways
                ? `${place.airport.runways} runway${place.airport.runways > 1 ? 's' : ''}`
                : ''}
              {place.airport.runways && place.airport.longestRunwayM ? ' · ' : ''}
              {place.airport.longestRunwayM
                ? `longest ${place.airport.longestRunwayM.toLocaleString()} m`
                : ''}
            </p>
          )}
          {(place.airport.home || place.airport.wiki) && (
            <div className="airport-links">
              {place.airport.home && (
                <a
                  className="airport-link"
                  href={place.airport.home}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official site ↗
                </a>
              )}
              {place.airport.wiki && (
                <a
                  className="airport-link"
                  href={place.airport.wiki}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Wikipedia ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="day-strip" role="tablist" aria-label="Forecast days">
        {scored.days.map((d) => (
          <DayChip
            key={d.date}
            day={d}
            unit={unit}
            isActive={d.date === day.date}
            isInWindow={windowDates.has(d.date)}
            onClick={() => setActiveDate(d.date)}
          />
        ))}
      </div>

      <OutlookStrip
        forecast={extended.forecast}
        afterDate={scored.days[scored.days.length - 1]?.date}
      />

      <div className="day-stats">
        <div className="day-stats-headline">
          <span className="day-stats-icon" aria-hidden>
            <WeatherGlyph size={22} strokeWidth={2} color={weatherColor} />
          </span>
          <span>
            {weatherLabel} · {dayLabel(day.date)}
          </span>
        </div>
        {insight.isLoadingHours ? (
          <p className="sun-timeline-note">Loading hour-by-hour…</p>
        ) : hours.length > 0 ? (
          <SunTimeline hours={hours} />
        ) : (
          <p className="sun-timeline-note">
            {insight.isHoursError
              ? 'Hour-by-hour forecast is unavailable right now - try again shortly.'
              : 'No hourly forecast for this day.'}
          </p>
        )}
        <div className="day-conditions">
          <NightSkyNote hoursByDate={insight.hoursByDate} date={day.date} coords={place} />
          <SnowNote days={extended.forecast?.days ?? []} place={place} activeDate={day.date} />
        </div>
        <dl className="day-stats-grid">
          <div>
            <dt>Sunshine</dt>
            <dd>{formatSunHours(day.sunshineDuration)}</dd>
          </div>
          <div>
            <dt>Cloud cover</dt>
            <dd>{Math.round(day.cloudCoverMean)}%</dd>
          </div>
          <div>
            <dt>Rain chance</dt>
            <dd>{Math.round(day.precipProbMax)}%</dd>
          </div>
          <div>
            <dt>Temperature</dt>
            <dd>
              {formatTempBare(day.tempMin, unit)} – {formatTemp(day.tempMax, unit)}
            </dd>
          </div>
          {day.apparentTempMax !== undefined && (
            <div>
              <dt>Feels like</dt>
              <dd>{formatTemp(day.apparentTempMax, unit)}</dd>
            </div>
          )}
          {day.uvIndexMax !== undefined && (
            <div>
              <dt>UV index</dt>
              <dd>
                {Math.round(day.uvIndexMax)} · {uvBand(day.uvIndexMax)}
              </dd>
            </div>
          )}
          {day.windMax !== undefined && (
            <div>
              <dt>Wind</dt>
              <dd>{formatWind(day.windMax)}</dd>
            </div>
          )}
        </dl>
      </div>

      <SeaConditions place={place} activeDate={day.date} unit={unit} />

      <ScoreBreakdown day={day} />

      <AirQualityNote
        coords={place}
        activeDate={day.date}
        windowDates={scored.windowDays.map((d) => d.date)}
      />

      <AnomalyNote coords={place} date={day.date} forecastTmax={day.tempMax} />

      {!isHome && (
        <CalendarNote
          place={place}
          activeDate={day.date}
          windowDates={scored.windowDays.map((d) => d.date)}
        />
      )}

      <ConsensusBlock consensus={consensus} isLoading={insight.isLoadingConsensus} />

      <AboutPlace place={place} />

      {place.kind !== 'airport' && <NearbyPoi coords={place} />}

      <ClimateProfile coords={place} />

      <PracticalInfo place={place} timezone={extended.forecast?.timezone} />

      {!isHome && <FlightLinks place={place} date={day.date} />}

      {!isHome && (
        <div className="detail-actions">
          <a
            className="directions-link"
            href={directionsUrl(place.lat, place.lon)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={15} aria-hidden /> Directions
          </a>
          <button type="button" className="detail-action-secondary" onClick={startFromHere}>
            <MapPin size={15} aria-hidden /> Start from here
          </button>
        </div>
      )}
    </div>
  );
}
