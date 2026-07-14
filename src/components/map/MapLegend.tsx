import { SCORE_STOPS } from '../../lib/scoreColor';
import { scoreWord } from '../../lib/scoreLabel';
import { useIsMobile } from '../../hooks/useMediaQuery';

/**
 * Colour bands taken straight from the shared score stops, so the key can never
 * drift from the pin colours it explains. Each band's plain word comes from the
 * same score->word table the cards use.
 */
const LEGEND_BANDS = SCORE_STOPS.map((stop) => ({
  color: stop.color,
  word: scoreWord(stop.min),
}));

/** Hard-stepped gradient (no blending) so the bar reads as the same discrete
 *  bands the map paints, not a smooth ramp that implies in-between colours. */
const SCALE_GRADIENT = `linear-gradient(90deg, ${LEGEND_BANDS.map((band, i) => {
  const from = Math.round((i / LEGEND_BANDS.length) * 100);
  const to = Math.round(((i + 1) / LEGEND_BANDS.length) * 100);
  return `${band.color} ${from}% ${to}%`;
}).join(', ')})`;

const LOW_WORD = LEGEND_BANDS[0].word;
const HIGH_WORD = LEGEND_BANDS[LEGEND_BANDS.length - 1].word;

/**
 * Unobtrusive key for the map's score colours, shown at the bottom of the map
 * next to the results panel. Desktop only: on mobile the results drawer covers
 * the bottom of the screen and there is no clean spot to float it, so it hides.
 */
export function MapLegend() {
  const isMobile = useIsMobile();
  if (isMobile) return null;

  return (
    <div className="map-legend">
      <div className="map-legend-card">
        <p className="map-legend-title">Sunny score</p>
        <span className="map-legend-scale" style={{ background: SCALE_GRADIENT }} aria-hidden />
        <div className="map-legend-ends" aria-hidden>
          <span>{LOW_WORD}</span>
          <span>{HIGH_WORD}</span>
        </div>
        <span className="visually-hidden">
          Pin colours run from {LOW_WORD} at the low end of the sunny score to {HIGH_WORD} at the
          high end.
        </span>
      </div>
    </div>
  );
}
