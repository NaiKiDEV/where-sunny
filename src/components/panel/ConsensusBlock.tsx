import type { DayConsensus } from '../../core/scoring/consensus';
import { scoreColor } from '../../lib/scoreColor';

const LEVEL_TEXT = {
  high: { label: 'Models agree', hint: 'Independent forecasts point the same way - plan on it.' },
  medium: { label: 'Some spread', hint: 'Forecast models differ a bit - check again closer to the day.' },
  low: { label: 'Models disagree', hint: 'Forecasts genuinely conflict here - treat any single one with caution.' },
} as const;

/**
 * Cross-checks the day's sun score against independent weather models
 * (ECMWF, GFS, ICON). When your local provider tells a different story,
 * this shows whether ANY forecast deserves confidence right now.
 */
export function ConsensusBlock({ consensus, isLoading }: { consensus?: DayConsensus; isLoading: boolean }) {
  if (isLoading) {
    return <div className="consensus consensus-loading">Checking forecast models…</div>;
  }
  if (!consensus || consensus.scores.length < 2) return null;

  const text = LEVEL_TEXT[consensus.level];
  return (
    <div className="consensus">
      <div className="consensus-head">
        <span className={`consensus-level consensus-level-${consensus.level}`}>{text.label}</span>
        <span className="consensus-range">
          {consensus.min === consensus.max ? `score ${consensus.min}` : `score ${consensus.min}–${consensus.max}`}
        </span>
      </div>
      <div className="consensus-models">
        {consensus.scores.map((s) => (
          <span key={s.model} className="consensus-model">
            <span className="consensus-dot" style={{ background: scoreColor(s.score) }} />
            {s.label} {s.score}
          </span>
        ))}
      </div>
      <p className="consensus-hint">{text.hint}</p>
    </div>
  );
}
