import { MapView } from '../components/map/MapView';
import { ResultsPanel } from '../components/panel/ResultsPanel';
import { BannedCountriesSheet } from '../components/widgets/BannedCountriesSheet';
import { ScoreInfoSheet } from '../components/widgets/ScoreInfoSheet';
import { SearchDialog } from '../components/widgets/SearchDialog';
import { LocationBar, TopControls } from '../components/widgets/TopControls';
import { WeatherLayerControl } from '../components/widgets/WeatherLayerControl';
import { WelcomeOverlay } from '../components/widgets/WelcomeOverlay';
import { useAirports } from '../hooks/useAirports';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePinnedPlaces } from '../hooks/usePinnedPlaces';
import { useSharedTrip } from '../hooks/useSharedTrip';
import { useSunnyPlaces } from '../hooks/useSunnyPlaces';
import { useAppStore } from '../state/store';

export default function App() {
  const origin = useAppStore((s) => s.origin);
  const isMobile = useIsMobile();
  useSharedTrip();
  const { results, home, isLoading, isFetching, error } = useSunnyPlaces();
  const { pinnedScored, isLoading: isPinsLoading } = usePinnedPlaces();
  const { airports } = useAirports();
  const busy = isFetching || isPinsLoading;

  return (
    <div className="app">
      <MapView results={results} pinned={pinnedScored} airports={airports} />
      {origin ? (
        <>
          {/* Mobile keeps only the location bar afloat; filters live in the drawer
              header, and the overlay toggle folds inline into the bar's single
              icon row so nothing floats loose in the corner to overlap it. */}
          {isMobile ? (
            <header className="top-controls">
              <LocationBar isFetching={busy} mobile />
            </header>
          ) : (
            <>
              <TopControls isFetching={busy} />
              <WeatherLayerControl />
            </>
          )}
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
      <ScoreInfoSheet />
      <BannedCountriesSheet />
    </div>
  );
}
