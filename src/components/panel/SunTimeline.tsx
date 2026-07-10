import { useRef, useState } from 'react';
import type { HourPoint } from '../../core/weather/hourly';
import { formatTemp } from '../../lib/format';

const RAIN_THRESHOLD = 40;

function hourColor(point: HourPoint): string {
  if (!point.isDay) return 'rgba(43, 33, 21, 0.14)';
  // daylight: blend gray (overcast) → gold (clear) by cloud cover
  const clearness = 1 - point.cloud / 100;
  const gray = { r: 190, g: 185, b: 178 };
  const gold = { r: 242, g: 179, b: 61 };
  const r = Math.round(gray.r + (gold.r - gray.r) * clearness);
  const g = Math.round(gray.g + (gold.g - gray.g) * clearness);
  const b = Math.round(gray.b + (gold.b - gray.b) * clearness);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * 24 hour cells: night is dark, day blends gray→gold by clearness, rain gets a
 * blue underline. Tap or drag across the bar (or hover on desktop) to read any
 * hour's cloud, rain, and temperature — the hover-only tooltip left touch users
 * with no way to see the hourly breakdown.
 */
export function SunTimeline({ hours }: { hours: HourPoint[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeHour, setActiveHour] = useState<number | null>(null);

  if (hours.length === 0) return null;

  const active = activeHour === null ? null : (hours.find((h) => h.hour === activeHour) ?? null);

  const scrubToClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const index = Math.max(0, Math.min(hours.length - 1, Math.floor(ratio * hours.length)));
    setActiveHour(hours[index].hour);
  };

  return (
    <div className="sun-timeline">
      <div className="sun-timeline-readout" aria-live="polite">
        {active ? (
          <>
            <span className="sun-timeline-readout-dot" style={{ background: hourColor(active) }} aria-hidden />
            <span className="sun-timeline-readout-time">{formatHour(active.hour)}</span>
            <span className="sun-timeline-readout-stats">
              {active.isDay ? `${active.cloud}% cloud` : 'Night'} · {active.precipProb}% rain ·{' '}
              {formatTemp(active.temp)}
            </span>
          </>
        ) : (
          <span className="sun-timeline-readout-hint">Tap the bar for any hour</span>
        )}
      </div>
      <div
        ref={trackRef}
        className="sun-timeline-track"
        role="group"
        aria-label="Hour by hour sky, cloud and rain"
        onPointerDown={(e) => scrubToClientX(e.clientX)}
        onPointerMove={(e) => scrubToClientX(e.clientX)}
        onPointerLeave={(e) => {
          // Clear on mouse-out for desktop, but keep the tapped hour on touch.
          if (e.pointerType === 'mouse') setActiveHour(null);
        }}
      >
        {hours.map((point) => (
          <button
            type="button"
            key={point.hour}
            className={`sun-timeline-cell${point.hour === activeHour ? ' is-active' : ''}`}
            style={{ background: hourColor(point) }}
            aria-label={`${formatHour(point.hour)}: ${
              point.isDay
                ? `${point.cloud}% cloud, ${point.precipProb}% rain, ${formatTemp(point.temp)}`
                : 'night'
            }`}
            onFocus={() => setActiveHour(point.hour)}
            onClick={() => setActiveHour(point.hour)}
          >
            {point.precipProb >= RAIN_THRESHOLD && point.isDay && <span className="sun-timeline-rain" />}
          </button>
        ))}
      </div>
      <div className="sun-timeline-scale" aria-hidden>
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}
