import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ComfortPrefs } from '../core/scoring/score';
import { DEFAULT_COMFORT } from '../core/scoring/score';
import type { Origin, Place, TierId, WindowId } from '../core/types';

export const MAX_PINS = 12;

/** 'origin' = pick a starting point; 'explore' = add a place of interest. */
export type SearchMode = 'origin' | 'explore';

interface AppState {
  origin: Origin | null;
  tier: TierId;
  timeWindow: WindowId;
  comfort: ComfortPrefs;
  pinned: Place[];
  selectedPlaceKey: string | null;
  searchMode: SearchMode | null; // null = search closed
  setOrigin: (origin: Origin) => void;
  setTier: (tier: TierId) => void;
  setTimeWindow: (timeWindow: WindowId) => void;
  setComfort: (comfort: ComfortPrefs) => void;
  addPin: (place: Place) => void;
  removePin: (key: string) => void;
  selectPlace: (key: string | null) => void;
  openSearch: (mode: SearchMode) => void;
  closeSearch: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      origin: null,
      tier: 'day',
      timeWindow: 'today',
      comfort: DEFAULT_COMFORT,
      pinned: [],
      selectedPlaceKey: null,
      searchMode: null,
      setOrigin: (origin) => set({ origin, selectedPlaceKey: null, searchMode: null }),
      setTier: (tier) => set({ tier, selectedPlaceKey: null }),
      setTimeWindow: (timeWindow) => set({ timeWindow, selectedPlaceKey: null }),
      setComfort: (comfort) => set({ comfort }),
      addPin: (place) =>
        set((state) => {
          if (state.pinned.some((p) => p.key === place.key) || state.pinned.length >= MAX_PINS) {
            return state;
          }
          return { pinned: [...state.pinned, place] };
        }),
      removePin: (key) =>
        set((state) => ({
          pinned: state.pinned.filter((p) => p.key !== key),
          selectedPlaceKey: state.selectedPlaceKey === key ? null : state.selectedPlaceKey,
        })),
      selectPlace: (selectedPlaceKey) => set({ selectedPlaceKey }),
      openSearch: (searchMode) => set({ searchMode }),
      closeSearch: () => set({ searchMode: null }),
    }),
    {
      name: 'where-sunny-state',
      partialize: (state) => ({
        origin: state.origin,
        tier: state.tier,
        timeWindow: state.timeWindow,
        comfort: state.comfort,
        pinned: state.pinned,
      }),
    },
  ),
);
