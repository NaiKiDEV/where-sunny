import { type ReactNode, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Drawer } from 'vaul';
import type { Place, ScoredPlace } from '../../core/types';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePreviewPlace } from '../../hooks/usePreviewPlace';
import { countryFlag } from '../../lib/format';
import { useAppStore } from '../../state/store';
import { FilterControls } from '../widgets/TopControls';
import { PlaceDetail } from './PlaceDetail';
import { ResultsList } from './ResultsList';
import { TripsView } from './TripsView';

/** Detail-shaped placeholder while a previewed destination's forecast is fetched. */
function DetailLoading({ place, error, onBack }: { place: Place; error: Error | null; onBack: () => void }) {
  return (
    <div className="place-detail">
      <header className="panel-sticky-header">
        <button type="button" className="back-button" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden /> Back
        </button>
        <h2 className="place-detail-name">
          {place.name} <span className="place-flag">{countryFlag(place.country)}</span>
        </h2>
      </header>
      {error ? (
        <p className="place-detail-sub" role="alert">
          Couldn't load this forecast - check your connection and try again.
        </p>
      ) : (
        <>
          <p className="place-detail-sub">Loading forecast…</p>
          <div className="results-skeleton" aria-label="Loading forecast">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Lowest snap is a bare handle lip so the sheet can tuck fully away and hand the
// whole map to the user, while a grabbable strip stays to pull it back up. It
// must be a fraction, not a px value: vaul translates by
// `viewportHeight - snapHeight`, but .drawer-content is height:96% pinned to
// bottom:0, so its top starts 4%vh down and the visible height is really
// `(snap - 0.04) * viewportHeight`. A px lip (e.g. 32px) nets ~2px and vanishes;
// 0.08 nets ~4%vh (~the handle's height). Top snap matches the 96% height so the
// sheet bottom lands exactly on the viewport bottom when fully open - otherwise
// the last row clips off-screen.
const LIP_SNAP = 0.08;
const SNAP_POINTS = [LIP_SNAP, 0.4, 0.7, 0.96];
/** Where the sheet rests by default and lifts to when a detail opens. */
const DEFAULT_SNAP = 0.7;

interface ResultsPanelProps {
  results: ScoredPlace[];
  pinnedScored: ScoredPlace[];
  home: ScoredPlace | null;
  isLoading: boolean;
  error: Error | null;
}

export function ResultsPanel({ results, pinnedScored, home, isLoading, error }: ResultsPanelProps) {
  const isMobile = useIsMobile();
  const selectedPlaceKey = useAppStore((s) => s.selectedPlaceKey);
  const previewPlace = useAppStore((s) => s.previewPlace);
  const closeDetail = useAppStore((s) => s.closeDetail);
  const searchMode = useAppStore((s) => s.searchMode);
  const tripsOpen = useAppStore((s) => s.tripsOpen);
  const bannedManagerOpen = useAppStore((s) => s.bannedManagerOpen);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const preview = usePreviewPlace();
  const [snap, setSnap] = useState<number | string | null>(DEFAULT_SNAP);

  const selected =
    pinnedScored.find((r) => r.place.key === selectedPlaceKey) ??
    results.find((r) => r.place.key === selectedPlaceKey) ??
    (home?.place.key === selectedPlaceKey ? home : null);

  // A previewed destination or a selected place both open the detail view;
  // preview wins because selecting anything clears the preview in the store.
  const isDetail = previewPlace !== null || selected !== null;
  const detailKey = previewPlace?.key ?? selectedPlaceKey;

  // Opening any surface that takes over the sheet - a place detail (often by
  // tapping a map pin) or the trips view - should lift it into view when it's
  // tucked at the lip or a low snap, and never collapse it if it is already at
  // or above the default resting snap. `openTrips` clears the selection, so a
  // detailKey and trips are never live together; keying on both makes the lift
  // fire when either opens or when selection jumps between places.
  const takeoverKey = tripsOpen ? 'trips' : detailKey;
  useEffect(() => {
    if (!takeoverKey) return;
    setSnap((current) =>
      typeof current === 'number' && current >= DEFAULT_SNAP ? current : DEFAULT_SNAP,
    );
  }, [takeoverKey]);

  // A stable id for the currently shown view. Switching it remounts the wrapper
  // below so the .reveal entrance replays on every list <-> detail <-> trips
  // swap (and when the detail jumps between places). openTrips clears the
  // selection, so a detailKey and trips are never live at the same time.
  const viewKey = detailKey ?? (tripsOpen ? 'trips' : 'list');

  let content: ReactNode;
  if (previewPlace) {
    content = preview.scored ? (
      <PlaceDetail key={preview.scored.place.key} scored={preview.scored} />
    ) : (
      <DetailLoading place={previewPlace} error={preview.error} onBack={closeDetail} />
    );
  } else if (selected) {
    // key resets the detail's active-day state when selection jumps between places
    content = <PlaceDetail key={selected.place.key} scored={selected} />;
  } else if (tripsOpen) {
    content = <TripsView />;
  } else {
    content = (
      <ResultsList
        results={results}
        pinnedScored={pinnedScored}
        home={home}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Keyed so React remounts on a view switch and the fade+rise re-plays; the
  // swapped view is the incoming content, cross-fading in over a hard cut.
  const view = (
    <div key={viewKey} className="panel-view reveal">
      {content}
    </div>
  );

  if (!isMobile) {
    return <aside className="results-panel">{view}</aside>;
  }

  // vaul traps focus even with modal={false}, which makes any overlaid text
  // input untypeable on mobile - unmount the drawer while search, the settings
  // menu (currency picker search), or the banned-countries manager is open.
  if (searchMode !== null || settingsOpen || bannedManagerOpen) return null;

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      snapToSequentialPoint
    >
      {/* No Drawer.Portal: rendering the sheet inline keeps it inside .app's
          stacking context, so the top-bar popovers (which lift to --z-overlay
          within .app) can paint above it. Portaled to <body>, the sheet sat at
          --z-panel in the root context and covered every popover. .app has no
          transform/filter/contain, so its overflow:hidden can't clip this
          position:fixed sheet. Modals stay body-portaled and above everything. */}
      <Drawer.Content className="drawer-content" aria-describedby={undefined}>
        <Drawer.Title className="visually-hidden">Sunny places</Drawer.Title>
        {/* vaul's own handle: drags the sheet and taps cycle through snap points. */}
        <Drawer.Handle className="drawer-handle" />
        {/* Filters ride along inside the sheet so day/range/comfort stay reachable while browsing. */}
        {!isDetail && !tripsOpen && (
          <div className="drawer-controls">
            <FilterControls variant="inset" />
          </div>
        )}
        <div className="drawer-scroll">{view}</div>
      </Drawer.Content>
    </Drawer.Root>
  );
}
