import { useState } from 'react';
import { ChevronDown, MapPin, Search, Sun } from 'lucide-react';
import { TIER_ORDER, TRAVEL_TIERS } from '../../core/candidates/tiers';
import { TIME_WINDOWS } from '../../core/scoring/window';
import { useAppStore } from '../../state/store';
import { ComfortControl } from './ComfortControl';
import { Segmented } from './Segmented';

const TIER_OPTIONS = TIER_ORDER.map((id) => ({ id, label: TRAVEL_TIERS[id].label }));

/**
 * The origin chip doubles as an action menu: it names your starting point and,
 * on tap, opens location actions. Room to grow as more actions land here.
 */
function LocationMenu() {
  const origin = useAppStore((s) => s.origin);
  const openSearch = useAppStore((s) => s.openSearch);
  const selectPlace = useAppStore((s) => s.selectPlace);
  const [isOpen, setOpen] = useState(false);

  return (
    <div className="location-menu">
      <button
        type="button"
        className="location-chip"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setOpen((v) => !v)}
      >
        <Sun className="location-chip-icon" size={16} strokeWidth={2.2} aria-hidden />
        <span className="location-chip-label">{origin?.label ?? 'Set location'}</span>
        <ChevronDown className="location-chip-caret" size={15} aria-hidden />
      </button>
      {isOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-popover" role="menu" aria-label="Location actions">
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                selectPlace('home');
                setOpen(false);
              }}
            >
              <span className="menu-item-icon" aria-hidden>
                <Sun size={18} strokeWidth={2} />
              </span>
              <span className="menu-item-text">
                <span className="menu-item-label">My location's forecast</span>
                <span className="menu-item-hint">Full sun breakdown where you are</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                openSearch('origin');
                setOpen(false);
              }}
            >
              <span className="menu-item-icon" aria-hidden>
                <MapPin size={18} strokeWidth={2} />
              </span>
              <span className="menu-item-text">
                <span className="menu-item-label">Change starting point</span>
                <span className="menu-item-hint">Search for a different location</span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Opens search in explore mode - tap a result to preview its full forecast. */
function DestinationSearchButton() {
  const openSearch = useAppStore((s) => s.openSearch);
  return (
    <button
      type="button"
      className="icon-chip"
      aria-label="Search a destination"
      onClick={() => openSearch('explore')}
    >
      <Search size={18} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Location menu + destination search - the always-present row over the map. */
export function LocationBar({ isFetching }: { isFetching: boolean }) {
  return (
    <div className="top-controls-row">
      <LocationMenu />
      <DestinationSearchButton />
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
      <LocationBar isFetching={isFetching} />
      <div className="top-controls-row top-controls-scroll">
        <FilterControls />
      </div>
    </header>
  );
}
