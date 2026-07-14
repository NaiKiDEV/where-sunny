import { useMemo } from 'react';
import { Compass } from 'lucide-react';
import type { CuratedDestination } from '../../core/discovery/destinations';
import { visibleDestinations } from '../../core/discovery/destinations';
import { useBannedFilter } from '../../hooks/useBannedFilter';
import { countryFlag } from '../../lib/format';
import { useAppStore } from '../../state/store';

/** Preserve first-seen region order so groups render in the curated sequence. */
function groupByRegion(items: CuratedDestination[]): [string, CuratedDestination[]][] {
  const groups = new Map<string, CuratedDestination[]>();
  for (const item of items) {
    const bucket = groups.get(item.region);
    if (bucket) bucket.push(item);
    else groups.set(item.region, [item]);
  }
  return [...groups.entries()];
}

/**
 * Curated, ban-filtered sunny destinations for first-run users with no obvious
 * origin. Tapping a chip sets it as the map origin (labelled with the place
 * name), so the whole scoring pipeline populates from there. Reused on the
 * welcome screen and inside the explore empty state.
 */
export function SuggestedDestinations() {
  const setOrigin = useAppStore((s) => s.setOrigin);
  const { codes } = useBannedFilter();
  const groups = useMemo(() => groupByRegion(visibleDestinations(codes)), [codes]);

  if (groups.length === 0) return null;

  return (
    <section className="suggest" aria-label="Suggested sunny destinations">
      <p className="suggest-head">
        <Compass size={15} strokeWidth={2} aria-hidden />
        Not sure where? Start somewhere sunny
      </p>
      {groups.map(([region, items]) => (
        <div className="suggest-group" key={region}>
          <p className="suggest-region">{region}</p>
          <div className="suggest-chips">
            {items.map((d) => (
              <button
                key={`${d.countryCode}-${d.name}`}
                type="button"
                className="suggest-chip"
                title={d.blurb}
                onClick={() => setOrigin({ lat: d.lat, lon: d.lon, label: d.name })}
              >
                <span className="suggest-chip-flag" aria-hidden>
                  {countryFlag(d.countryCode)}
                </span>
                <span className="suggest-chip-name">{d.name}</span>
                <span className="suggest-chip-country">{d.country}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
