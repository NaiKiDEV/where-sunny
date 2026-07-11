import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ComfortPrefs } from '../core/scoring/score';
import { DEFAULT_COMFORT } from '../core/scoring/score';
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

/** 'origin' = pick a starting point; 'explore' = add a place of interest. */
export type SearchMode = 'origin' | 'explore';

/** Map weather wash: off, a sunshine field, or a cloud-&-rain field. */
export type OverlayMode = 'off' | 'sun' | 'rain';

/** How the wash renders: a per-point soft glow, or an interpolated filled field. */
export type OverlayStyle = 'glow' | 'field';

interface AppState {
  origin: Origin | null;
  tier: TierId;
  timeWindow: WindowId;
  comfort: ComfortPrefs;
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
  setOrigin: (origin: Origin) => void;
  setTier: (tier: TierId) => void;
  setTimeWindow: (timeWindow: WindowId) => void;
  setComfort: (comfort: ComfortPrefs) => void;
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
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      origin: null,
      tier: 'day',
      timeWindow: 'today',
      comfort: DEFAULT_COMFORT,
      overlay: 'off',
      overlayStyle: 'field',
      pinned: [],
      selectedPlaceKey: null,
      previewPlace: null,
      searchMode: null,
      trips: [],
      activeTripId: null,
      tripsOpen: false,
      setOrigin: (origin) =>
        set({ origin, selectedPlaceKey: null, previewPlace: null, searchMode: null }),
      setTier: (tier) => set({ tier, selectedPlaceKey: null }),
      setTimeWindow: (timeWindow) => set({ timeWindow, selectedPlaceKey: null }),
      setComfort: (comfort) => set({ comfort }),
      setOverlay: (overlay) => set({ overlay }),
      setOverlayStyle: (overlayStyle) => set({ overlayStyle }),
      addPin: (place) =>
        set((state) => {
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
        set({ previewPlace, selectedPlaceKey: null, searchMode: null }),
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
          const trip: Trip = {
            id: generateId(),
            name: data.name,
            origin: data.origin,
            stops: data.stops,
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
    }),
    {
      name: 'where-sunny-state',
      version: 1,
      partialize: (state) => ({
        origin: state.origin,
        tier: state.tier,
        timeWindow: state.timeWindow,
        comfort: state.comfort,
        overlay: state.overlay,
        overlayStyle: state.overlayStyle,
        pinned: state.pinned,
        trips: state.trips,
        activeTripId: state.activeTripId,
      }),
    },
  ),
);
