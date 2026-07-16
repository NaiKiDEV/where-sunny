import { useMemo } from 'react';
import { CloudMoon, MoonStar } from 'lucide-react';
import { meteorNote } from '../../core/night/meteors';
import { moonPhaseLabel, nightSkyOutlook } from '../../core/night/nightSky';
import type { LatLon } from '../../core/types';
import type { HourPoint } from '../../core/weather/hourly';

interface NightSkyNoteProps {
  /** Hourly forecast grouped by date, straight from usePlaceInsight. */
  hoursByDate: Map<string, HourPoint[]>;
  /** Selected day (YYYY-MM-DD); the note covers the night starting that evening. */
  date: string;
  /** Place coordinates (a Place works - it extends LatLon). */
  coords: LatLon;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * One quiet night-sky line derived entirely from already-fetched hourly data.
 * Clear nights get the stargazing pitch ("Clear night sky 22:00–03:00 ·
 * waning crescent"); cloudy nights still state the condition and the moon, so
 * the row is always there to answer "and after sunset?". Hides only when
 * there is no night to describe (hourly not loaded, or polar day). Zero
 * network calls. When a major meteor shower is active and the night is at
 * least fairly clear, one extra sentence flags it (see core/night/meteors).
 */
export function NightSkyNote({ hoursByDate, date, coords }: NightSkyNoteProps) {
  const { lat, lon } = coords;
  const outlook = useMemo(() => {
    const hours = [...hoursByDate.values()].flat();
    return nightSkyOutlook(hours, date, { lat, lon });
  }, [hoursByDate, date, lat, lon]);

  if (outlook.darkHours === 0) return null;

  const moon = moonPhaseLabel(outlook.moonPhase);
  // Null unless a shower is active, visible from this latitude, and the
  // night's verdict is at least decent - so cloudy nights change nothing.
  const meteor = meteorNote(date, coords.lat, outlook);
  const isClear = outlook.clearWindow !== undefined;
  const Icon = isClear ? MoonStar : CloudMoon;

  return (
    <p className="night-sky-note">
      <Icon size={16} strokeWidth={2} aria-hidden />
      <span>
        {outlook.clearWindow ? (
          <>
            {outlook.band === 'great' ? 'Clear night sky' : 'Fairly clear night'}{' '}
            {formatHour(outlook.clearWindow.from)}–{formatHour(outlook.clearWindow.to)} · {moon}
            {meteor !== null && <> · {meteor}</>}
          </>
        ) : (
          <>
            {outlook.avgCloudCover >= 80 ? 'Overcast night' : 'Cloudy night'} · {moon}
          </>
        )}
      </span>
    </p>
  );
}
