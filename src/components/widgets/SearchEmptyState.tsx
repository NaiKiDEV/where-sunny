import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { codeOf } from '../../core/bannedCountries';
import { useBannedFilter } from '../../hooks/useBannedFilter';
import { countryFlag } from '../../lib/format';
import { useAppStore } from '../../state/store';
import { SuggestedDestinations } from './SuggestedDestinations';

/**
 * The explore empty state: one coherent surface that shows recently
 * searched/previewed places first (when there are any), then the curated
 * "start somewhere sunny" suggestions - never two competing blocks. Recents
 * re-open as a preview; suggestions set the origin (see SuggestedDestinations).
 */
export function SearchEmptyState() {
  const recentPlaces = useAppStore((s) => s.recentPlaces);
  const setPreviewPlace = useAppStore((s) => s.setPreviewPlace);
  const { isBanned } = useBannedFilter();

  // Persisted recents are purged on rehydrate, but a same-session ban could
  // still leave a stale entry - filter defensively so nothing banned surfaces.
  const recents = useMemo(
    () => recentPlaces.filter((p) => !isBanned(p)),
    [recentPlaces, isBanned],
  );

  return (
    <div className="empty-state">
      {recents.length > 0 && (
        <section className="recent" aria-label="Recent places">
          <p className="recent-head">
            <Clock size={15} strokeWidth={2} aria-hidden />
            Recent
          </p>
          <ul className="search-results">
            {recents.map((place) => (
              <li key={place.key}>
                <button
                  type="button"
                  className="search-result"
                  onClick={() => setPreviewPlace(place)}
                >
                  <span className="search-result-name">
                    {countryFlag(codeOf(place))} {place.name}
                  </span>
                  <span className="search-result-meta">
                    {[place.admin1, place.country].filter(Boolean).join(', ')} · tap for details
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SuggestedDestinations />
    </div>
  );
}
