import { useState } from 'react';
import { Plane } from 'lucide-react';
import { MAX_FLIGHT_AIRPORT_KM, nearestFlightAirport } from '../../core/airports/nearest';
import type { Airport } from '../../core/airports/types';
import { buildFlightLinks, type FlightLink } from '../../core/flights/flightLinks';
import { GROUND_LINK_MAX_KM, buildRome2RioLink } from '../../core/flights/groundLinks';
import { haversineKm } from '../../core/geo';
import type { Place } from '../../core/types';
import { useAirports } from '../../hooks/useAirports';
import { dayLabel, formatDistance } from '../../lib/format';
import { useAppStore } from '../../state/store';
import { AirportPicker, FlightProviderLinks, RouteEnd, type Endpoint } from './RouteControls';

/** Which end of the route the picker is editing. */
type PickerTarget = 'origin' | 'destination';

/**
 * "Check live prices" deep-links (docs/FLIGHT-LINKS.md) from the user's
 * departure airport to this place, departing on the selected forecast day.
 * Both ends default to the nearest IATA airport but can be overridden by
 * search - the closest airport isn't always the one you'd fly from.
 */
export function FlightLinks({ place, date }: { place: Place; date: string }) {
  const origin = useAppStore((s) => s.origin);
  const flightOriginAirport = useAppStore((s) => s.flightOriginAirport);
  const setFlightOriginAirport = useAppStore((s) => s.setFlightOriginAirport);
  const currency = useAppStore((s) => s.currency);
  const system = useAppStore((s) => s.unitSystem);
  const { airports } = useAirports();

  const [picking, setPicking] = useState<PickerTarget | null>(null);
  // Keyed by place so a stale override can't leak onto the next place viewed.
  const [destChoice, setDestChoice] = useState<{ placeKey: string; airport: Airport } | null>(null);

  if (!origin) return null;
  const destOverride = destChoice?.placeKey === place.key ? destChoice.airport : null;

  let originEnd: Endpoint;
  if (flightOriginAirport) {
    originEnd = { code: flightOriginAirport.iata, label: flightOriginAirport.name };
  } else {
    const nearest = nearestFlightAirport(origin, airports);
    originEnd = nearest
      ? {
          code: nearest.airport.iata,
          label: nearest.airport.name,
          note: `${formatDistance(nearest.distanceKm, system)} from ${origin.label}`,
        }
      : { label: origin.label };
  }

  let destEnd: Endpoint;
  if (destOverride) {
    destEnd = { code: destOverride.iata, label: destOverride.name };
  } else if (place.airport?.iata) {
    destEnd = { code: place.airport.iata, label: place.name };
  } else {
    const nearest = nearestFlightAirport(place, airports);
    destEnd = nearest
      ? {
          code: nearest.airport.iata,
          label: nearest.airport.name,
          note: `${formatDistance(nearest.distanceKm, system)} from ${place.name}`,
        }
      : { label: place.name };
  }

  const sameAirport = originEnd.code !== undefined && originEnd.code === destEnd.code;
  let links: FlightLink[] = [];
  if (!sameAirport) {
    try {
      links = buildFlightLinks({
        origin: originEnd.code ?? origin.label,
        destination: destEnd.code ?? place.name,
        departDate: date,
        currency,
      });
    } catch {
      // Only reachable when a label is somehow blank; an empty row beats a crash.
      links = [];
    }
  }

  // Ground transport only competes with flying on short hops. Rome2Rio wants
  // place names, not IATA codes, so the link routes city-to-city.
  let groundUrl: string | null = null;
  if (haversineKm(origin, place) < GROUND_LINK_MAX_KM) {
    try {
      groundUrl = buildRome2RioLink(origin.label, place.name);
    } catch {
      // Only reachable when a name is somehow blank; no link beats a crash.
      groundUrl = null;
    }
  }

  const selectAirport = (airport: Airport | null) => {
    if (picking === 'origin') setFlightOriginAirport(airport);
    else setDestChoice(airport ? { placeKey: place.key, airport } : null);
    setPicking(null);
  };

  return (
    <div className="flight-links">
      <div className="flight-links-head">
        <Plane size={15} strokeWidth={2} aria-hidden />
        <span>Flights · departing {dayLabel(date)}</span>
      </div>
      <div className="flight-route">
        <RouteEnd
          side="From"
          end={originEnd}
          onChange={() => setPicking(picking === 'origin' ? null : 'origin')}
        />
        <RouteEnd
          side="To"
          end={destEnd}
          onChange={() => setPicking(picking === 'destination' ? null : 'destination')}
        />
      </div>
      {picking && (
        <AirportPicker
          airports={airports}
          placeholder={
            picking === 'origin' ? 'Search departure airport…' : 'Search arrival airport…'
          }
          allowAuto={picking === 'origin' ? flightOriginAirport !== null : destOverride !== null}
          onSelect={selectAirport}
          onClose={() => setPicking(null)}
        />
      )}
      {sameAirport ? (
        <>
          {groundUrl !== null && (
            <div className="flight-provider-links">
              <GroundTransportLink url={groundUrl} />
            </div>
          )}
          <p className="flight-links-note">
            This is your departure airport - pick a different arrival airport to compare fares.
          </p>
        </>
      ) : (
        (links.length > 0 || groundUrl !== null) && (
          <div className="flight-provider-links">
            <FlightProviderLinks links={links} />
            {groundUrl !== null && <GroundTransportLink url={groundUrl} />}
          </div>
        )
      )}
      {!sameAirport && (!originEnd.code || !destEnd.code) && (
        <p className="flight-links-note">
          No airport with scheduled flights within {formatDistance(MAX_FLIGHT_AIRPORT_KM, system)} -
          Google searches by place name instead.
        </p>
      )}
    </div>
  );
}

/**
 * Quieter Rome2Rio link for trains, buses, and ferries - a secondary option
 * beside the provider links, not a fourth equal provider. Shared with
 * FlightSearch so the label and anatomy stay in one place.
 */
export function GroundTransportLink({ url }: { url: string }) {
  return (
    <a
      className="airport-link airport-link--ground"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Trains, buses & ferries ↗
    </a>
  );
}
