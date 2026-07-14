import type { OverlayMode } from '../../state/store';

/** One data sample fed into the interpolation. */
export interface FieldPoint {
  lon: number;
  lat: number;
  sun: number; // 0–100 sun score
  wet: number; // 0–100 cloud+rain
}

export interface FieldImage {
  url: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
}

// Grid the field is rasterized at. MapLibre linearly upsamples it to the screen,
// so a modest grid still reads perfectly smooth.
const GRID = 96;
const BASE_ALPHA = 0.6;
// Fraction of the grid, at each border, over which the field fades fully out.
const EDGE_FADE = 0.14;

/**
 * Smoothstep envelope that drives the grid's outer frame to fully transparent,
 * so the rasterized field always dissolves into the map rather than ending on
 * the image's hard rectangular border. Returns 0 at the very edge and ramps to
 * 1 once past the fade band. Pure (no canvas) so it is unit-testable.
 */
export function edgeEnvelope(x: number, y: number, grid: number): number {
  const fx = Math.min(x, grid - 1 - x) / (grid - 1); // 0 at a border cell → 0.5 mid-grid
  const fy = Math.min(y, grid - 1 - y) / (grid - 1);
  const e = Math.min(fx, fy) / EDGE_FADE;
  if (e <= 0) return 0;
  if (e >= 1) return 1;
  return e * e * (3 - 2 * e);
}

type Rgb = [number, number, number];

// Smooth value→color ramps. Sun mirrors the score bands used by the pins;
// rain runs pale → deep blue.
const SUN_RAMP: [number, Rgb][] = [
  [0, [160, 154, 146]],
  [40, [227, 195, 106]],
  [60, [243, 182, 60]],
  [80, [240, 140, 0]],
  [100, [240, 140, 0]],
];
const RAIN_RAMP: [number, Rgb][] = [
  [0, [207, 224, 239]],
  [35, [143, 186, 223]],
  [70, [74, 134, 197]],
  [100, [43, 95, 156]],
];

function ramp(stops: [number, Rgb][], v: number): Rgb {
  if (v <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (v >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [v0, c0] = stops[i - 1];
      const [v1, c1] = stops[i];
      const t = (v - v0) / (v1 - v0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return last[1];
}

/**
 * Inverse-distance-weighted interpolation of the scored points into a smooth,
 * gap-filling field rendered to a data-URL image. Colour encodes the value;
 * alpha fades out where no data is near (a Gaussian on distance-to-nearest),
 * so the field covers the populated area and dissolves at its edges rather than
 * ending in a hard rectangle. Returns null when there is nothing to draw.
 */
export function computeFieldImage(points: FieldPoint[], mode: OverlayMode): FieldImage | null {
  if (mode === 'off' || points.length < 2) return null;
  const useWet = mode === 'rain';
  const stops = useWet ? RAIN_RAMP : SUN_RAMP;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  // Pad the bounds so the field breathes past the outermost cities.
  const marginLon = (maxLon - minLon) * 0.12 + 0.4;
  const marginLat = (maxLat - minLat) * 0.12 + 0.4;
  minLon -= marginLon;
  maxLon += marginLon;
  minLat -= marginLat;
  maxLat += marginLat;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;

  // Coverage falloff radius (degrees), scaled to how spread out the data is.
  const sigma = Math.min(1.6, Math.max(0.4, Math.max(lonSpan, latSpan) * 0.09));
  const twoSigma2 = 2 * sigma * sigma;
  // Scale longitude by cos(lat) so distances are roughly isotropic.
  const lonScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(GRID, GRID);
  const data = img.data;

  for (let y = 0; y < GRID; y++) {
    const lat = maxLat - ((y + 0.5) / GRID) * latSpan;
    for (let x = 0; x < GRID; x++) {
      const lon = minLon + ((x + 0.5) / GRID) * lonSpan;
      let wsum = 0;
      let vsum = 0;
      let dmin2 = Infinity;
      for (const p of points) {
        const dLon = (lon - p.lon) * lonScale;
        const dLat = lat - p.lat;
        const d2 = dLon * dLon + dLat * dLat;
        if (d2 < dmin2) dmin2 = d2;
        const w = 1 / (d2 + 1e-4);
        wsum += w;
        vsum += w * (useWet ? p.wet : p.sun);
      }
      const value = wsum > 0 ? vsum / wsum : 0;
      const coverage = Math.exp(-dmin2 / twoSigma2);
      // Fill the whole covered area, but let higher values read stronger, and
      // force the image's own edges to zero so it never shows a hard rectangle.
      const alpha =
        BASE_ALPHA * coverage * (0.45 + 0.55 * (value / 100)) * edgeEnvelope(x, y, GRID);
      const [r, g, b] = ramp(stops, value);
      const idx = (y * GRID + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    url: canvas.toDataURL(),
    coordinates: [
      [minLon, maxLat],
      [maxLon, maxLat],
      [maxLon, minLat],
      [minLon, minLat],
    ],
  };
}
