import { Ban, HelpCircle, Settings } from "lucide-react";
import { ANY_COMFORT_ID, COMFORT_PRESETS } from "../../core/scoring/score";
import { formatTempBare, type TempUnit } from "../../lib/format";
import { useAppStore } from "../../state/store";
import { CurrencySelect } from "./CurrencySelect";
import { Segmented } from "./Segmented";

const UNIT_OPTIONS: { id: TempUnit; label: string }[] = [
  { id: "c", label: "°C" },
  { id: "f", label: "°F" },
];

/**
 * Gear menu for display + ranking preferences. Holds the temperature unit toggle
 * and the comfort band (moved out of the filter row - it's a preference, not a
 * per-browse filter). Room to grow as more settings land here.
 */
export function SettingsMenu() {
  const unit = useAppStore((s) => s.unit);
  const setUnit = useAppStore((s) => s.setUnit);
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const comfort = useAppStore((s) => s.comfort);
  const setComfort = useAppStore((s) => s.setComfort);
  const openScoreInfo = useAppStore((s) => s.openScoreInfo);
  const openBannedManager = useAppStore((s) => s.openBannedManager);
  // Open state lives in the store (not local) so the mobile results drawer can
  // unmount while this menu is open - vaul's focus guard otherwise steals focus
  // from the currency picker's search input, leaving it untypeable on mobile.
  const isOpen = useAppStore((s) => s.settingsOpen);
  const openSettings = useAppStore((s) => s.openSettings);
  const closeSettings = useAppStore((s) => s.closeSettings);

  const active =
    COMFORT_PRESETS.find(
      (p) => p.idealMin === comfort.idealMin && p.idealMax === comfort.idealMax,
    ) ?? COMFORT_PRESETS[1];

  return (
    <div className="settings-menu">
      <button
        type="button"
        className="icon-chip"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeSettings() : openSettings())}
      >
        <Settings size={18} strokeWidth={2} aria-hidden />
      </button>
      {isOpen && (
        <>
          <div className="menu-backdrop" onClick={closeSettings} />
          <div
            className="menu-popover settings-popover"
            role="dialog"
            aria-label="Settings"
          >
            <section className="settings-section">
              <p className="menu-popover-title">Temperature unit</p>
              <Segmented
                options={UNIT_OPTIONS}
                value={unit}
                onChange={setUnit}
                ariaLabel="Temperature unit"
                variant="inset"
              />
            </section>
            <section className="settings-section">
              <p className="menu-popover-title">Flight price currency</p>
              <CurrencySelect
                value={currency}
                onChange={setCurrency}
                ariaLabel="Flight price currency"
              />
            </section>
            <section className="settings-section">
              <p className="menu-popover-title">Comfortable temperature</p>
              <div className="comfort-option-list">
                {COMFORT_PRESETS.map((preset) => {
                  const isAny = preset.id === ANY_COMFORT_ID;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`comfort-option${preset.id === active.id ? " is-active" : ""}`}
                      onClick={() =>
                        setComfort({
                          idealMin: preset.idealMin,
                          idealMax: preset.idealMax,
                        })
                      }
                    >
                      <span className="comfort-option-name">
                        {preset.name}
                        {!isAny && (
                          <span className="comfort-option-range">
                            {formatTempBare(preset.idealMin, unit)}–
                            {formatTempBare(preset.idealMax, unit)}
                          </span>
                        )}
                      </span>
                      {isAny && (
                        <span className="comfort-option-hint">
                          sun only, ignore temp
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
            <button
              type="button"
              className="menu-item settings-help"
              onClick={() => {
                openScoreInfo();
                closeSettings();
              }}
            >
              <span className="menu-item-icon" aria-hidden>
                <HelpCircle size={18} strokeWidth={2} />
              </span>
              <span className="menu-item-text">
                <span className="menu-item-label">
                  How the Sunny Score works
                </span>
                <span className="menu-item-hint">
                  See exactly what goes into every number
                </span>
              </span>
            </button>
            <button
              type="button"
              className="menu-item settings-help"
              onClick={() => {
                openBannedManager();
                closeSettings();
              }}
            >
              <span className="menu-item-icon" aria-hidden>
                <Ban size={18} strokeWidth={2} />
              </span>
              <span className="menu-item-text">
                <span className="menu-item-label">Banned countries</span>
                <span className="menu-item-hint">
                  Hide places you never want to see
                </span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
