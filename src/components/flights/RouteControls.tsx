import { useState } from 'react';
import { searchAirports } from '../../core/airports/search';
import type { Airport } from '../../core/airports/types';
import type { FlightLink } from '../../core/flights/flightLinks';

/** One resolved end of a flight route. No `code` = free-text name (Google-only). */
export interface Endpoint {
  code?: string;
  label: string;
  /** "12 km from Faro" - shown for auto-resolved airports so a bad guess is visible. */
  note?: string;
}

export function AirportPicker({
  airports,
  placeholder,
  allowAuto,
  onSelect,
  onClose,
}: {
  airports: Airport[];
  placeholder: string;
  /** Offer a "back to nearest" reset when an override is active. */
  allowAuto: boolean;
  onSelect: (airport: Airport | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  // Flight links need IATA codes, so ICAO-only airports are excluded here.
  const results = searchAirports(query, airports, 6).filter((a) => a.iata);

  return (
    <div className="flight-picker">
      <div className="flight-picker-bar">
        <input
          autoFocus
          className="flight-picker-input"
          type="text"
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        <button type="button" className="flight-picker-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
      {allowAuto && (
        <button
          type="button"
          className="flight-picker-option flight-picker-auto"
          onClick={() => onSelect(null)}
        >
          Use the nearest airport again
        </button>
      )}
      {results.map((airport) => (
        <button
          key={airport.key}
          type="button"
          className="flight-picker-option"
          onClick={() => onSelect(airport)}
        >
          <span className="airport-code">{airport.iata}</span>
          <span className="flight-picker-name">{airport.name}</span>
          {airport.municipality && (
            <span className="flight-picker-city">{airport.municipality}</span>
          )}
        </button>
      ))}
      {query.trim() && results.length === 0 && (
        <p className="flight-links-note">No airports match &ldquo;{query.trim()}&rdquo;.</p>
      )}
    </div>
  );
}

export function RouteEnd({
  side,
  end,
  onChange,
}: {
  side: string;
  /** null = nothing chosen or resolvable yet - render a "choose" prompt. */
  end: Endpoint | null;
  onChange: () => void;
}) {
  return (
    <div className="flight-route-end">
      <div className="flight-route-main">
        <span className="flight-route-side">{side}</span>
        {end?.code && <span className="airport-code">{end.code}</span>}
        {end ? (
          <span className="flight-route-name">{end.label}</span>
        ) : (
          <span className="flight-route-name flight-route-empty">Choose an airport</span>
        )}
        <button type="button" className="flight-route-change" onClick={onChange}>
          {end ? 'Change' : 'Choose'}
        </button>
      </div>
      {end?.note && <p className="flight-route-note">{end.note}</p>}
    </div>
  );
}

export function FlightProviderLinks({ links }: { links: FlightLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flight-provider-links">
      {links.map((link) => (
        <a
          key={link.provider}
          className="airport-link"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label} ↗
        </a>
      ))}
    </div>
  );
}
