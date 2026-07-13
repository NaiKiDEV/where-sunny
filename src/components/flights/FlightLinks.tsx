import { useState } from 'react';
import { Plane } from 'lucide-react';
import { nearestFlightAirport } from '../../core/airports/nearest';
import type { Airport } from '../../core/airports/types';
import { buildFlightLinks, type FlightLink } from '../../core/flights/flightLinks';
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
          note: `${formatDistance(nearest.distanceKm)} from ${origin.label}`,
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
          note: `${formatDistance(nearest.distanceKm)} from ${place.name}`,
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
        <p className="flight-links-note">
          This is your departure airport - pick a different arrival airport to compare fares.
        </p>
      ) : (
        <FlightProviderLinks links={links} />
      )}
      {!sameAirport && (!originEnd.code || !destEnd.code) && (
        <p className="flight-links-note">
          No airport with scheduled flights within 300 km - Google searches by place name instead.
        </p>
      )}
    </div>
  );
}
