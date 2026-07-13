import { useState } from "react";
import { nearestFlightAirport } from "../../core/airports/nearest";
import type { Airport } from "../../core/airports/types";
import {
  buildFlightLinks,
  type FlightLink,
} from "../../core/flights/flightLinks";
import { useAirports } from "../../hooks/useAirports";
import { formatDistance } from "../../lib/format";
import { useAppStore } from "../../state/store";
import {
  AirportPicker,
  FlightProviderLinks,
  RouteEnd,
  type Endpoint,
} from "./RouteControls";

type PickerTarget = "origin" | "destination";

/** Local calendar date as ISO `YYYY-MM-DD` (flight searches are date-only). */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Standalone flight search for the search dialog: pick both route ends
 * (departure defaults to the same airport suggestion the detail view uses),
 * choose dates, get provider deep-links. Return date is optional = one-way.
 */
export function FlightSearch() {
  const origin = useAppStore((s) => s.origin);
  const flightOriginAirport = useAppStore((s) => s.flightOriginAirport);
  const setFlightOriginAirport = useAppStore((s) => s.setFlightOriginAirport);
  const currency = useAppStore((s) => s.currency);
  const { airports, isLoading } = useAirports();

  const [picking, setPicking] = useState<PickerTarget | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [departDate, setDepartDate] = useState(todayIso());
  const [returnDate, setReturnDate] = useState("");

  // Departure suggestion mirrors FlightLinks: the user's picked airport wins,
  // else the nearest one to the starting point; without an origin the user
  // simply picks by search.
  let originEnd: Endpoint | null = null;
  if (flightOriginAirport) {
    originEnd = {
      code: flightOriginAirport.iata,
      label: flightOriginAirport.name,
    };
  } else if (origin) {
    const nearest = nearestFlightAirport(origin, airports);
    if (nearest) {
      originEnd = {
        code: nearest.airport.iata,
        label: nearest.airport.name,
        note: `${formatDistance(nearest.distanceKm)} from ${origin.label}`,
      };
    }
  }

  const destEnd: Endpoint | null = destination
    ? { code: destination.iata, label: destination.name }
    : null;

  const sameAirport =
    originEnd?.code !== undefined &&
    destEnd?.code !== undefined &&
    originEnd.code === destEnd.code;
  const isReturnInvalid = returnDate !== "" && returnDate < departDate;

  let links: FlightLink[] = [];
  if (
    originEnd?.code &&
    destEnd?.code &&
    !sameAirport &&
    departDate &&
    !isReturnInvalid
  ) {
    try {
      links = buildFlightLinks({
        origin: originEnd.code,
        destination: destEnd.code,
        departDate,
        currency,
        ...(returnDate ? { returnDate } : {}),
      });
    } catch {
      // Guards above make this unreachable; an empty row beats a crash.
      links = [];
    }
  }

  const selectAirport = (airport: Airport | null) => {
    if (picking === "origin") setFlightOriginAirport(airport);
    else setDestination(airport);
    setPicking(null);
  };

  return (
    <div className="flight-search">
      <div className="flight-route">
        <RouteEnd
          side="From"
          end={originEnd}
          onChange={() => setPicking(picking === "origin" ? null : "origin")}
        />
        <RouteEnd
          side="To"
          end={destEnd}
          onChange={() =>
            setPicking(picking === "destination" ? null : "destination")
          }
        />
      </div>
      {picking && (
        <AirportPicker
          airports={airports}
          placeholder={
            picking === "origin"
              ? "Search departure airport…"
              : "Search arrival airport…"
          }
          allowAuto={picking === "origin" && flightOriginAirport !== null}
          onSelect={selectAirport}
          onClose={() => setPicking(null)}
        />
      )}
      <div className="flight-search-dates">
        <label className="flight-search-date">
          Depart
          <input
            type="date"
            value={departDate}
            min={todayIso()}
            onChange={(e) => setDepartDate(e.target.value)}
          />
        </label>
        <label className="flight-search-date">
          <span>
            Return <span className="flight-search-optional">(optional)</span>
          </span>
          <input
            type="date"
            value={returnDate}
            min={departDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </label>
      </div>
      {isLoading && <p className="flight-links-note">Loading airport list…</p>}
      {sameAirport && (
        <p className="flight-links-note">
          Departure and arrival are the same airport.
        </p>
      )}
      {isReturnInvalid && (
        <p className="flight-links-note">
          The return date is before the departure.
        </p>
      )}
      {links.length > 0 ? (
        <FlightProviderLinks links={links} />
      ) : (
        !isLoading &&
        !sameAirport &&
        !isReturnInvalid && (
          <p className="flight-links-note">
            Pick both airports to compare live prices on Google Flights,
            Skyscanner, and Kayak.
          </p>
        )
      )}
    </div>
  );
}
