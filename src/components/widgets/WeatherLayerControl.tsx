import { useState } from 'react';
import { CloudRain, EyeOff, Layers, Navigation, Radar, Sun, type LucideIcon } from 'lucide-react';
import { type OverlayMode, type OverlayStyle, useAppStore } from '../../state/store';
import { Segmented } from './Segmented';

interface OverlayOption {
  id: OverlayMode;
  label: string;
  hint: string;
  Icon: LucideIcon;
}

const OVERLAY_OPTIONS: OverlayOption[] = [
  { id: 'off', label: 'No overlay', hint: 'Just the map', Icon: EyeOff },
  { id: 'sun', label: 'Sunshine', hint: 'Where the sun wins', Icon: Sun },
  { id: 'rain', label: 'Cloud & rain', hint: 'Where it turns wet', Icon: CloudRain },
  { id: 'radar', label: 'Live radar', hint: 'Rain falling right now', Icon: Radar },
];

const STYLE_OPTIONS: { id: OverlayStyle; label: string }[] = [
  { id: 'field', label: 'Filled field' },
  { id: 'glow', label: 'Soft glow' },
];

/** Floating map control that toggles the weather wash and picks sun vs cloud+rain. */
export function WeatherLayerControl() {
  const overlay = useAppStore((s) => s.overlay);
  const setOverlay = useAppStore((s) => s.setOverlay);
  const overlayStyle = useAppStore((s) => s.overlayStyle);
  const setOverlayStyle = useAppStore((s) => s.setOverlayStyle);
  const windArrows = useAppStore((s) => s.windArrows);
  const setWindArrows = useAppStore((s) => s.setWindArrows);
  const [isOpen, setOpen] = useState(false);
  const isActive = overlay !== 'off' || windArrows;
  // The glow/field style picker only applies to the forecast washes; live
  // radar renders provider tiles and has no style of its own.
  const hasStylePicker = overlay === 'sun' || overlay === 'rain';

  return (
    <div className="layer-control">
      <button
        type="button"
        className={`icon-chip layer-control-trigger${isActive ? ' is-active' : ''}`}
        aria-label="Weather overlay"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setOpen((v) => !v)}
      >
        <Layers size={18} strokeWidth={2} aria-hidden />
      </button>
      {isOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-popover layer-popover" role="menu" aria-label="Weather overlay">
            <p className="menu-popover-title">Weather overlay</p>
            {OVERLAY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={option.id === overlay}
                className={`menu-item${option.id === overlay ? ' is-active' : ''}`}
                onClick={() => {
                  setOverlay(option.id);
                  setOpen(false);
                }}
              >
                <span className="menu-item-icon" aria-hidden>
                  <option.Icon size={18} strokeWidth={2} />
                </span>
                <span className="menu-item-text">
                  <span className="menu-item-label">{option.label}</span>
                  <span className="menu-item-hint">{option.hint}</span>
                </span>
              </button>
            ))}
            {hasStylePicker && (
              <div className="layer-style">
                <p className="menu-popover-title">Style</p>
                <Segmented
                  options={STYLE_OPTIONS}
                  value={overlayStyle}
                  onChange={setOverlayStyle}
                  ariaLabel="Overlay style"
                />
              </div>
            )}
            {/* Independent of the wash: arrows show the steering wind that
                carries rain areas. Toggling keeps the popover open so the
                effect on the map behind it can be judged and undone. */}
            <div className="layer-arrows">
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={windArrows}
                className={`menu-item layer-arrows-toggle${windArrows ? ' is-active' : ''}`}
                onClick={() => setWindArrows(!windArrows)}
              >
                <span className="menu-item-icon" aria-hidden>
                  <Navigation size={18} strokeWidth={2} />
                </span>
                <span className="menu-item-text">
                  <span className="menu-item-label">Rain movement</span>
                  <span className="menu-item-hint">Wind steering direction</span>
                </span>
                <span
                  className={`layer-switch${windArrows ? ' is-on' : ''}`}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
