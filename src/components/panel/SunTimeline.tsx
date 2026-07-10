import type { HourPoint } from '../../core/weather/hourly';

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

/** 24 hour cells: night is dark, day blends gray→gold by clearness, rain gets a blue underline. */
export function SunTimeline({ hours }: { hours: HourPoint[] }) {
  if (hours.length === 0) return null;
  return (
    <div className="sun-timeline">
      <div className="sun-timeline-track">
        {hours.map((point) => (
          <div
            key={point.hour}
            className="sun-timeline-cell"
            style={{ background: hourColor(point) }}
            title={`${String(point.hour).padStart(2, '0')}:00 — ${point.cloud}% cloud, ${point.precipProb}% rain`}
          >
            {point.precipProb >= RAIN_THRESHOLD && point.isDay && <span className="sun-timeline-rain" />}
          </div>
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
