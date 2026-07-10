import { TIER_ORDER, TRAVEL_TIERS } from '../../core/candidates/tiers';
import { TIME_WINDOWS } from '../../core/scoring/window';
import { useAppStore } from '../../state/store';
import { ComfortControl } from './ComfortControl';
import { Segmented } from './Segmented';

const TIER_OPTIONS = TIER_ORDER.map((id) => ({ id, label: TRAVEL_TIERS[id].label }));

/** The origin picker chip — always shown, floats over the map on every layout. */
export function LocationChip({ isFetching }: { isFetching: boolean }) {
  const origin = useAppStore((s) => s.origin);
  const openSearch = useAppStore((s) => s.openSearch);

  return (
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
  );
}

/** Day / travel-range / comfort filters. Reused floating (desktop) and inside the drawer (mobile). */
export function FilterControls() {
  const tier = useAppStore((s) => s.tier);
  const timeWindow = useAppStore((s) => s.timeWindow);
  const setTier = useAppStore((s) => s.setTier);
  const setTimeWindow = useAppStore((s) => s.setTimeWindow);

  return (
    <>
      <Segmented options={TIME_WINDOWS} value={timeWindow} onChange={setTimeWindow} ariaLabel="When" />
      <Segmented options={TIER_OPTIONS} value={tier} onChange={setTier} ariaLabel="How far" />
      <ComfortControl />
    </>
  );
}

/** Desktop control cluster floating over the map. */
export function TopControls({ isFetching }: { isFetching: boolean }) {
  return (
    <header className="top-controls">
      <LocationChip isFetching={isFetching} />
      <div className="top-controls-row top-controls-scroll">
        <FilterControls />
      </div>
    </header>
  );
}
