import { type ReactNode, useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import type { Place, ScoredPlace } from '../../core/types';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePreviewPlace } from '../../hooks/usePreviewPlace';
import { countryFlag } from '../../lib/format';
import { useAppStore } from '../../state/store';
import { FilterControls } from '../widgets/TopControls';
import { PlaceDetail } from './PlaceDetail';
import { ResultsList } from './ResultsList';

/** Detail-shaped placeholder while a previewed destination's forecast is fetched. */
function DetailLoading({ place, error, onBack }: { place: Place; error: Error | null; onBack: () => void }) {
  return (
    <div className="place-detail">
      <header className="place-detail-header">
        <button type="button" className="back-button" onClick={onBack}>
          ‹ Back
        </button>
      </header>
      <h2 className="place-detail-name">
        {place.name} <span className="place-flag">{countryFlag(place.country)}</span>
      </h2>
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

// Top snap matches .drawer-content height (96%) so the sheet bottom lands exactly
// on the viewport bottom when fully open - otherwise the last row clips off-screen.
const SNAP_POINTS = [0.4, 0.7, 0.96];

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
  const preview = usePreviewPlace();
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[1]);

  const selected =
    pinnedScored.find((r) => r.place.key === selectedPlaceKey) ??
    results.find((r) => r.place.key === selectedPlaceKey) ??
    (home?.place.key === selectedPlaceKey ? home : null);

  // A previewed destination or a selected place both open the detail view;
  // preview wins because selecting anything clears the preview in the store.
  const isDetail = previewPlace !== null || selected !== null;
  const detailKey = previewPlace?.key ?? selectedPlaceKey;

  // Opening a detail (often by tapping a map pin) should lift the sheet into
  // view if it's sitting at the lowest snap - never collapse it if already up.
  useEffect(() => {
    if (!detailKey) return;
    setSnap((current) =>
      typeof current === 'number' && current < SNAP_POINTS[1] ? SNAP_POINTS[1] : current,
    );
  }, [detailKey]);

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

  if (!isMobile) {
    return <aside className="results-panel">{content}</aside>;
  }

  // vaul traps focus even with modal={false}, which makes the search overlay's
  // input untypeable - unmount the drawer while search is open
  if (searchMode !== null) return null;

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
      <Drawer.Portal>
        <Drawer.Content className="drawer-content" aria-describedby={undefined}>
          <Drawer.Title className="visually-hidden">Sunny places</Drawer.Title>
          {/* vaul's own handle: drags the sheet and taps cycle through snap points. */}
          <Drawer.Handle className="drawer-handle" />
          {/* Filters ride along inside the sheet so day/range/comfort stay reachable while browsing. */}
          {!isDetail && (
            <div className="drawer-controls">
              <FilterControls />
            </div>
          )}
          <div className="drawer-scroll">{content}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
