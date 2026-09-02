import * as Cesium from 'cesium';
import { VariableKey } from '../types/ocean';
import type { ColorMode, ColorScaleMode } from '../store/useOceanStore';

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

// Chlorophyll-a colormap: Deep blue (oligotrophic) -> teal -> green -> lime (bloom)
const CHLOROPHYLL_STOPS: [number, [number, number, number]][] = [
  [0.0, [12, 74, 110]],
  [0.2, [14, 165, 233]],
  [0.4, [16, 185, 129]],
  [0.7, [22, 163, 74]],
  [1.0, [132, 204, 22]]
];
// Intuitive colormap: Blue (Cold/Low) -> White -> Red (Hot/High)
const INTUITIVE_STOPS: [number, [number, number, number]][] = [
  [0.0, [0, 76, 204]],     // Deep Blue
  [0.25, [102, 178, 255]], // Light Blue
  [0.5, [230, 230, 230]],  // White/Grey
  [0.75, [255, 102, 102]], // Light Red
  [1.0, [204, 0, 0]]       // Deep Red
];

// Anomaly colormap: Red for positive anomaly, Blue for negative (diverging)
const ANOMALY_STOPS: [number, [number, number, number]][] = [
  [0.0, [25, 25, 204]],    // Strong Negative (Blue)
  [0.25, [120, 120, 255]], // Weak Negative
  [0.5, [240, 240, 240]],  // Mean (White)
  [0.75, [255, 120, 120]], // Weak Positive
  [1.0, [204, 25, 25]]     // Strong Positive (Red)
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
  maxVal: number,
  colorMode: ColorMode = 'scientific',
  colorScaleMode: ColorScaleMode = 'linear'
): { r: number; g: number; b: number; hex: string; cesiumColor: Cesium.Color } {
  let norm = 0;
  
  if (colorScaleMode === 'log') {
    // Avoid log(<=0)
    const safeMin = Math.max(0.001, minVal);
    const safeVal = Math.max(0.001, value);
    const safeMax = Math.max(0.002, maxVal);
    norm = (Math.log10(safeVal) - Math.log10(safeMin)) / (Math.log10(safeMax) - Math.log10(safeMin));
  } else {
    norm = (value - minVal) / (maxVal - minVal || 1);
  }

  let stops = TURBO_STOPS;

  if (colorMode === 'intuitive') {
    stops = INTUITIVE_STOPS;
  } else if (colorMode === 'anomaly') {
    stops = ANOMALY_STOPS;
  } else {
    // Scientific modes
    if (variable === 'salinity') stops = HALINE_STOPS;
    else if (variable === 'density') stops = VIRIDIS_STOPS;
    else if (variable === 'current_speed') stops = SPEED_STOPS;
    else if (variable === 'chlorophyll') stops = CHLOROPHYLL_STOPS;
  }

  const [r, g, b] = interpolateStops(norm, stops);
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  const cesiumColor = new Cesium.Color(r / 255, g / 255, b / 255, 0.85);

  return { r, g, b, hex, cesiumColor };
}

export function getLegendGradient(
  variable: VariableKey, 
  colorMode: ColorMode = 'scientific'
): string {
  let stops = TURBO_STOPS;
  
  if (colorMode === 'intuitive') {
    stops = INTUITIVE_STOPS;
  } else if (colorMode === 'anomaly') {
    stops = ANOMALY_STOPS;
  } else {
    if (variable === 'salinity') stops = HALINE_STOPS;
    else if (variable === 'density') stops = VIRIDIS_STOPS;
    else if (variable === 'current_speed') stops = SPEED_STOPS;
    else if (variable === 'chlorophyll') stops = CHLOROPHYLL_STOPS;
  }

  const cssStops = stops.map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${Math.round(t * 100)}%`).join(', ');
  return `linear-gradient(to right, ${cssStops})`;
}

