import { useState } from 'react';
import { Thermometer } from 'lucide-react';
import { COMFORT_PRESETS } from '../../core/scoring/score';
import { useAppStore } from '../../state/store';

/** Temperature-comfort preset picker: what "good weather" means is personal. */
export function ComfortControl() {
  const comfort = useAppStore((s) => s.comfort);
  const setComfort = useAppStore((s) => s.setComfort);
  const [isOpen, setOpen] = useState(false);

  const active =
    COMFORT_PRESETS.find((p) => p.idealMin === comfort.idealMin && p.idealMax === comfort.idealMax) ??
    COMFORT_PRESETS[1];

  return (
    <div className="comfort-control">
      <button
        type="button"
        className="segmented comfort-trigger"
        aria-expanded={isOpen}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="segmented-option is-active comfort-trigger-label">
          <Thermometer size={14} strokeWidth={2} aria-hidden /> {active.label}
        </span>
      </button>
      {isOpen && (
        <>
          <div className="comfort-backdrop" onClick={() => setOpen(false)} />
          <div className="comfort-popover" role="dialog" aria-label="Temperature comfort">
            <p className="comfort-popover-title">What feels good to you?</p>
            {COMFORT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`comfort-option${preset.id === active.id ? ' is-active' : ''}`}
                onClick={() => {
                  setComfort({ idealMin: preset.idealMin, idealMax: preset.idealMax });
                  setOpen(false);
                }}
              >
                {preset.label}
                {preset.id === 'any' && <span className="comfort-option-hint">sun only, ignore temp</span>}
              </button>
            ))}
            <p className="comfort-popover-hint">Scores re-rank instantly - no refetch needed.</p>
          </div>
        </>
      )}
    </div>
  );
}
