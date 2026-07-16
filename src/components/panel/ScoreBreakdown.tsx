import { HelpCircle } from 'lucide-react';
import { explainScore, type ScorePart } from '../../core/scoring/explain';
import { comfortTemp } from '../../core/scoring/score';
import type { ScoredDay } from '../../core/types';
import {
  formatSunHours,
  formatTemp,
  formatTempBare,
  formatWind,
  type TempUnit,
  type UnitSystem,
} from '../../lib/format';
import { scoreWord } from '../../lib/scoreLabel';
import { useAppStore } from '../../state/store';
import { SCORE_PART_META } from './scoreParts';

function partDetail(
  id: ScorePart['id'],
  day: ScoredDay,
  idealMin: number,
  idealMax: number,
  unit: TempUnit,
  system: UnitSystem,
): string {
  switch (id) {
    case 'sun':
      return `${formatSunHours(day.sunshineDuration)} of ${formatSunHours(day.daylightDuration)} daylight`;
    case 'warmth': {
      const felt = comfortTemp(day);
      const temp = formatTemp(felt, unit);
      const feelsNote = day.apparentTempMax === undefined ? '' : ' feels-like';
      const zone = `${formatTempBare(idealMin, unit)}–${formatTempBare(idealMax, unit)}`;
      if (felt < idealMin) return `${temp}${feelsNote} - cooler than your ${zone} zone`;
      if (felt > idealMax) return `${temp}${feelsNote} - hotter than your ${zone} zone`;
      return `${temp}${feelsNote} - in your comfort zone`;
    }
    case 'cloud':
      return `${Math.round(day.cloudCoverMean)}% average cover`;
    case 'rain':
      return `${Math.round(day.precipProbMax)}% chance of rain`;
    case 'wind':
      return day.windMax === undefined ? '' : `${formatWind(day.windMax, system)} peak wind`;
  }
}

/**
 * The score receipt: every factor of the exact formula as points with a bar,
 * so the number is never a black box.
 */
export function ScoreBreakdown({ day }: { day: ScoredDay }) {
  const comfort = useAppStore((s) => s.comfort);
  const unit = useAppStore((s) => s.unit);
  const system = useAppStore((s) => s.unitSystem);
  const openScoreInfo = useAppStore((s) => s.openScoreInfo);
  const breakdown = explainScore(day, comfort);

  return (
    <div className="breakdown">
      <div className="breakdown-head">
        <span className="breakdown-title">Why {breakdown.score}?</span>
        <span className="breakdown-word">{scoreWord(breakdown.score)}</span>
      </div>
      <div className="breakdown-rows">
        {breakdown.parts.map((part) => {
          const meta = SCORE_PART_META[part.id];
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
                <span className="breakdown-detail">{partDetail(part.id, day, comfort.idealMin, comfort.idealMax, unit, system)}</span>
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
      <button type="button" className="breakdown-explain" onClick={openScoreInfo}>
        <HelpCircle size={14} strokeWidth={2} aria-hidden />
        How the Sunny Score works
      </button>
    </div>
  );
}
