import { Landmark } from 'lucide-react';
import type { PointOfInterest } from '../../core/poi/wikipedia';
import type { LatLon } from '../../core/types';
import { useNearbyPoi } from '../../hooks/useNearbyPoi';
import { formatDistance } from '../../lib/format';

const M_PER_KM = 1000;

function PoiCard({ poi }: { poi: PointOfInterest }) {
  return (
    <a className="poi-card" href={poi.url} target="_blank" rel="noopener noreferrer">
      <span className="poi-thumb">
        {poi.thumbnail ? (
          <img src={poi.thumbnail} alt="" width={132} height={88} loading="lazy" />
        ) : (
          <span className="poi-thumb-fallback" aria-hidden>
            <Landmark size={20} strokeWidth={1.8} />
          </span>
        )}
      </span>
      <span className="poi-title">{poi.title}</span>
      <span className="poi-dist">{formatDistance(poi.distanceM / M_PER_KM)}</span>
    </a>
  );
}

/**
 * A compact, horizontally scrolling row of nearby Wikipedia attractions - context
 * beyond the weather for a city or pin. Shows a loading hint while fetching, then
 * renders nothing on empty or error so it degrades silently.
 */
export function NearbyPoi({ coords }: { coords: LatLon }) {
  const { poi, isLoading, isError } = useNearbyPoi(coords);

  if (isLoading) {
    return (
      <section className="poi">
        <div className="poi-head">
          <Landmark size={16} strokeWidth={2} aria-hidden /> Nearby attractions
        </div>
        <p className="poi-note">Finding nearby places…</p>
      </section>
    );
  }

  if (isError || poi.length === 0) return null;

  return (
    <section className="poi" aria-label="Nearby attractions">
      <div className="poi-head">
        <Landmark size={16} strokeWidth={2} aria-hidden /> Nearby attractions
      </div>
      <div className="poi-row">
        {poi.map((p) => (
          <PoiCard key={p.pageId} poi={p} />
        ))}
      </div>
    </section>
  );
}
