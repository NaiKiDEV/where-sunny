import { Cloud, CloudRain, Sun, Thermometer, type LucideIcon } from 'lucide-react';
import { explainScore, type ScorePart } from '../../core/scoring/explain';
import type { ScoredDay } from '../../core/types';
import { formatSunHours, formatTemp } from '../../lib/format';
import { scoreWord } from '../../lib/scoreLabel';
import { useAppStore } from '../../state/store';

const PART_META: Record<ScorePart['id'], { label: string; Icon: LucideIcon; barClass: string }> = {
  sun: { label: 'Sunshine', Icon: Sun, barClass: 'breakdown-bar-sun' },
  warmth: { label: 'Warmth', Icon: Thermometer, barClass: 'breakdown-bar-warmth' },
  cloud: { label: 'Clouds', Icon: Cloud, barClass: 'breakdown-bar-cloud' },
  rain: { label: 'Rain risk', Icon: CloudRain, barClass: 'breakdown-bar-rain' },
};

function partDetail(id: ScorePart['id'], day: ScoredDay, idealMin: number, idealMax: number): string {
  switch (id) {
    case 'sun':
      return `${formatSunHours(day.sunshineDuration)} of ${formatSunHours(day.daylightDuration)} daylight`;
    case 'warmth': {
      const temp = formatTemp(day.tempMax);
      if (day.tempMax < idealMin) return `${temp} - cooler than your ${idealMin}–${idealMax}° zone`;
      if (day.tempMax > idealMax) return `${temp} - hotter than your ${idealMin}–${idealMax}° zone`;
      return `${temp} - in your comfort zone`;
    }
    case 'cloud':
      return `${Math.round(day.cloudCoverMean)}% average cover`;
    case 'rain':
      return `${Math.round(day.precipProbMax)}% chance of rain`;
  }
}

/**
 * The score receipt: every factor of the exact formula as points with a bar,
 * so the number is never a black box.
 */
export function ScoreBreakdown({ day }: { day: ScoredDay }) {
  const comfort = useAppStore((s) => s.comfort);
  const breakdown = explainScore(day, comfort);

  return (
    <div className="breakdown">
      <div className="breakdown-head">
        <span className="breakdown-title">Why {breakdown.score}?</span>
        <span className="breakdown-word">{scoreWord(breakdown.score)}</span>
      </div>
      <div className="breakdown-rows">
        {breakdown.parts.map((part) => {
          const meta = PART_META[part.id];
          const fill = part.maxPoints === 0 ? 0 : Math.abs(part.points / part.maxPoints);
          return (
            <div key={part.id} className="breakdown-row">
              <span className="breakdown-icon" aria-hidden>
                <meta.Icon size={17} strokeWidth={2} />
              </span>
              <span className="breakdown-body">
                <span className="breakdown-row-head">
                  <span className="breakdown-label">{meta.label}</span>
                  <span className={`breakdown-points${part.points < 0 ? ' is-negative' : ''}`}>
                    {part.points > 0 ? `+${part.points}` : part.points}
                  </span>
                </span>
                <span className="breakdown-track">
                  <span
                    className={`breakdown-bar ${meta.barClass}`}
                    style={{ width: `${Math.round(fill * 100)}%` }}
                  />
                </span>
                <span className="breakdown-detail">{partDetail(part.id, day, comfort.idealMin, comfort.idealMax)}</span>
              </span>
            </div>
          );
        })}
      </div>
      {breakdown.isCapped && (
        <p className="breakdown-capped">
          Penalties outweigh everything the day offers - the score bottoms out at 0.
        </p>
      )}
    </div>
  );
}
