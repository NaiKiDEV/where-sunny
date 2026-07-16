import { useState } from 'react';
import { CalendarDays, ChevronDown, Compass, MapPin, Plane, Route, Search, Sun } from 'lucide-react';
import { TIER_ORDER, TRAVEL_TIERS } from '../../core/candidates/tiers';
import { TIME_WINDOWS } from '../../core/scoring/window';
import type { WindowId } from '../../core/types';
import { formatDistance, type UnitSystem } from '../../lib/format';
import { useAppStore } from '../../state/store';
import { SelectMenu, type SelectOption } from './SelectMenu';
import { SettingsMenu } from './SettingsMenu';
import { WeatherLayerControl } from './WeatherLayerControl';

/** One-line context for each time window, shown under the label in the popover. */
const WINDOW_HINTS: Record<WindowId, string> = {
  today: 'Rest of today',
  tomorrow: 'All day tomorrow',
  weekend: 'This Sat & Sun',
  week: 'Best of 7 days',
};

const WINDOW_OPTIONS: SelectOption<WindowId>[] = TIME_WINDOWS.map(({ id, label }) => ({
  id,
  label,
  hint: WINDOW_HINTS[id],
}));

/** Tier hints come straight from each tier's search radius so they never drift. */
function tierOptions(system: UnitSystem): SelectOption<(typeof TIER_ORDER)[number]>[] {
  return TIER_ORDER.map((id) => ({
    id,
    label: TRAVEL_TIERS[id].label,
    hint: `${formatDistance(TRAVEL_TIERS[id].radiusKm, system)} radius`,
  }));
}

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

/** Opens search straight into airport lookup - the quick path when you know the code. */
function AirportSearchButton() {
  const openSearch = useAppStore((s) => s.openSearch);
  return (
    <button
      type="button"
      className="icon-chip"
      aria-label="Find an airport"
      onClick={() => openSearch('airport')}
    >
      <Plane size={18} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Opens the trips surface; badge shows how many stops the active trip holds. */
function TripsButton() {
  const openTrips = useAppStore((s) => s.openTrips);
  const trips = useAppStore((s) => s.trips);
  const activeTripId = useAppStore((s) => s.activeTripId);
  const count = trips.find((t) => t.id === activeTripId)?.stops.length ?? 0;
  return (
    <button type="button" className="icon-chip" aria-label="Trips" onClick={openTrips}>
      <Route size={18} strokeWidth={2} aria-hidden />
      {count > 0 && <span className="icon-chip-badge">{count}</span>}
    </button>
  );
}

interface LocationBarProps {
  isFetching: boolean;
  /**
   * Mobile layout: a single row where the location chip flexes and truncates
   * under pressure while the icons keep their natural size beside it. The
   * overlay toggle folds in here rather than floating in the corner (where it
   * overlapped these icons), and the airport shortcut collapses into the search
   * dialog's Airports tab to keep the row uncrowded. One flex container owns it
   * all, so nothing can overlap.
   */
  mobile?: boolean;
}

/** Location menu + the action cluster (search, trips, overlay/airport, settings). */
export function LocationBar({ isFetching, mobile = false }: LocationBarProps) {
  return (
    <div className={`top-controls-row${mobile ? ' top-controls-mobile' : ''}`}>
      <LocationMenu />
      {/* Sits beside the location chip so it stays put when the cluster is
          pushed to the far right on desktop (rather than trailing the icons). */}
      {isFetching && <span className="fetch-hint">Updating…</span>}
      <div className="control-cluster">
        <DestinationSearchButton />
        {/* Desktop has room for the dedicated airport shortcut; on mobile it
            lives inside the search dialog's Airports tab instead. */}
        {!mobile && <AirportSearchButton />}
        <TripsButton />
        {/* Mobile folds the overlay toggle in here; desktop floats it top-right. */}
        {mobile && <WeatherLayerControl />}
        <SettingsMenu />
      </div>
    </div>
  );
}

/**
 * Day / travel-range filters as compact value chips. Reused floating (desktop,
 * over the map) and inset (mobile, inside the drawer) - the variant just swaps
 * the chip's surface treatment. Each chip opens a popover list, so the row
 * stays two chips wide no matter how many windows or tiers we add.
 */
export function FilterControls({ variant = 'floating' }: { variant?: 'floating' | 'inset' }) {
  const tier = useAppStore((s) => s.tier);
  const timeWindow = useAppStore((s) => s.timeWindow);
  const setTier = useAppStore((s) => s.setTier);
  const setTimeWindow = useAppStore((s) => s.setTimeWindow);
  const system = useAppStore((s) => s.unitSystem);

  return (
    <>
      <SelectMenu
        options={WINDOW_OPTIONS}
        value={timeWindow}
        onChange={setTimeWindow}
        ariaLabel="When"
        Icon={CalendarDays}
        variant={variant}
      />
      <SelectMenu
        options={tierOptions(system)}
        value={tier}
        onChange={setTier}
        ariaLabel="How far"
        Icon={Compass}
        variant={variant}
      />
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
