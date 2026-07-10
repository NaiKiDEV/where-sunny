import { useCallback, useState } from 'react';
import { useAppStore } from '../state/store';

const GEOLOCATION_TIMEOUT_MS = 12_000;
const POSITION_MAX_AGE_MS = 300_000;

type GeolocationStatus = 'idle' | 'locating' | 'error';

function describeError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission was denied — search for a city instead.';
    case err.POSITION_UNAVAILABLE:
      return 'Could not determine your location. Try searching for a city.';
    default:
      return 'Locating timed out. Try again or search for a city.';
  }
}

export function useGeolocation() {
  const setOrigin = useAppStore((s) => s.setOrigin);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser — search for a city instead.');
      setStatus('error');
      return;
    }
    setStatus('locating');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'My location' });
        setStatus('idle');
      },
      (err) => {
        setError(describeError(err));
        setStatus('error');
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: POSITION_MAX_AGE_MS },
    );
  }, [setOrigin]);

  return { locate, status, error };
}
