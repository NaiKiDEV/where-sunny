import { MapView } from '../components/map/MapView';
import { ResultsPanel } from '../components/panel/ResultsPanel';
import { SearchDialog } from '../components/widgets/SearchDialog';
import { LocationBar, TopControls } from '../components/widgets/TopControls';
import { WeatherLayerControl } from '../components/widgets/WeatherLayerControl';
import { WelcomeOverlay } from '../components/widgets/WelcomeOverlay';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePinnedPlaces } from '../hooks/usePinnedPlaces';
import { useSunnyPlaces } from '../hooks/useSunnyPlaces';
import { useAppStore } from '../state/store';

export default function App() {
  const origin = useAppStore((s) => s.origin);
  const isMobile = useIsMobile();
  const { results, home, isLoading, isFetching, error } = useSunnyPlaces();
  const { pinnedScored, isLoading: isPinsLoading } = usePinnedPlaces();
  const busy = isFetching || isPinsLoading;

  return (
    <div className="app">
      <MapView results={results} pinned={pinnedScored} />
      {origin ? (
        <>
          {/* Mobile keeps only the location bar afloat; filters live in the drawer header. */}
          {isMobile ? (
            <header className="top-controls">
              <LocationBar isFetching={busy} />
            </header>
          ) : (
            <TopControls isFetching={busy} />
          )}
          <WeatherLayerControl />
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
