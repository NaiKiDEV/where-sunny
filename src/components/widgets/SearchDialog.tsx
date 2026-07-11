import { useEffect, useRef, useState } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Place } from '../../core/types';
import type { GeoMatch } from '../../core/weather/geocoding';
import { searchPlaces } from '../../core/weather/geocoding';
import { useGeolocation } from '../../hooks/useGeolocation';
import { countryFlag } from '../../lib/format';
import { MAX_PINS, useAppStore } from '../../state/store';

const SEARCH_DEBOUNCE_MS = 300;

function matchToPlace(match: GeoMatch): Place {
  return {
    key: `p${match.id}`,
    kind: 'pin',
    name: match.name,
    country: match.country,
    admin1: match.admin1,
    lat: match.lat,
    lon: match.lon,
    population: match.population ?? 0,
  };
}

export function SearchDialog() {
  const searchMode = useAppStore((s) => s.searchMode);
  const closeSearch = useAppStore((s) => s.closeSearch);
  const setOrigin = useAppStore((s) => s.setOrigin);
  const pinned = useAppStore((s) => s.pinned);
  const addPin = useAppStore((s) => s.addPin);
  const removePin = useAppStore((s) => s.removePin);
  const selectPlace = useAppStore((s) => s.selectPlace);
  const setPreviewPlace = useAppStore((s) => s.setPreviewPlace);
  const { locate, status: geoStatus, error: geoError } = useGeolocation();

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<GeoMatch[]>([]);
  const [isSearching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = searchMode !== null;
  const pinnedKeys = new Set(pinned.map((p) => p.key));
  const isPinLimitReached = pinned.length >= MAX_PINS;

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    // `cancelled` also discards responses that resolve out of order after
    // further keystrokes, not just pending timeouts
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const found = await searchPlaces(trimmed);
        if (!cancelled) setMatches(found);
      } catch {
        if (!cancelled) setSearchError('Search failed - check your connection.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeSearch]);

  if (!isOpen) return null;

  const pickPrimary = (match: GeoMatch) => {
    if (searchMode === 'origin') {
      setOrigin({ lat: match.lat, lon: match.lon, label: match.name });
    } else {
      const place = matchToPlace(match);
      // A watched place already has a cached forecast - jump straight to it.
      // Anything else opens as a preview: full details, nothing committed yet.
      if (pinnedKeys.has(place.key)) selectPlace(place.key);
      else setPreviewPlace(place);
      closeSearch();
    }
    setQuery('');
    setMatches([]);
  };

  const togglePin = (match: GeoMatch) => {
    const key = `p${match.id}`;
    if (pinnedKeys.has(key)) removePin(key);
    else addPin(matchToPlace(match));
  };

  return (
    <div className="search-backdrop" onClick={closeSearch}>
      <div
        className="search-dialog"
        role="dialog"
        aria-label={searchMode === 'origin' ? 'Set your starting point' : 'Add a place of interest'}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="search-title">
          {searchMode === 'origin' ? 'Where are you starting from?' : 'Explore a destination'}
        </h2>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Search a city or town…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searchMode === 'origin' && (
          <button type="button" className="search-locate" onClick={locate} disabled={geoStatus === 'locating'}>
            <MapPin size={15} aria-hidden /> {geoStatus === 'locating' ? 'Locating…' : 'Use my location'}
          </button>
        )}
        {searchMode === 'explore' && (
          <p className="search-hint">
            Tap any place to see its full forecast, then watch it or start there. Works for tiny
            villages far outside your travel range too.
            {isPinLimitReached && ` You're watching ${MAX_PINS} places - the max.`}
          </p>
        )}
        {geoError && <p className="search-error">{geoError}</p>}
        {searchError && <p className="search-error">{searchError}</p>}
        {isSearching && <p className="search-hint">Searching…</p>}
        <ul className="search-results">
          {matches.map((match) => {
            const isPinned = pinnedKeys.has(`p${match.id}`);
            return (
              <li key={match.id} className="search-result-row">
                <button type="button" className="search-result" onClick={() => pickPrimary(match)}>
                  <span className="search-result-name">
                    {countryFlag(match.country.length === 2 ? match.country : '')} {match.name}
                  </span>
                  <span className="search-result-meta">
                    {[match.admin1, match.country].filter(Boolean).join(', ')}
                    {searchMode === 'origin' ? ' · tap to start here' : ' · tap for details'}
                  </span>
                </button>
                <button
                  type="button"
                  className={`pin-toggle${isPinned ? ' is-pinned' : ''}`}
                  aria-label={isPinned ? `Stop watching ${match.name}` : `Watch ${match.name}`}
                  disabled={!isPinned && isPinLimitReached}
                  onClick={() => togglePin(match)}
                >
                  <Star size={18} strokeWidth={2} fill={isPinned ? 'currentColor' : 'none'} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
