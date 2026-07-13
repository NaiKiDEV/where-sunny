import { useEffect, useState } from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';

export interface SelectOption<T extends string> {
  id: T;
  label: string;
  /** Optional secondary line shown under the label inside the popover. */
  hint?: string;
}

/**
 * `floating` (default) is the translucent, blurred, drop-shadowed chip meant to
 * hover over the map. `inset` is a flat, recessed chip for solid surfaces
 * (the results drawer) where the floating cues look out of place - it mirrors
 * the Segmented control's two variants so filters read the same in both homes.
 */
type SelectVariant = 'floating' | 'inset';

interface SelectMenuProps<T extends string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the control for assistive tech and titles the open popover. */
  ariaLabel: string;
  /** Leading glyph on the trigger; signals the category the chip filters. */
  Icon: LucideIcon;
  variant?: SelectVariant;
}

/**
 * A filter presented as a value chip that opens a popover list, replacing the
 * segmented toggle where a row of pills grew too wide. One chip shows the
 * current choice; the option set lives in the popover, so adding values grows
 * the list downward instead of stretching the row. Reuses the shared
 * `.menu-*` popover styling so it matches the location and overlay menus.
 */
export function SelectMenu<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  Icon,
  variant = 'floating',
}: SelectMenuProps<T>) {
  const [isOpen, setOpen] = useState(false);
  const current = options.find((option) => option.id === value);

  // Escape closes the popover - the backdrop only covers pointer dismissal.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <div className="select-menu">
      <button
        type="button"
        className={`select-chip${variant === 'inset' ? ' select-chip--inset' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className="select-chip-icon" size={16} strokeWidth={2.2} aria-hidden />
        <span className="select-chip-value">{current?.label ?? 'Select'}</span>
        <ChevronDown className="select-chip-caret" size={15} aria-hidden />
      </button>
      {isOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-popover" role="menu" aria-label={ariaLabel}>
            <p className="menu-popover-title">{ariaLabel}</p>
            {options.map((option) => {
              const isActive = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`menu-item${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="menu-item-icon" aria-hidden>
                    {isActive && <Check size={18} strokeWidth={2.4} />}
                  </span>
                  <span className="menu-item-text">
                    <span className="menu-item-label">{option.label}</span>
                    {option.hint && <span className="menu-item-hint">{option.hint}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
