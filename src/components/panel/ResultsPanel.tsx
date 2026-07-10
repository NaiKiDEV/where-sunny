import { useState } from 'react';
import { Drawer } from 'vaul';
import type { ScoredPlace } from '../../core/types';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAppStore } from '../../state/store';
import { FilterControls } from '../widgets/TopControls';
import { PlaceDetail } from './PlaceDetail';
import { ResultsList } from './ResultsList';

// Top snap matches .drawer-content height (96%) so the sheet bottom lands exactly
// on the viewport bottom when fully open — otherwise the last row clips off-screen.
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
  const searchMode = useAppStore((s) => s.searchMode);
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[1]);

  const selected =
    pinnedScored.find((r) => r.place.key === selectedPlaceKey) ??
    results.find((r) => r.place.key === selectedPlaceKey) ??
    (home?.place.key === selectedPlaceKey ? home : null);

  const content = selected ? (
    // key resets the detail's active-day state when selection jumps between places
    <PlaceDetail key={selected.place.key} scored={selected} />
  ) : (
    <ResultsList
      results={results}
      pinnedScored={pinnedScored}
      home={home}
      isLoading={isLoading}
      error={error}
    />
  );

  if (!isMobile) {
    return <aside className="results-panel">{content}</aside>;
  }

  // vaul traps focus even with modal={false}, which makes the search overlay's
  // input untypeable — unmount the drawer while search is open
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
          <button
            type="button"
            className="drawer-handle-hit"
            aria-label={snap === SNAP_POINTS[SNAP_POINTS.length - 1] ? 'Collapse panel' : 'Expand panel'}
            onClick={() =>
              setSnap((current) =>
                current === SNAP_POINTS[SNAP_POINTS.length - 1] ? SNAP_POINTS[1] : SNAP_POINTS[SNAP_POINTS.length - 1],
              )
            }
          >
            <span className="drawer-handle" aria-hidden />
          </button>
          {/* Filters ride along inside the sheet so day/range/comfort stay reachable while browsing. */}
          {!selected && (
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
