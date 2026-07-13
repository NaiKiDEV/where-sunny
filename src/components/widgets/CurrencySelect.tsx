import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { currencyName, searchCurrencies } from '../../core/currency';

interface CurrencySelectProps {
  value: string;
  onChange: (code: string) => void;
  /** Names the control for assistive tech; also labels the search input. */
  ariaLabel: string;
}

/**
 * Searchable currency picker for the settings menu, replacing a native
 * <select>: OS defaults look out of place next to the styled popover and give
 * no way to search ~130 codes. Collapsed it's a chip showing the current
 * choice; open it swaps in a filter input plus a scrollable list, mirroring
 * the airport picker's search-and-pick flow.
 */
export function CurrencySelect({ value, onChange, ariaLabel }: CurrencySelectProps) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const results = searchCurrencies(query);

  // On open the full list starts at "A" - bring the current choice into view
  // so changing currency starts from where the user already is.
  useEffect(() => {
    if (isOpen) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isOpen]);

  const select = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="currency-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={false}
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        <span className="currency-code">{value}</span>
        <span className="currency-trigger-name">{currencyName(value) ?? value}</span>
        <ChevronDown className="currency-trigger-caret" size={15} aria-hidden />
      </button>
    );
  }

  return (
    <div className="currency-picker">
      <div className="currency-picker-bar">
        <Search className="currency-picker-glyph" size={15} strokeWidth={2.2} aria-hidden />
        <input
          autoFocus
          className="currency-picker-input"
          type="text"
          value={query}
          placeholder="Search currencies"
          aria-label={`Search ${ariaLabel.toLowerCase()}`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            // A single match is an unambiguous pick - Enter commits it.
            if (e.key === 'Enter' && results.length === 1) select(results[0]);
          }}
        />
      </div>
      <div className="currency-picker-list" role="listbox" aria-label={ariaLabel}>
        {results.map((code) => {
          const isActive = code === value;
          return (
            <button
              key={code}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`currency-option${isActive ? ' is-active' : ''}`}
              onClick={() => select(code)}
            >
              <span className="currency-code">{code}</span>
              <span className="currency-option-name">{currencyName(code) ?? code}</span>
              {isActive && <Check size={16} strokeWidth={2.4} aria-hidden />}
            </button>
          );
        })}
        {results.length === 0 && (
          <p className="currency-picker-empty">
            No currencies match &ldquo;{query.trim()}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
