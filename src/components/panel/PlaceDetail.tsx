import { useState } from 'react';
import type { ScoredDay, ScoredPlace } from '../../core/types';
import { usePlaceInsight } from '../../hooks/usePlaceInsight';
import {
  countryFlag,
  dayLabel,
  describeWeather,
  directionsUrl,
  formatDistance,
  formatSunHours,
  formatTemp,
} from '../../lib/format';
import { scoreColor, scoreTextColor } from '../../lib/scoreColor';
import { scoreWord } from '../../lib/scoreLabel';
import { useAppStore } from '../../state/store';
import { ConsensusBlock } from './ConsensusBlock';
import { ScoreBreakdown } from './ScoreBreakdown';
import { SunTimeline } from './SunTimeline';

function DayChip({
  day,
  isActive,
  isInWindow,
  onClick,
}: {
  day: ScoredDay;
  isActive: boolean;
  isInWindow: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`day-chip${isActive ? ' is-active' : ''}${isInWindow ? ' is-window' : ''}`}
      onClick={onClick}
    >
      <span className="day-chip-label">{dayLabel(day.date)}</span>
      <span className="day-chip-dot" style={{ background: scoreColor(day.score) }} />
      <span className="day-chip-temp">{formatTemp(day.tempMax)}</span>
    </button>
  );
}

export function PlaceDetail({ scored }: { scored: ScoredPlace }) {
  const selectPlace = useAppStore((s) => s.selectPlace);
  const pinned = useAppStore((s) => s.pinned);
  const addPin = useAppStore((s) => s.addPin);
  const removePin = useAppStore((s) => s.removePin);

  const [activeDate, setActiveDate] = useState(scored.best.date);
  const day = scored.days.find((d) => d.date === activeDate) ?? scored.best;
  const weather = describeWeather(day.weatherCode);
  const windowDates = new Set(scored.windowDays.map((d) => d.date));

  const insight = usePlaceInsight(scored.place);
  const consensus = insight.consensusByDate.get(day.date);
  const hours = insight.hoursByDate.get(day.date) ?? [];

  const { place } = scored;
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

  return (
    <div className="place-detail">
      <header className="place-detail-header">
        <button type="button" className="back-button" onClick={() => selectPlace(null)}>
          ‹ Back
        </button>
        <div className="place-detail-header-actions">
          {!isHome && (
            <button
              type="button"
              className={`pin-toggle pin-toggle-detail${isPinned ? ' is-pinned' : ''}`}
              onClick={togglePin}
            >
              {isPinned ? '★ Watching' : '☆ Watch'}
            </button>
          )}
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
      </header>

      <h2 className="place-detail-name">
        {place.name} <span className="place-flag">{countryFlag(place.country)}</span>
      </h2>
      <p className="place-detail-sub">
        {isHome ? 'Your starting point' : `${formatDistance(scored.distanceKm)} away`} · best on{' '}
        {dayLabel(scored.best.date)}
      </p>

      <div className="day-strip" role="tablist" aria-label="Forecast days">
        {scored.days.map((d) => (
          <DayChip
            key={d.date}
            day={d}
            isActive={d.date === day.date}
            isInWindow={windowDates.has(d.date)}
            onClick={() => setActiveDate(d.date)}
          />
        ))}
      </div>

      <div className="day-stats">
        <div className="day-stats-headline">
          <span className="day-stats-emoji" aria-hidden>
            {weather.emoji}
          </span>
          <span>
            {weather.label} · {dayLabel(day.date)}
          </span>
        </div>
        {insight.isLoadingHours ? (
          <p className="sun-timeline-note">Loading hour-by-hour…</p>
        ) : hours.length > 0 ? (
          <SunTimeline hours={hours} />
        ) : (
          <p className="sun-timeline-note">
            {insight.isHoursError
              ? 'Hour-by-hour forecast is unavailable right now — try again shortly.'
              : 'No hourly forecast for this day.'}
          </p>
        )}
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
              {formatTemp(day.tempMin)} – {formatTemp(day.tempMax)}
            </dd>
          </div>
        </dl>
      </div>

      <ScoreBreakdown day={day} />

      <ConsensusBlock consensus={consensus} isLoading={insight.isLoadingConsensus} />

      {!isHome && (
        <a
          className="directions-link"
          href={directionsUrl(place.lat, place.lon)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Directions →
        </a>
      )}
    </div>
  );
}
