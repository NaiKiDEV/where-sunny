import { useState } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';
import {
  bestMonths,
  formatMonthRanges,
  monthName,
  monthScore,
  monthShortName,
  type ClimateNormals,
  type MonthlyNormal,
} from '../../core/climate/normals';
import { seasonNote, type SeasonNote } from '../../core/climate/season';
import type { LatLon } from '../../core/types';
import { useClimateNormals } from '../../hooks/useClimateNormals';
import { formatTempBare, type TempUnit } from '../../lib/format';
import { scoreColor } from '../../lib/scoreColor';
import { useAppStore } from '../../state/store';

/** Tallest sunshine bar in px; hours scale against a 12 h/day ceiling. */
const BAR_MAX_PX = 44;
const SUN_SCALE_HOURS = 12;
/** One rain dot per ~4 wet days, capped so the row stays tiny. */
const RAIN_DAYS_PER_DOT = 4;
const MAX_RAIN_DOTS = 4;

interface ClimateProfileProps {
  coords: LatLon;
}

function rainDotCount(rainDays: number): number {
  return Math.min(MAX_RAIN_DOTS, Math.round(rainDays / RAIN_DAYS_PER_DOT));
}

function MonthColumn({
  normal,
  unit,
  isCurrent,
}: {
  normal: MonthlyNormal;
  unit: TempUnit;
  isCurrent: boolean;
}) {
  const barPx = Math.round(
    Math.min(1, normal.sunshineHoursPerDay / SUN_SCALE_HOURS) * BAR_MAX_PX,
  );
  const title =
    `${monthName(normal.month)}: ${formatTempBare(normal.avgTmax, unit)}, ` +
    `${normal.sunshineHoursPerDay.toFixed(1)} h sun/day, ` +
    `${Math.round(normal.rainDays)} rain days`;

  return (
    <div className={isCurrent ? 'climate-col climate-col-now' : 'climate-col'} title={title}>
      <span className="climate-tmax">{formatTempBare(normal.avgTmax, unit)}</span>
      <div className="climate-bar-track">
        <div
          className="climate-bar"
          style={{ height: `${barPx}px`, background: scoreColor(monthScore(normal) * 100) }}
        />
      </div>
      <span className="climate-dots" aria-hidden>
        {Array.from({ length: rainDotCount(normal.rainDays) }, (_, i) => (
          <i key={i} className="climate-dot" />
        ))}
      </span>
      <span className="climate-month">{monthShortName(normal.month).charAt(0)}</span>
    </div>
  );
}

/**
 * "Best time to visit": a collapsed row that expands into a 12-month climate
 * profile (sunshine bar, rain dots, typical tmax) reduced from ten years of
 * archive data. Collapsed by default so the archive fetch only fires when the
 * user asks - and is then cached forever per ~11 km cell.
 */
export function ClimateProfile({ coords }: ClimateProfileProps) {
  const [expanded, setExpanded] = useState(false);
  const { normals, isLoading, isError } = useClimateNormals(coords, expanded);
  const unit = useAppStore((s) => s.unit);
  const currentMonth = new Date().getMonth() + 1;
  const season = normals ? seasonNote(normals.monthly, coords.lat) : null;

  return (
    <section className="climate" aria-label="Best time to visit">
      <button
        type="button"
        className="climate-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <CalendarRange size={16} strokeWidth={2} aria-hidden />
        Best time to visit
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={expanded ? 'climate-chevron climate-chevron-open' : 'climate-chevron'}
          aria-hidden
        />
      </button>

      {expanded && isLoading && <p className="climate-note">Reading ten years of weather…</p>}
      {expanded && isError && <p className="climate-note">Couldn&rsquo;t load climate history.</p>}

      {expanded && normals && (
        <div className="climate-body">
          <div className="climate-chart" role="img" aria-label={chartLabel(normals, unit)}>
            {normals.monthly.map((m) => (
              <MonthColumn key={m.month} normal={m} unit={unit} isCurrent={m.month === currentMonth} />
            ))}
          </div>
          <p className="climate-summary">
            Best months: <strong>{formatMonthRanges(bestMonths(normals.monthly))}</strong>
            {normals.years && (
              <span className="climate-years">
                {' '}
                · {normals.years.start}–{normals.years.end} normals
              </span>
            )}
          </p>
          {season && <p className="climate-crowds">{seasonSentence(season)}</p>}
        </div>
      )}
    </section>
  );
}

/**
 * One sentence of crowd intelligence. School-peak: the busy school window is
 * also the weather peak, so point at the shoulder months. Pleasant-peak: the
 * best weather misses the school holidays, so contrast pleasant vs busy.
 */
function seasonSentence(note: SeasonNote): string {
  const peak = formatMonthRanges(note.peakMonths);
  if (note.kind === 'school-peak') {
    const shoulders = formatMonthRanges(note.shoulderMonths);
    const verb = note.shoulderMonths.length > 1 ? 'offer' : 'offers';
    return `${peak} is peak season - warmest and busiest. ${shoulders} ${verb} similar weather with fewer crowds.`;
  }
  const school = formatMonthRanges(note.schoolMonths);
  return `${school} school holidays are the busiest - for better weather and fewer crowds, aim for ${peak}.`;
}

function chartLabel(normals: ClimateNormals, unit: TempUnit): string {
  const best = formatMonthRanges(bestMonths(normals.monthly));
  const months = normals.monthly
    .map((m) => `${monthShortName(m.month)} ${formatTempBare(m.avgTmax, unit)}`)
    .join(', ');
  return `Monthly climate profile. Best months: ${best}. Typical highs: ${months}.`;
}
