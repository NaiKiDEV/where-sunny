import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Star } from 'lucide-react';
import { searchAirports } from '../../core/airports/search';
import { airportToPlace, type Airport } from '../../core/airports/types';
import type { Place } from '../../core/types';
import type { GeoMatch } from '../../core/weather/geocoding';
import { searchPlaces } from '../../core/weather/geocoding';
import { useAirports } from '../../hooks/useAirports';
import { useBannedFilter } from '../../hooks/useBannedFilter';
import { FlightSearch } from '../flights/FlightSearch';
import { useGeolocation } from '../../hooks/useGeolocation';
import { countryFlag } from '../../lib/format';
import { MAX_PINS, useAppStore } from '../../state/store';
import { Segmented } from './Segmented';
import { SearchEmptyState } from './SearchEmptyState';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

type DestMode = 'explore' | 'airport' | 'flights';
const DEST_TABS: { id: DestMode; label: string }[] = [
  { id: 'explore', label: 'Places' },
  { id: 'airport', label: 'Airports' },
  { id: 'flights', label: 'Flights' },
];

function matchToPlace(match: GeoMatch): Place {
  return {
    key: `p${match.id}`,
    kind: 'pin',
    name: match.name,
    country: match.country,
    countryCode: match.countryCode,
    admin1: match.admin1,
    lat: match.lat,
    lon: match.lon,
    population: match.population ?? 0,
    elevation: match.elevation,
  };
}

/** Pins cloned from an airport preview share the detail view's `p:`-prefixed key. */
function airportPinKey(airport: Airport): string {
  return `p:${airport.key}`;
}

export function SearchDialog() {
  const searchMode = useAppStore((s) => s.searchMode);
  const openSearch = useAppStore((s) => s.openSearch);
  const closeSearch = useAppStore((s) => s.closeSearch);
  const setOrigin = useAppStore((s) => s.setOrigin);
  const pinned = useAppStore((s) => s.pinned);
  const addPin = useAppStore((s) => s.addPin);
  const removePin = useAppStore((s) => s.removePin);
  const selectPlace = useAppStore((s) => s.selectPlace);
  const setPreviewPlace = useAppStore((s) => s.setPreviewPlace);
  const pushRecentPlace = useAppStore((s) => s.pushRecentPlace);
  const { locate, status: geoStatus, error: geoError } = useGeolocation();
  const { airports, isLoading: airportsLoading } = useAirports();
  const { isBanned } = useBannedFilter();

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<GeoMatch[]>([]);
  const [isSearching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = searchMode !== null;
  const isAirport = searchMode === 'airport';
  const isFlights = searchMode === 'flights';
  const isDestination = searchMode === 'explore' || searchMode === 'airport' || isFlights;
  const isExplore = searchMode === 'explore';
  const pinnedKeys = new Set(pinned.map((p) => p.key));
  const isPinLimitReached = pinned.length >= MAX_PINS;

  const trimmed = query.trim();
  const airportMatches = useMemo(
    () => (isAirport && trimmed.length >= MIN_QUERY ? searchAirports(trimmed, airports) : []),
    [isAirport, trimmed, airports],
  );
  // Geocoding already drops built-in bans; this also hides the user's own picks.
  const visibleMatches = matches.filter(
    (m) => !isBanned({ country: m.country, countryCode: m.countryCode }),
  );

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Geocoding only backs the place modes; airports search a bundled list
  // locally and the flights tab has its own pickers.
  useEffect(() => {
    if (!isOpen || isAirport || isFlights) return;
    if (trimmed.length < MIN_QUERY) {
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
  }, [trimmed, isOpen, isAirport]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeSearch]);

  if (!isOpen) return null;

  const title =
    searchMode === 'origin'
      ? 'Where are you starting from?'
      : isAirport
        ? 'Find an airport'
        : isFlights
          ? 'Find flights'
          : 'Explore a destination';
  const placeholder = isAirport ? 'Airport code or name - e.g. FRA' : 'Search a city or town…';
  const ariaLabel =
    searchMode === 'origin'
      ? 'Set your starting point'
      : isAirport
        ? 'Find an airport'
        : isFlights
          ? 'Search flight prices'
          : 'Add a place of interest';

  const pickPlace = (match: GeoMatch) => {
    if (searchMode === 'origin') {
      setOrigin({ lat: match.lat, lon: match.lon, label: match.name });
    } else {
      const place = matchToPlace(match);
      // A watched place already has a cached forecast - jump straight to it.
      // Anything else opens as a preview: full details, nothing committed yet.
      pushRecentPlace(place);
      if (pinnedKeys.has(place.key)) selectPlace(place.key);
      else setPreviewPlace(place);
      closeSearch();
    }
    setQuery('');
    setMatches([]);
  };

  const togglePlacePin = (match: GeoMatch) => {
    const key = `p${match.id}`;
    if (pinnedKeys.has(key)) removePin(key);
    else addPin(matchToPlace(match));
  };

  const pickAirport = (airport: Airport) => {
    const watchKey = airportPinKey(airport);
    // Store the standalone airport Place so recents re-open it as a preview.
    pushRecentPlace(airportToPlace(airport));
    if (pinnedKeys.has(watchKey)) selectPlace(watchKey);
    else setPreviewPlace(airportToPlace(airport));
    closeSearch();
    setQuery('');
  };

  const toggleAirportPin = (airport: Airport) => {
    const key = airportPinKey(airport);
    if (pinnedKeys.has(key)) removePin(key);
    else addPin({ ...airportToPlace(airport), kind: 'pin', key });
  };

  return (
    <div className="search-backdrop" onClick={closeSearch}>
      <div
        className="search-dialog"
        role="dialog"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="search-title">{title}</h2>
        {isDestination && (
          <Segmented
            options={DEST_TABS}
            value={searchMode as DestMode}
            onChange={(mode) => openSearch(mode)}
            ariaLabel="Search places, airports, or flights"
            variant="inset"
          />
        )}
        {!isFlights && (
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
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
        {isAirport && (
          <p className="search-hint">
            Look up any airport with scheduled flights by IATA/ICAO code or name. Tap for its
            forecast, official site, and Wikipedia.
          </p>
        )}
        {geoError && <p className="search-error">{geoError}</p>}
        {searchError && <p className="search-error">{searchError}</p>}
        {isSearching && <p className="search-hint">Searching…</p>}
        {isAirport && airportsLoading && trimmed.length >= MIN_QUERY && (
          <p className="search-hint">Loading airport list…</p>
        )}

        {isFlights ? (
          <FlightSearch />
        ) : isExplore && trimmed.length === 0 ? (
          <SearchEmptyState />
        ) : isAirport ? (
          <ul className="search-results">
            {airportMatches.map((airport) => {
              const isWatched = pinnedKeys.has(airportPinKey(airport));
              return (
                <li key={airport.key} className="search-result-row">
                  <button type="button" className="search-result" onClick={() => pickAirport(airport)}>
                    <span className="search-result-name">
                      {airport.iata && <span className="search-result-code">{airport.iata}</span>}
                      {countryFlag(airport.country)} {airport.name}
                    </span>
                    <span className="search-result-meta">
                      {[airport.municipality, airport.country].filter(Boolean).join(', ')} · tap for details
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`pin-toggle${isWatched ? ' is-pinned' : ''}`}
                    aria-label={isWatched ? `Stop watching ${airport.name}` : `Watch ${airport.name}`}
                    disabled={!isWatched && isPinLimitReached}
                    onClick={() => toggleAirportPin(airport)}
                  >
                    <Star size={18} strokeWidth={2} fill={isWatched ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="search-results">
            {visibleMatches.map((match) => {
              const isPinned = pinnedKeys.has(`p${match.id}`);
              return (
                <li key={match.id} className="search-result-row">
                  <button type="button" className="search-result" onClick={() => pickPlace(match)}>
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
                    onClick={() => togglePlacePin(match)}
                  >
                    <Star size={18} strokeWidth={2} fill={isPinned ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
