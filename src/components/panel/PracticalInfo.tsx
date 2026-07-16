import { useQuery } from "@tanstack/react-query";
import { Car, Clock3, Coins, PhoneCall, Plug, Stamp } from "lucide-react";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { codeOf } from "../../core/bannedCountries";
import {
  factsToShow,
  fetchCountryFacts,
  homeCountryCode,
} from "../../core/practical/countryFacts";
import { destinationCurrency, formatRate } from "../../core/practical/currency";
import {
  loadVisaSummary,
  visaForDestination,
  visaLabel,
} from "../../core/practical/visa";
import type { Place } from "../../core/types";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import { useAppStore } from "../../state/store";

// Same cadence as useLocalDate: re-check twice a minute so the displayed
// minute never lags, and refresh immediately when the tab becomes visible.
const CLOCK_TICK_MS = 30_000;

export interface PracticalInfoProps {
  /** The destination shown in the detail panel (its country drives currency). */
  place: Place;
  /**
   * Destination IANA timezone from the forecast (PlaceForecast.timezone via
   * usePlaceForecast). Omit while loading/unknown - the clock simply hides.
   */
  timezone?: string;
}

/** "14:32" in the destination zone, or null when the zone is missing/invalid. */
function formatZonedTime(
  now: Date,
  timeZone: string | undefined,
): string | null {
  if (!timeZone) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
  } catch {
    return null; // zone name the runtime does not know
  }
}

/** A zone's UTC offset in minutes at an instant, via its formatted wall clock. */
function zoneOffsetMinutes(now: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);
    // hour % 24: some runtimes render midnight as "24" in hour12:false mode.
    const wallClockUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
    );
    if (Number.isNaN(wallClockUtc)) return null;
    // The formatted parts truncate to the minute, so compare like with like.
    const nowToMinute = Math.floor(now.getTime() / 60_000) * 60_000;
    return Math.round((wallClockUtc - nowToMinute) / 60_000);
  } catch {
    return null;
  }
}

/**
 * "+2 h" / "-3.5 h" between the destination zone and the device zone right
 * now (DST-correct), or null when they share an offset or the zone is
 * unknown. Fractional hours keep half- and quarter-hour zones honest
 * (+5.5 h India, +5.75 h Nepal); across the date line the delta simply
 * exceeds 12.
 */
function offsetDeltaLabel(
  now: Date,
  timeZone: string | undefined,
): string | null {
  if (!timeZone) return null;
  const destination = zoneOffsetMinutes(now, timeZone);
  if (destination === null) return null;
  const deltaMinutes = destination - -now.getTimezoneOffset();
  if (deltaMinutes === 0) return null;
  const hours = Math.abs(deltaMinutes) / 60;
  const magnitude = Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(2).replace(/0+$/, "");
  return `${deltaMinutes > 0 ? "+" : "-"}${magnitude} h`;
}

/**
 * The destination's current wall-clock time, ticking while mounted (same
 * subscription shape as useLocalDate) - re-renders only when the formatted
 * minute actually changes.
 */
function useZonedTime(timeZone: string | undefined): string | null {
  const subscribe = useCallback((onChange: () => void) => {
    const interval = setInterval(onChange, CLOCK_TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") onChange();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return useSyncExternalStore(subscribe, () =>
    formatZonedTime(new Date(), timeZone),
  );
}

/**
 * One quiet practical row for a destination: "Local time 14:32 (+2 h) ·
 * 1 EUR ≈ 26.4 CZK · Type G · 230 V · Emergency 999". Every chip earns its
 * place - the clock only when the destination's offset differs from the
 * device's, the rate only when the currencies differ and Frankfurter quotes
 * the pair, plugs only when home's don't fit (or the voltage band differs),
 * driving side only when opposite, the visa chip only when a passport is set
 * and an answer exists. Nothing interesting renders nothing; silence is the
 * default. The country facts and visa data are bundled datasets loaded
 * bonus-tier: no loading or error state, the chips simply appear.
 */
export function PracticalInfo({ place, timezone }: PracticalInfoProps) {
  const userCurrency = useAppStore((s) => s.currency);
  const origin = useAppStore((s) => s.origin);
  const passportCountry = useAppStore((s) => s.passportCountry);
  const destCode = codeOf(place);
  const placeCurrency = destinationCurrency(destCode);
  const { rate } = useExchangeRate(userCurrency, placeCurrency);
  const localTime = useZonedTime(timezone);
  const offsetLabel = offsetDeltaLabel(new Date(), timezone);
  const homeCode = homeCountryCode(origin);

  // Bundled dataset - cached forever like country-names; renders nothing while
  // loading or on error (bonus tier).
  const factsQuery = useQuery({
    queryKey: ["country-facts"],
    queryFn: () => fetchCountryFacts(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const factsMap = factsQuery.data;
  const facts = factsMap
    ? factsToShow(
        { code: destCode, facts: factsMap[destCode] ?? null },
        {
          code: homeCode,
          facts: homeCode ? (factsMap[homeCode] ?? null) : null,
        },
      )
    : null;

  // One ~1 KB file per passport, fetched only once a passport is set and the
  // destination could actually need a visa. Unset passport = feature invisible.
  const visaEnabled =
    passportCountry !== null && destCode !== "" && destCode !== passportCountry;
  const visaQuery = useQuery({
    queryKey: ["visa-summary", passportCountry],
    enabled: visaEnabled,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => loadVisaSummary(passportCountry!),
  });
  const visaSummary = visaEnabled ? (visaQuery.data ?? null) : null;
  const visa =
    visaSummary && passportCountry
      ? visaForDestination(visaSummary, passportCountry, destCode)
      : null;

  const showTime = localTime !== null && offsetLabel !== null;

  const items: ReactNode[] = [];
  if (showTime) {
    items.push(
      <span key="time" className="practical-item">
        <Clock3 size={16} strokeWidth={2} aria-hidden />
        <span className="practical-label">Local time</span>
        <span>{localTime}</span>
        <span className="practical-hint">({offsetLabel})</span>
      </span>,
    );
  }
  if (rate !== null) {
    items.push(
      <span key="rate" className="practical-item">
        <Coins size={16} strokeWidth={2} aria-hidden />
        <span>
          1 {rate.base} ≈ {formatRate(rate.rate)} {rate.quote}
        </span>
      </span>,
    );
  }
  if (facts?.plugs) {
    items.push(
      <span key="plugs" className="practical-item">
        <Plug size={16} strokeWidth={2} aria-hidden />
        <span>
          Type {facts.plugs.types.join(" · ")} · {facts.plugs.voltage} V
        </span>
      </span>,
    );
  }
  if (facts?.drive) {
    items.push(
      <span key="drive" className="practical-item">
        <Car size={16} strokeWidth={2} aria-hidden />
        <span>Drives on the {facts.drive}</span>
      </span>,
    );
  }
  if (facts) {
    items.push(
      <span key="emergency" className="practical-item">
        <PhoneCall size={16} strokeWidth={2} aria-hidden />
        <span className="practical-label">Emergency</span>
        <span>{facts.emergency.join(" · ")}</span>
      </span>,
    );
  }
  if (visa) {
    items.push(
      <span key="visa" className="practical-item">
        <Stamp size={16} strokeWidth={2} aria-hidden />
        <span>{visaLabel(visa)}</span>
      </span>,
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="practical-info" aria-label="Practical info">
      {items}
      {visa && visaSummary && (
        <p className="practical-note">
          Check official sources - data {visaSummary.generated.slice(0, 4)}
        </p>
      )}
    </section>
  );
}
