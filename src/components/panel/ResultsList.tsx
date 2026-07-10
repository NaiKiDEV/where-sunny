import { useState } from 'react';
import type { ScoredPlace } from '../../core/types';
import { TRAVEL_TIERS } from '../../core/candidates/tiers';
import { useAppStore } from '../../state/store';
import { HomeAnchor } from './HomeAnchor';
import { PlaceCard } from './PlaceCard';

const DIM_RANGE_SCORE = 35;
// Show a focused shortlist first; the long tail is one tap away. A 220-item
// list is overwhelming and, in the mobile drawer, near-impossible to scroll.
const SHORTLIST_LIMIT = 20;

interface ResultsListProps {
  results: ScoredPlace[];
  pinnedScored: ScoredPlace[];
  home: ScoredPlace | null;
  isLoading: boolean;
  error: Error | null;
}

function LoadingSkeleton() {
  return (
    <div className="results-skeleton" aria-label="Loading forecasts">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

function DimRangeHint({ tier }: { tier: string }) {
  const setTier = useAppStore((s) => s.setTier);
  const setTimeWindow = useAppStore((s) => s.setTimeWindow);
  if (tier === 'flight') {
    return (
      <div className="dim-hint">
        Not much sun anywhere in reach right now —{' '}
        <button type="button" className="dim-hint-action" onClick={() => setTimeWindow('week')}>
          check the next 7 days
        </button>
        .
      </div>
    );
  }
  const nextTier = tier === 'nearby' ? 'day' : tier === 'day' ? 'getaway' : 'flight';
  return (
    <div className="dim-hint">
      Not much sun in this range —{' '}
      <button type="button" className="dim-hint-action" onClick={() => setTier(nextTier)}>
        try {TRAVEL_TIERS[nextTier].label}
      </button>{' '}
      or{' '}
      <button type="button" className="dim-hint-action" onClick={() => setTimeWindow('week')}>
        the next 7 days
      </button>
      .
    </div>
  );
}

export function ResultsList({ results, pinnedScored, home, isLoading, error }: ResultsListProps) {
  const tier = useAppStore((s) => s.tier);
  const openSearch = useAppStore((s) => s.openSearch);
  const pinned = useAppStore((s) => s.pinned);
  const hasPins = pinnedScored.length > 0;
  const [showAll, setShowAll] = useState(false);

  // A watched city already shows under Interests — don't list it twice.
  const pinnedKeys = new Set(pinned.map((p) => p.key));
  const rangeResults = results.filter((s) => !pinnedKeys.has(`p:${s.place.key}`));
  const visibleResults = showAll ? rangeResults : rangeResults.slice(0, SHORTLIST_LIMIT);
  const hiddenCount = rangeResults.length - visibleResults.length;

  if (error) {
    return (
      <div className="panel-message" role="alert">
        <strong>Couldn't load forecasts.</strong>
        <p>{error.message}</p>
        <p className="panel-message-hint">Check your connection — results refresh automatically.</p>
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  const isDimRange = rangeResults.length > 0 && rangeResults[0].score < DIM_RANGE_SCORE;

  return (
    <div className="results-list">
      {home && <HomeAnchor home={home} best={results[0] ?? null} />}

      <div className="section-header">
        <span className="section-title">Interests</span>
        <button type="button" className="section-action" onClick={() => openSearch('explore')}>
          ☆ Watch a place
        </button>
      </div>
      {hasPins && (
        <ol className="place-list place-list-pins">
          {pinnedScored.map((scored) => (
            <PlaceCard key={scored.place.key} scored={scored} />
          ))}
        </ol>
      )}

      <div className="section-header">
        <span className="section-title">Sunniest in range</span>
        {rangeResults.length > 0 && <span className="section-count">{rangeResults.length}</span>}
      </div>
      {isDimRange && <DimRangeHint tier={tier} />}
      {rangeResults.length === 0 ? (
        <div className="panel-message">
          <strong>No places found in this range.</strong>
          <p>Try a wider travel range — or a different starting point.</p>
        </div>
      ) : (
        <>
          <ol className="place-list">
            {visibleResults.map((scored, index) => (
              <PlaceCard key={scored.place.key} scored={scored} rank={index + 1} />
            ))}
          </ol>
          {hiddenCount > 0 && (
            <button type="button" className="show-more" onClick={() => setShowAll(true)}>
              Show {hiddenCount} more {hiddenCount === 1 ? 'place' : 'places'}
            </button>
          )}
          {showAll && rangeResults.length > SHORTLIST_LIMIT && (
            <button type="button" className="show-more show-more-collapse" onClick={() => setShowAll(false)}>
              Show fewer
            </button>
          )}
        </>
      )}
    </div>
  );
}
