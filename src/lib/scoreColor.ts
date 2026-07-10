/** Score → color bands, shared by map layers and UI badges. */
export const SCORE_STOPS: { min: number; color: string; text: string }[] = [
  { min: 0, color: '#a09a92', text: '#ffffff' },
  { min: 40, color: '#e3c36a', text: '#4a3a16' },
  { min: 60, color: '#f3b63c', text: '#4a3a16' },
  { min: 80, color: '#f08c00', text: '#ffffff' },
];

export function scoreColor(score: number): string {
  let band = SCORE_STOPS[0];
  for (const stop of SCORE_STOPS) {
    if (score >= stop.min) band = stop;
  }
  return band.color;
}

export function scoreTextColor(score: number): string {
  let band = SCORE_STOPS[0];
  for (const stop of SCORE_STOPS) {
    if (score >= stop.min) band = stop;
  }
  return band.text;
}

/** MapLibre step expression mirroring the same bands. */
export function scoreStepExpression(property: string): unknown[] {
  const expr: unknown[] = ['step', ['get', property], SCORE_STOPS[0].color];
  for (const stop of SCORE_STOPS.slice(1)) expr.push(stop.min, stop.color);
  return expr;
}

export function scoreTextStepExpression(property: string): unknown[] {
  const expr: unknown[] = ['step', ['get', property], SCORE_STOPS[0].text];
  for (const stop of SCORE_STOPS.slice(1)) expr.push(stop.min, stop.text);
  return expr;
}
