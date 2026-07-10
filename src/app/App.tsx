import { MapView } from '../components/map/MapView';
import { ResultsPanel } from '../components/panel/ResultsPanel';
import { SearchDialog } from '../components/widgets/SearchDialog';
import { TopControls } from '../components/widgets/TopControls';
import { WelcomeOverlay } from '../components/widgets/WelcomeOverlay';
import { usePinnedPlaces } from '../hooks/usePinnedPlaces';
import { useSunnyPlaces } from '../hooks/useSunnyPlaces';
import { useAppStore } from '../state/store';

export default function App() {
  const origin = useAppStore((s) => s.origin);
  const { results, home, isLoading, isFetching, error } = useSunnyPlaces();
  const { pinnedScored, isLoading: isPinsLoading } = usePinnedPlaces();

  return (
    <div className="app">
      <MapView results={results} pinned={pinnedScored} />
      {origin ? (
        <>
          <TopControls isFetching={isFetching || isPinsLoading} />
          <ResultsPanel
            results={results}
            pinnedScored={pinnedScored}
            home={home}
            isLoading={isLoading}
            error={error}
          />
        </>
      ) : (
        <WelcomeOverlay />
      )}
      <SearchDialog />
    </div>
  );
}
