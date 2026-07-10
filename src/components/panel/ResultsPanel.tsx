import { useState } from 'react';
import { Drawer } from 'vaul';
import type { ScoredPlace } from '../../core/types';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAppStore } from '../../state/store';
import { PlaceDetail } from './PlaceDetail';
import { ResultsList } from './ResultsList';

const SNAP_POINTS = [0.24, 0.55, 0.93];

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
          <div className="drawer-handle" aria-hidden />
          <div className="drawer-scroll">{content}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
