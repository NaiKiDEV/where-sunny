import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Airport } from '../core/airports/types';
import { BANNED_COUNTRY_CODES, isBannedPlace, isEffectivelyBanned } from '../core/bannedCountries';
import { DEFAULT_CURRENCY, inferCurrency } from '../core/currency';
import type { ComfortPrefs } from '../core/scoring/score';
import { DEFAULT_COMFORT } from '../core/scoring/score';
import type { TempUnit } from '../lib/format';
import type { Trip, TripStop } from '../core/trip/trip';
import { addStop, moveStopDay, orderByProximity, removeStop, renameTrip } from '../core/trip/trip';
import type { Origin, Place, TierId, WindowId } from '../core/types';

export const MAX_PINS = 12;

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

function newTrip(name: string | undefined, origin: Origin | null, count: number): Trip {
  return {
    id: generateId(),
    name: name?.trim() || `Trip ${count + 1}`,
    origin: origin ?? undefined,
    stops: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * 'origin' = pick a starting point; 'explore' = add a place of interest;
 * 'airport' = look up an airport by code or name; 'flights' = flight price
 * search between two airports.
 */
export type SearchMode = 'origin' | 'explore' | 'airport' | 'flights';

/** Map weather wash: off, a sunshine field, or a cloud-&-rain field. */
export type OverlayMode = 'off' | 'sun' | 'rain';

/** How the wash renders: a per-point soft glow, or an interpolated filled field. */
export type OverlayStyle = 'glow' | 'field';

interface AppState {
  origin: Origin | null;
  /** User-picked departure airport for flight links; null = auto (nearest to origin). */
  flightOriginAirport: Airport | null;
  tier: TierId;
  timeWindow: WindowId;
  comfort: ComfortPrefs;
  /** Temperature display unit; values are stored in Celsius and converted on render. */
  unit: TempUnit;
  /** ISO 4217 code for flight price links; seeded from the device locale on first run. */
  currency: string;
  overlay: OverlayMode;
  overlayStyle: OverlayStyle;
  pinned: Place[];
  selectedPlaceKey: string | null;
  /** A searched destination shown in detail without committing (not pinned, not origin). */
  previewPlace: Place | null;
  searchMode: SearchMode | null; // null = search closed
  /** Saved itineraries + which one the cart actions target. */
  trips: Trip[];
  activeTripId: string | null;
  tripsOpen: boolean; // UI: trips surface is showing (not persisted)
  scoreInfoOpen: boolean; // UI: "how the Sunny Score works" sheet is showing (not persisted)
  /** ISO alpha-2 codes the user chose to ban, layered on top of the built-in list. */
  userBannedCountries: string[];
  bannedManagerOpen: boolean; // UI: the banned-countries manager is showing (not persisted)
  setOrigin: (origin: Origin) => void;
  setFlightOriginAirport: (airport: Airport | null) => void;
  setTier: (tier: TierId) => void;
  setTimeWindow: (timeWindow: WindowId) => void;
  setComfort: (comfort: ComfortPrefs) => void;
  setUnit: (unit: TempUnit) => void;
  setCurrency: (currency: string) => void;
  setOverlay: (overlay: OverlayMode) => void;
  setOverlayStyle: (style: OverlayStyle) => void;
  addPin: (place: Place) => void;
  removePin: (key: string) => void;
  selectPlace: (key: string | null) => void;
  setPreviewPlace: (place: Place) => void;
  /** Dismiss whichever detail is open (selected or preview) and return to the list. */
  closeDetail: () => void;
  openSearch: (mode: SearchMode) => void;
  closeSearch: () => void;
  createTrip: (name?: string) => void;
  /** Add a decoded shared trip as a new saved trip and open it. */
  importTrip: (data: { name: string; origin?: Origin; stops: TripStop[] }) => void;
  deleteTrip: (id: string) => void;
  renameActiveTrip: (name: string) => void;
  setActiveTrip: (id: string) => void;
  /** Add a place to the active trip, creating a default trip if none exists (cart add). */
  addToTrip: (place: Place) => void;
  removeFromTrip: (placeKey: string) => void;
  /** Shift a stop to an earlier (-1) or later (+1) day. */
  moveTripStopDay: (placeKey: string, direction: -1 | 1) => void;
  optimizeTripOrder: () => void;
  openTrips: () => void;
  closeTrips: () => void;
  openScoreInfo: () => void;
  closeScoreInfo: () => void;
  /** Add a country (ISO alpha-2) to the user's ban list; built-ins and dupes are ignored. */
  addUserBan: (code: string) => void;
  /** Remove one of the user's own bans. Built-in bans can never be removed. */
  removeUserBan: (code: string) => void;
  openBannedManager: () => void;
  closeBannedManager: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      origin: null,
      flightOriginAirport: null,
      tier: 'day',
      timeWindow: 'today',
      comfort: DEFAULT_COMFORT,
      unit: 'c',
      currency: inferCurrency() ?? DEFAULT_CURRENCY,
      overlay: 'off',
      overlayStyle: 'field',
      pinned: [],
      selectedPlaceKey: null,
      previewPlace: null,
      searchMode: null,
      trips: [],
      activeTripId: null,
      tripsOpen: false,
      scoreInfoOpen: false,
      userBannedCountries: [],
      bannedManagerOpen: false,
      setOrigin: (origin) =>
        // A picked departure airport was chosen relative to the old starting
        // point, so moving home resets it to auto (nearest).
        set({
          origin,
          flightOriginAirport: null,
          selectedPlaceKey: null,
          previewPlace: null,
          searchMode: null,
        }),
      setFlightOriginAirport: (flightOriginAirport) => set({ flightOriginAirport }),
      setTier: (tier) => set({ tier, selectedPlaceKey: null }),
      setTimeWindow: (timeWindow) => set({ timeWindow, selectedPlaceKey: null }),
      setComfort: (comfort) => set({ comfort }),
      setUnit: (unit) => set({ unit }),
      setCurrency: (currency) => set({ currency }),
      setOverlay: (overlay) => set({ overlay }),
      setOverlayStyle: (overlayStyle) => set({ overlayStyle }),
      addPin: (place) =>
        set((state) => {
          if (isEffectivelyBanned(place, new Set(state.userBannedCountries))) return state;
          if (state.pinned.some((p) => p.key === place.key) || state.pinned.length >= MAX_PINS) {
            return state;
          }
          return { pinned: [...state.pinned, place] };
        }),
      removePin: (key) =>
        set((state) => {
          if (!state.pinned.some((p) => p.key === key)) return state;
          return {
            pinned: state.pinned.filter((p) => p.key !== key),
            selectedPlaceKey: state.selectedPlaceKey === key ? null : state.selectedPlaceKey,
          };
        }),
      selectPlace: (selectedPlaceKey) => set({ selectedPlaceKey, previewPlace: null }),
      setPreviewPlace: (previewPlace) =>
        set((state) =>
          isEffectivelyBanned(previewPlace, new Set(state.userBannedCountries))
            ? state
            : { previewPlace, selectedPlaceKey: null, searchMode: null },
        ),
      closeDetail: () => set({ selectedPlaceKey: null, previewPlace: null }),
      openSearch: (searchMode) => set({ searchMode }),
      closeSearch: () => set({ searchMode: null }),
      createTrip: (name) =>
        set((state) => {
          const trip = newTrip(name, state.origin, state.trips.length);
          return { trips: [...state.trips, trip], activeTripId: trip.id, tripsOpen: true };
        }),
      importTrip: (data) =>
        set((state) => {
          // A shared trip could carry banned stops; strip them before saving.
          const userCodes = new Set(state.userBannedCountries);
          const trip: Trip = {
            id: generateId(),
            name: data.name,
            origin: data.origin,
            stops: data.stops.filter((stop) => !isEffectivelyBanned(stop.place, userCodes)),
            createdAt: new Date().toISOString(),
          };
          return { trips: [...state.trips, trip], activeTripId: trip.id, tripsOpen: true };
        }),
      deleteTrip: (id) =>
        set((state) => {
          const trips = state.trips.filter((t) => t.id !== id);
          const activeTripId = state.activeTripId === id ? (trips[0]?.id ?? null) : state.activeTripId;
          return { trips, activeTripId };
        }),
      renameActiveTrip: (name) =>
        set((state) =>
          state.activeTripId
            ? { trips: state.trips.map((t) => (t.id === state.activeTripId ? renameTrip(t, name) : t)) }
            : state,
        ),
      setActiveTrip: (activeTripId) => set({ activeTripId }),
      addToTrip: (place) =>
        set((state) => {
          if (isEffectivelyBanned(place, new Set(state.userBannedCountries))) return state;
          const hasActive =
            state.activeTripId !== null && state.trips.some((t) => t.id === state.activeTripId);
          if (hasActive) {
            return {
              trips: state.trips.map((t) => (t.id === state.activeTripId ? addStop(t, place) : t)),
            };
          }
          const trip = addStop(newTrip(undefined, state.origin, state.trips.length), place);
          return { trips: [...state.trips, trip], activeTripId: trip.id };
        }),
      removeFromTrip: (placeKey) =>
        set((state) =>
          state.activeTripId
            ? { trips: state.trips.map((t) => (t.id === state.activeTripId ? removeStop(t, placeKey) : t)) }
            : state,
        ),
      moveTripStopDay: (placeKey, direction) =>
        set((state) =>
          state.activeTripId
            ? {
                trips: state.trips.map((t) =>
                  t.id === state.activeTripId ? moveStopDay(t, placeKey, direction) : t,
                ),
              }
            : state,
        ),
      optimizeTripOrder: () =>
        set((state) =>
          state.activeTripId
            ? {
                trips: state.trips.map((t) =>
                  t.id === state.activeTripId ? orderByProximity(t) : t,
                ),
              }
            : state,
        ),
      openTrips: () => set({ tripsOpen: true, selectedPlaceKey: null, previewPlace: null }),
      closeTrips: () => set({ tripsOpen: false }),
      openScoreInfo: () => set({ scoreInfoOpen: true }),
      closeScoreInfo: () => set({ scoreInfoOpen: false }),
      addUserBan: (code) =>
        set((state) => {
          const c = code.trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(c)) return state;
          if (BANNED_COUNTRY_CODES.has(c) || state.userBannedCountries.includes(c)) return state;
          return { userBannedCountries: [...state.userBannedCountries, c] };
        }),
      removeUserBan: (code) =>
        set((state) => {
          const c = code.trim().toUpperCase();
          if (!state.userBannedCountries.includes(c)) return state;
          return { userBannedCountries: state.userBannedCountries.filter((x) => x !== c) };
        }),
      openBannedManager: () => set({ bannedManagerOpen: true }),
      closeBannedManager: () => set({ bannedManagerOpen: false }),
    }),
    {
      name: 'where-sunny-state',
      version: 1,
      partialize: (state) => ({
        origin: state.origin,
        flightOriginAirport: state.flightOriginAirport,
        tier: state.tier,
        timeWindow: state.timeWindow,
        comfort: state.comfort,
        unit: state.unit,
        currency: state.currency,
        overlay: state.overlay,
        overlayStyle: state.overlayStyle,
        pinned: state.pinned,
        trips: state.trips,
        activeTripId: state.activeTripId,
        userBannedCountries: state.userBannedCountries,
      }),
      // Runs on every rehydration (not gated on version), so previously-saved
      // pins/trips are re-purged whenever the banned list grows. Starts from the
      // default shallow merge, then scrubs banned pins and trip stops.
      merge: (persisted: unknown, current: AppState): AppState => {
        const merged = { ...current, ...(persisted as object) } as AppState;
        return {
          ...merged,
          pinned: merged.pinned.filter((p) => !isBannedPlace(p)),
          trips: merged.trips.map((trip) => ({
            ...trip,
            stops: trip.stops.filter((stop) => !isBannedPlace(stop.place)),
          })),
        };
      },
    },
  ),
);
