import { BedDouble } from 'lucide-react';
import { buildStayLinks, type StayLink } from '../../core/lodging/stayLinks';
import { dayLabel } from '../../lib/format';

export interface StayLinksProps {
  placeName: string;
  countryName?: string;
  checkIn: string; // ISO 'YYYY-MM-DD'
  checkOut: string; // ISO 'YYYY-MM-DD', after checkIn
  currency?: string; // ISO 4217
}

/**
 * "Where to sleep" deep-links (Booking.com / Airbnb / Google Hotels) with real
 * dates pre-filled - the lodging counterpart to FlightLinks, same provider-row
 * visual language. Props-only by design: no store access, no fetching - the
 * integrator owns date/currency wiring. The builders throw on malformed input
 * (boundary validation); here that surfaces as silence, never a crashed panel.
 */
export function StayLinks({ placeName, countryName, checkIn, checkOut, currency }: StayLinksProps) {
  let links: StayLink[];
  try {
    links = buildStayLinks(placeName, countryName, checkIn, checkOut, currency);
  } catch {
    return null;
  }

  return (
    <section className="stay-links" aria-label="Where to stay">
      <div className="stay-links-head">
        <BedDouble size={15} strokeWidth={2} aria-hidden />
        <span>
          Where to stay · {dayLabel(checkIn)} - {dayLabel(checkOut)}
        </span>
      </div>
      <div className="stay-provider-links">
        {links.map((link) => (
          <a
            key={link.provider}
            className="stay-link"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label} ↗
          </a>
        ))}
      </div>
    </section>
  );
}
