import { Sun } from 'lucide-react';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useAppStore } from '../../state/store';

export function WelcomeOverlay() {
  const openSearch = useAppStore((s) => s.openSearch);
  const { locate, status, error } = useGeolocation();

  return (
    <div className="welcome-overlay">
      <div className="welcome-card">
        <Sun className="welcome-mark" size={56} strokeWidth={2} aria-hidden />
        <h1 className="welcome-title">Where Sunny?</h1>
        <p className="welcome-tagline">
          Find where the sun is actually shining - nearby, a day trip, or a flight away.
        </p>
        <div className="welcome-actions">
          <button type="button" className="button-primary" onClick={locate} disabled={status === 'locating'}>
            {status === 'locating' ? 'Locating…' : 'Use my location'}
          </button>
          <button type="button" className="button-secondary" onClick={() => openSearch('origin')}>
            Search a city
          </button>
        </div>
        {error && <p className="welcome-error">{error}</p>}
        <p className="welcome-attribution">
          Weather by Open-Meteo · Places from GeoNames · Map © OpenStreetMap contributors
        </p>
      </div>
    </div>
  );
}
