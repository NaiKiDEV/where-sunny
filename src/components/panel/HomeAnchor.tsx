import type { ScoredPlace } from '../../core/types';
import { formatSunHours } from '../../lib/format';
import { scoreColor, scoreTextColor } from '../../lib/scoreColor';
import { scoreWord } from '../../lib/scoreLabel';

const WORTH_THE_TRIP_DELTA = 15;
const GREAT_AT_HOME = 80;

function verdict(home: ScoredPlace, best: ScoredPlace | null): string {
  if (!best || best.place.key === home.place.key) return 'This is the sunniest spot around.';
  const delta = best.score - home.score;
  if (home.score >= GREAT_AT_HOME && delta < WORTH_THE_TRIP_DELTA) {
    return 'Gorgeous right here - no need to go anywhere.';
  }
  if (delta >= WORTH_THE_TRIP_DELTA) {
    return `${best.place.name} beats staying put by +${delta}. Worth the trip.`;
  }
  return 'Nowhere nearby is meaningfully sunnier. Enjoy it here.';
}

export function HomeAnchor({ home, best }: { home: ScoredPlace; best: ScoredPlace | null }) {
  return (
    <div className="home-anchor">
      <div className="home-anchor-row">
        <span
          className="score-badge"
          style={{ background: scoreColor(home.score), color: scoreTextColor(home.score) }}
        >
          {home.score}
        </span>
        <div className="home-anchor-text">
          <span className="home-anchor-title">{home.place.name}</span>
          <span className="home-anchor-meta">
            {scoreWord(home.score)} · {formatSunHours(home.best.sunshineDuration)} of sun · staying put
          </span>
        </div>
      </div>
      <p className="home-anchor-verdict">{verdict(home, best)}</p>
    </div>
  );
}
