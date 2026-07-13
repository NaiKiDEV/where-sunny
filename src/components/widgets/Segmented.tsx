interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

/**
 * `floating` (default) is the translucent, blurred, drop-shadowed chip meant to
 * hover over the map. `inset` is a flat, recessed track for use inside solid
 * surfaces (menus, panels) where the floating cues look out of place.
 */
type SegmentedVariant = 'floating' | 'inset';

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: SegmentedVariant;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = 'floating',
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`segmented${variant === 'inset' ? ' segmented--inset' : ''}`}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          className={`segmented-option${option.id === value ? ' is-active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
