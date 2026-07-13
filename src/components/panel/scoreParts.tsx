import { Cloud, CloudRain, Sun, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import type { ScorePartId } from '../../core/scoring/explain';

export interface ScorePartMeta {
  label: string;
  Icon: LucideIcon;
  /** Class for the factor's colour bar; shared by the receipt and the explainer. */
  barClass: string;
}

/**
 * One home for each factor's label, icon, and bar colour, so the per-day score
 * receipt (ScoreBreakdown) and the "how it works" explainer never disagree on
 * what a factor is called or how it looks.
 */
export const SCORE_PART_META: Record<ScorePartId, ScorePartMeta> = {
  sun: { label: 'Sunshine', Icon: Sun, barClass: 'breakdown-bar-sun' },
  warmth: { label: 'Warmth', Icon: Thermometer, barClass: 'breakdown-bar-warmth' },
  cloud: { label: 'Clouds', Icon: Cloud, barClass: 'breakdown-bar-cloud' },
  rain: { label: 'Rain risk', Icon: CloudRain, barClass: 'breakdown-bar-rain' },
  wind: { label: 'Wind', Icon: Wind, barClass: 'breakdown-bar-wind' },
};
