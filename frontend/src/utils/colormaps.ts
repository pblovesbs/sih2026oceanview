import * as Cesium from 'cesium';
import { VariableKey } from '../types/ocean';

// Colormap stops [ratio (0..1), [r, g, b]]
// Turbo colormap: excellent for ocean temperature
const TURBO_STOPS: [number, [number, number, number]][] = [
  [0.0, [48, 18, 59]],
  [0.15, [70, 134, 251]],
  [0.35, [27, 229, 181]],
  [0.55, [164, 252, 60]],
  [0.75, [251, 185, 56]],
  [0.9, [227, 68, 34]],
  [1.0, [122, 4, 3]]
];

// Haline / Salinity colormap: blue to green to yellow
const HALINE_STOPS: [number, [number, number, number]][] = [
  [0.0, [33, 43, 107]],
  [0.2, [41, 102, 172]],
  [0.4, [43, 163, 168]],
  [0.6, [74, 201, 126]],
  [0.8, [184, 222, 67]],
  [1.0, [253, 231, 37]]
];

// Density colormap (Viridis): purple to teal to yellow
const VIRIDIS_STOPS: [number, [number, number, number]][] = [
  [0.0, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5, [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1.0, [253, 231, 37]]
];

// Current Speed colormap (Electric Cyan to Neon Pink/Red)
const SPEED_STOPS: [number, [number, number, number]][] = [
  [0.0, [14, 116, 144]],
  [0.25, [6, 182, 212]],
  [0.5, [16, 185, 129]],
  [0.75, [245, 158, 11]],
  [1.0, [239, 68, 68]]
];

function interpolateStops(t: number, stops: [number, [number, number, number]][]): [number, number, number] {
  const clampedT = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (clampedT >= t0 && clampedT <= t1) {
      const f = (clampedT - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + f * (c1[0] - c0[0])),
        Math.round(c0[1] + f * (c1[1] - c0[1])),
        Math.round(c0[2] + f * (c1[2] - c0[2]))
      ];
    }
  }
  return stops[stops.length - 1][1];
}

export function getColorForValue(
  value: number,
  variable: VariableKey,
  minVal: number,
  maxVal: number
): { r: number; g: number; b: number; hex: string; cesiumColor: Cesium.Color } {
  const norm = (value - minVal) / (maxVal - minVal || 1);
  let stops = TURBO_STOPS;

  if (variable === 'salinity') stops = HALINE_STOPS;
  else if (variable === 'density') stops = VIRIDIS_STOPS;
  else if (variable === 'current_speed') stops = SPEED_STOPS;

  const [r, g, b] = interpolateStops(norm, stops);
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  const cesiumColor = new Cesium.Color(r / 255, g / 255, b / 255, 0.85);

  return { r, g, b, hex, cesiumColor };
}

export function getLegendGradient(variable: VariableKey): string {
  let stops = TURBO_STOPS;
  if (variable === 'salinity') stops = HALINE_STOPS;
  else if (variable === 'density') stops = VIRIDIS_STOPS;
  else if (variable === 'current_speed') stops = SPEED_STOPS;

  const cssStops = stops.map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${Math.round(t * 100)}%`).join(', ');
  return `linear-gradient(to right, ${cssStops})`;
}
