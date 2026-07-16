import { Ban, Check, ChevronDown, HelpCircle, Search, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ANY_COMFORT_ID, COMFORT_PRESETS } from "../../core/scoring/score";
import { useCountryList } from '../../hooks/useCountryList';
import { formatTempBare, type TempUnit, type UnitSystem } from '../../lib/format';
import { useAppStore } from "../../state/store";
import { CurrencySelect } from "./CurrencySelect";
import { Segmented } from "./Segmented";

const UNIT_OPTIONS: { id: TempUnit; label: string }[] = [
  { id: "c", label: "°C" },
  { id: "f", label: "°F" },
];

const SYSTEM_OPTIONS: { id: UnitSystem; label: string }[] = [
  { id: 'metric', label: 'Metric' },
  { id: 'imperial', label: 'Imperial' },
];

/**
 * Gear menu for display + ranking preferences. Holds the temperature unit toggle
 * and the comfort band (moved out of the filter row - it's a preference, not a
 * per-browse filter). Room to grow as more settings land here.
 */
export function SettingsMenu() {
  const unit = useAppStore((s) => s.unit);
  const setUnit = useAppStore((s) => s.setUnit);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const setUnitSystem = useAppStore((s) => s.setUnitSystem);
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const passportCountry = useAppStore((s) => s.passportCountry);
  const setPassportCountry = useAppStore((s) => s.setPassportCountry);
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
            <section className='settings-section settings-row'>
              <p className='menu-popover-title'>Temperature</p>
              <Segmented
                options={UNIT_OPTIONS}
                value={unit}
                onChange={setUnit}
                ariaLabel='Temperature unit'
                variant='inset'
              />
            </section>
            <section className='settings-section settings-row'>
              <p className='menu-popover-title'>Units</p>
              <Segmented
                options={SYSTEM_OPTIONS}
                value={unitSystem}
                onChange={setUnitSystem}
                ariaLabel='Measurement units'
                variant='inset'
              />
            </section>
            <section className='settings-section'>
              <p className='menu-popover-title'>Flight currency</p>
              <CurrencySelect
                value={currency}
                onChange={setCurrency}
                ariaLabel='Flight price currency'
              />
            </section>
            <section className='settings-section'>
              <p className='menu-popover-title'>Passport</p>
              <PassportSelect
                value={passportCountry}
                onChange={setPassportCountry}
                ariaLabel='Passport country'
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

interface PassportSelectProps {
  /** ISO alpha-2 code, or null when unset (the visa chip stays hidden). */
  value: string | null;
  onChange: (code: string | null) => void;
  /** Names the control for assistive tech; also labels the search input. */
  ariaLabel: string;
}

/**
 * Searchable passport-country picker for the visa quick-check, mirroring
 * CurrencySelect's chip-then-search flow (and reusing its styles) with the
 * country list the banned-countries picker uses. Unset by default - a neutral
 * "Not set" chip, and a "Not set" option to clear the choice again.
 */
function PassportSelect({ value, onChange, ariaLabel }: PassportSelectProps) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const { countries } = useCountryList();

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? countries.filter(
        (c) => c.name.toLowerCase().includes(trimmed) || c.code.toLowerCase().includes(trimmed),
      )
    : countries;
  const selectedName = value ? (countries.find((c) => c.code === value)?.name ?? value) : null;

  // On open the full list starts at "A" - bring the current choice into view
  // so changing passport starts from where the user already is.
  useEffect(() => {
    if (isOpen) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isOpen]);

  const select = (code: string | null) => {
    onChange(code);
    setOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        type='button'
        className='currency-trigger'
        aria-label={ariaLabel}
        aria-haspopup='listbox'
        aria-expanded={false}
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        {value !== null && <span className='currency-code'>{value}</span>}
        <span className='currency-trigger-name'>{selectedName ?? 'Not set'}</span>
        <ChevronDown className='currency-trigger-caret' size={15} aria-hidden />
      </button>
    );
  }

  return (
    <div className='currency-picker'>
      <div className='currency-picker-bar'>
        <Search className='currency-picker-glyph' size={15} strokeWidth={2.2} aria-hidden />
        <input
          autoFocus
          className='currency-picker-input'
          type='text'
          value={query}
          placeholder='Search countries'
          aria-label={`Search ${ariaLabel.toLowerCase()}`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            // A single match is an unambiguous pick - Enter commits it.
            if (e.key === 'Enter' && results.length === 1) select(results[0].code);
          }}
        />
      </div>
      <div className='currency-picker-list' role='listbox' aria-label={ariaLabel}>
        {trimmed === '' && (
          <button
            type='button'
            role='option'
            aria-selected={value === null}
            className={`currency-option${value === null ? ' is-active' : ''}`}
            onClick={() => select(null)}
          >
            <span className='currency-option-name'>Not set</span>
            {value === null && <Check size={16} strokeWidth={2.4} aria-hidden />}
          </button>
        )}
        {results.map((country) => {
          const isActive = country.code === value;
          return (
            <button
              key={country.code}
              ref={isActive ? activeRef : undefined}
              type='button'
              role='option'
              aria-selected={isActive}
              className={`currency-option${isActive ? ' is-active' : ''}`}
              onClick={() => select(country.code)}
            >
              <span className='currency-code'>{country.code}</span>
              <span className='currency-option-name'>{country.name}</span>
              {isActive && <Check size={16} strokeWidth={2.4} aria-hidden />}
            </button>
          );
        })}
        {results.length === 0 && (
          <p className='currency-picker-empty'>No countries match &ldquo;{query.trim()}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
