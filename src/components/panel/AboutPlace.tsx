import { BookOpenText, ExternalLink } from 'lucide-react';
import type { Place } from '../../core/types';
import { useDestinationGuide } from '../../hooks/useDestinationGuide';

const SOURCE_LABELS = {
  wikivoyage: 'Wikivoyage',
  wikipedia: 'Wikipedia',
} as const;

interface AboutPlaceProps {
  place: Place;
}

/**
 * A short traveler intro + photo for the selected place (Wikivoyage lead,
 * Wikipedia fallback) - identity before surroundings. Shows a loading hint
 * while fetching, then renders nothing on empty or error so it degrades
 * silently. Airports are skipped: the blurb describes destinations, not
 * infrastructure.
 */
export function AboutPlace({ place }: AboutPlaceProps) {
  const isAirport = place.kind === 'airport';
  const { guide, isLoading } = useDestinationGuide(isAirport ? null : place);

  if (isAirport) return null;

  if (isLoading) {
    return (
      <section className="about-place">
        <div className="about-place-head">
          <BookOpenText size={16} strokeWidth={2} aria-hidden /> About {place.name}
        </div>
        <p className="about-place-note">Fetching an introduction…</p>
      </section>
    );
  }

  if (!guide) return null;

  return (
    <section className="about-place" aria-label={`About ${place.name}`}>
      <div className="about-place-head">
        <BookOpenText size={16} strokeWidth={2} aria-hidden /> About {place.name}
      </div>
      {guide.thumbnail && (
        <img className="about-place-photo" src={guide.thumbnail} alt="" loading="lazy" />
      )}
      <p className="about-place-text">{guide.extract}</p>
      <a
        className="about-place-link"
        href={guide.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Read more on {SOURCE_LABELS[guide.source]}
        <ExternalLink size={12} strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
