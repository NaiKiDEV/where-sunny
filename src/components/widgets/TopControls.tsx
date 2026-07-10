import { TIER_ORDER, TRAVEL_TIERS } from '../../core/candidates/tiers';
import { TIME_WINDOWS } from '../../core/scoring/window';
import { useAppStore } from '../../state/store';
import { ComfortControl } from './ComfortControl';
import { Segmented } from './Segmented';

const TIER_OPTIONS = TIER_ORDER.map((id) => ({ id, label: TRAVEL_TIERS[id].label }));

export function TopControls({ isFetching }: { isFetching: boolean }) {
  const origin = useAppStore((s) => s.origin);
  const tier = useAppStore((s) => s.tier);
  const timeWindow = useAppStore((s) => s.timeWindow);
  const setTier = useAppStore((s) => s.setTier);
  const setTimeWindow = useAppStore((s) => s.setTimeWindow);
  const openSearch = useAppStore((s) => s.openSearch);

  return (
    <header className="top-controls">
      <div className="top-controls-row">
        <button type="button" className="location-chip" onClick={() => openSearch('origin')}>
          <span className="location-chip-icon" aria-hidden>
            ☀️
          </span>
          <span className="location-chip-label">{origin?.label ?? 'Set location'}</span>
          <span className="location-chip-caret" aria-hidden>
            ▾
          </span>
        </button>
        {isFetching && <span className="fetch-hint">Updating…</span>}
      </div>
      <div className="top-controls-row top-controls-scroll">
        <Segmented options={TIME_WINDOWS} value={timeWindow} onChange={setTimeWindow} ariaLabel="Time window" />
        <Segmented options={TIER_OPTIONS} value={tier} onChange={setTier} ariaLabel="Travel range" />
        <ComfortControl />
      </div>
    </header>
  );
}
