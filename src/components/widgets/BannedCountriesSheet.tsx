import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import { BANNED_COUNTRIES } from '../../core/bannedCountries';
import { useBannedFilter } from '../../hooks/useBannedFilter';
import { useCountryList } from '../../hooks/useCountryList';
import { useAppStore } from '../../state/store';

/** How many picker results to show at once - enough to choose, not a wall. */
const MAX_ADD_RESULTS = 8;

/**
 * Manage the user-curated ban list. Built-in bans (Belarus, Russia) are shown
 * locked and can never be removed; the user's own picks can be added or removed
 * freely. Banning HIDES a country reactively across search, suggestions, the
 * map, and trips - it never deletes saved pins or trips, so a removal restores
 * them. Structure mirrors ScoreInfoSheet (backdrop + dialog, Escape-to-close).
 */
export function BannedCountriesSheet() {
  const isOpen = useAppStore((s) => s.bannedManagerOpen);
  const close = useAppStore((s) => s.closeBannedManager);
  const userBans = useAppStore((s) => s.userBannedCountries);
  const addUserBan = useAppStore((s) => s.addUserBan);
  const removeUserBan = useAppStore((s) => s.removeUserBan);
  const { countries } = useCountryList();
  const { codes } = useBannedFilter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  const nameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const country of countries) map.set(country.code, country.name);
    return map;
  }, [countries]);

  const trimmed = query.trim().toLowerCase();
  const addMatches = useMemo(() => {
    if (!trimmed) return [];
    return countries
      .filter((c) => !codes.has(c.code))
      .filter(
        (c) => c.name.toLowerCase().includes(trimmed) || c.code.toLowerCase().includes(trimmed),
      )
      .slice(0, MAX_ADD_RESULTS);
  }, [countries, codes, trimmed]);

  if (!isOpen) return null;

  const addBan = (code: string) => {
    addUserBan(code);
    setQuery('');
  };

  // Portal to <body> so the modal escapes the .app stacking context (see
  // ScoreInfoSheet); otherwise the mobile vaul drawer paints over it.
  return createPortal(
    <div className="score-info-backdrop" onClick={close}>
      <div
        className="score-info-sheet banned-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Banned countries"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="score-info-head">
          <h2 className="score-info-title">Banned countries</h2>
          <button type="button" className="score-info-close" aria-label="Close" onClick={close}>
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <p className="score-info-lede">
          These places are hidden everywhere - search, suggestions, the map, and trips. Ban a country
          to never see it again; remove it and it comes right back.
        </p>

        <section className="banned-group">
          <h3 className="banned-group-title">Always banned</h3>
          <ul className="banned-list">
            {BANNED_COUNTRIES.map((country) => (
              <li key={country.code} className="banned-row is-locked">
                <span className="banned-row-name">
                  {country.name} <span className="banned-row-code">{country.code}</span>
                </span>
                <span className="banned-row-lock" aria-hidden>
                  <Lock size={15} strokeWidth={2} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="banned-group">
          <h3 className="banned-group-title">Your bans</h3>
          {userBans.length === 0 ? (
            <p className="banned-empty">You haven't banned any countries yet.</p>
          ) : (
            <ul className="banned-list">
              {userBans.map((code) => {
                const name = nameByCode.get(code) ?? code;
                return (
                  <li key={code} className="banned-row">
                    <span className="banned-row-name">
                      {name} <span className="banned-row-code">{code}</span>
                    </span>
                    <button
                      type="button"
                      className="banned-row-remove"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeUserBan(code)}
                    >
                      <X size={16} strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="banned-group">
          <h3 className="banned-group-title">Add a country</h3>
          <input
            className="search-input banned-add-input"
            type="search"
            placeholder="Search a country to ban…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search a country to ban"
          />
          {trimmed !== '' && addMatches.length === 0 && (
            <p className="banned-empty">No countries match that search.</p>
          )}
          {addMatches.length > 0 && (
            <ul className="banned-add-results">
              {addMatches.map((country) => (
                <li key={country.code} className="search-result-row">
                  <button
                    type="button"
                    className="search-result banned-add-result"
                    onClick={() => addBan(country.code)}
                  >
                    <span className="search-result-name">
                      {country.name} <span className="banned-row-code">{country.code}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}
