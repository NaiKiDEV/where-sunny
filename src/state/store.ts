import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ComfortPrefs } from '../core/scoring/score';
import { DEFAULT_COMFORT } from '../core/scoring/score';
import type { Origin, Place, TierId, WindowId } from '../core/types';

export const MAX_PINS = 12;

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
      }),
    },
  ),
);
