import { Star } from 'lucide-react';
import type { ScoredPlace } from '../../core/types';
import { countryFlag, dayLabel, formatDistance, formatSunHours, formatTemp } from '../../lib/format';
import { scoreColor, scoreTextColor } from '../../lib/scoreColor';
import { scoreWord } from '../../lib/scoreLabel';
import { useAppStore } from '../../state/store';

interface PlaceCardProps {
  scored: ScoredPlace;
  /** Position in the ranked list; omitted for pinned places (shown with a star). */
  rank?: number;
}

export function PlaceCard({ scored, rank }: PlaceCardProps) {
  const selectPlace = useAppStore((s) => s.selectPlace);
  const { place, best, distanceKm, score } = scored;

  return (
    <li className="place-card-item">
      <button type="button" className="place-card" onClick={() => selectPlace(place.key)}>
        <span className={`place-rank${rank === undefined ? ' place-rank-pin' : ''}`}>
          {rank === undefined ? <Star size={14} strokeWidth={0} fill="currentColor" aria-hidden /> : rank}
        </span>
        <span className="place-card-body">
          <span className="place-name">
            {place.name} <span className="place-flag">{countryFlag(place.country)}</span>
          </span>
          <span className="place-meta">
            {dayLabel(best.date)} · {formatSunHours(best.sunshineDuration)} sun ·{' '}
            {formatTemp(best.tempMax)} · {formatDistance(distanceKm)}
          </span>
        </span>
        <span
          className="score-badge"
          style={{ background: scoreColor(score), color: scoreTextColor(score) }}
          title={`${score} - ${scoreWord(score)}`}
          aria-label={`Sun score ${score}, ${scoreWord(score)}`}
        >
          {score}
        </span>
      </button>
    </li>
  );
}
