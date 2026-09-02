import type { ColorMode, ColorScaleMode } from '../store/useOceanStore';

export function generateDeltaRasterFromGrid(
  grid: number[][],
  bbox: [number, number, number, number] = [80.0, 6.0, 97.0, 22.0]
): string {
  const nLat = grid.length;
  if (nLat === 0) return '';
  const nLon = grid[0].length;
  if (nLon === 0) return '';

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;

  const PX_PER_DEG = 20;
  const width = Math.round(lonSpan * PX_PER_DEG);
  const height = Math.round(latSpan * PX_PER_DEG);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, width, height);

  const cellW = width / nLon;
  const cellH = height / nLat;

  for (let r = 0; r < nLat; r++) {
    for (let c = 0; c < nLon; c++) {
      const val = grid[r][c]; // -1.0 to +1.0
      const absVal = Math.abs(val);
      if (absVal < 0.08) continue; // omit negligible neutral zone

      // Smooth alpha ramp
      const alpha = Math.min(0.85, (absVal - 0.08) / 0.7 * 0.85);

      // Diverging colormap: val < 0 is Cyan (cooling/drop), val > 0 is Magenta/Rose (warming/surge)
      let rCol = 0;
      let gCol = 0;
      let bCol = 0;

      if (val < 0) {
        // Cyan / Blue: #06b6d4 to #3b82f6
        const norm = Math.min(1.0, absVal);
        rCol = Math.round(6 + (59 - 6) * norm);
        gCol = Math.round(182 + (130 - 182) * norm);
        bCol = Math.round(212 + (246 - 212) * norm);
      } else {
        // Magenta / Rose: #f43f5e to #ec4899
        const norm = Math.min(1.0, absVal);
        rCol = Math.round(244 + (236 - 244) * norm);
        gCol = Math.round(63 + (72 - 63) * norm);
        bCol = Math.round(94 + (153 - 94) * norm);
      }

      ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, ${alpha})`;

      // r=0 is South (bottom of domain, so top in canvas y is inverted)
      const canvasY = height - (r + 1) * cellH;
      const canvasX = c * cellW;

      ctx.fillRect(Math.floor(canvasX), Math.floor(canvasY), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
    }
  }

  // Smooth Gaussian blur for seamless continuous field aesthetic
  const blurredCanvas = document.createElement('canvas');
  blurredCanvas.width = width;
  blurredCanvas.height = height;
  const bCtx = blurredCanvas.getContext('2d');
  if (!bCtx) return canvas.toDataURL('image/png');

  bCtx.filter = 'blur(4px)';
  bCtx.drawImage(canvas, 0, 0);
  bCtx.filter = 'none';

  return blurredCanvas.toDataURL('image/png');
}

export function extractHotspotsFromGrid(
  grid: number[][],
  bbox: [number, number, number, number] = [80.0, 6.0, 97.0, 22.0]
): { lon: number; lat: number; delta: number; norm_delta: number }[] {
  const nLat = grid.length;
  if (nLat === 0) return [];
  const nLon = grid[0].length;
  if (nLon === 0) return [];

  const [minLon, minLat, maxLon, maxLat] = bbox;

  const candidates: { lon: number; lat: number; delta: number; norm_delta: number }[] = [];

  for (let r = 0; r < nLat; r++) {
    for (let c = 0; c < nLon; c++) {
      const val = grid[r][c];
      const absVal = Math.abs(val);
      if (absVal > 0.35) {
        const lat = minLat + (r / (nLat - 1)) * (maxLat - minLat);
        const lon = minLon + (c / (nLon - 1)) * (maxLon - minLon);
        candidates.push({ lon, lat, delta: val, norm_delta: absVal });
      }
    }
  }

  candidates.sort((a, b) => b.norm_delta - a.norm_delta);

  // Spatial deduplication: at least 2.5 degrees apart
  const hotspots: { lon: number; lat: number; delta: number; norm_delta: number }[] = [];
  for (const cand of candidates) {
    if (hotspots.length >= 3) break;
    const tooClose = hotspots.some(h => Math.hypot(h.lon - cand.lon, h.lat - cand.lat) < 2.5);
    if (!tooClose) hotspots.push(cand);
  }

  return hotspots;
}

export function generateRasterFromPoints(
  points: any[],
  variable: string,
  minVal: number,
  maxVal: number,
  getColorForValue: (val: number, variable: string, min: number, max: number, cMode: ColorMode, sMode: ColorScaleMode) => { hex: string },
  bbox: [number, number, number, number] = [80.0, 6.0, 97.0, 22.0],
  colorMode: ColorMode = 'scientific',
  colorScaleMode: ColorScaleMode = 'linear',
  isDelta: boolean = false
): string {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;

  // 20px per degree gives a clean, sharp raster at typical ocean data resolution (0.5° grid)
  const PX_PER_DEG = 20;
  const width = Math.round(lonSpan * PX_PER_DEG);
  const height = Math.round(latSpan * PX_PER_DEG);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Transparent background — Cesium globe shows through empty ocean cells
  ctx.clearRect(0, 0, width, height);

  // Draw each data point as a square tile
  // globalAlpha set once, reset after
  ctx.globalAlpha = 0.72;
  const cellPx = PX_PER_DEG * 0.5 + 1; // half-degree cell with 1px overlap for seamless tiling

  points.forEach(pt => {
    // Skip out-of-bounds points gracefully
    if (pt.lon < minLon || pt.lon > maxLon || pt.lat < minLat || pt.lat > maxLat) return;

    if (isDelta) {
      if (pt.norm_delta == null) return;
      const d = pt.norm_delta;
      if (d < 0.05) return;
      
      // Transparent -> Orange -> White-hot ramp
      let r = 255;
      let g = 255 * Math.pow(d, 2); // stays lower until d is high
      if (d < 0.5) {
         g = 128 * (d / 0.5); // ramp up to orange
      } else {
         g = 128 + 127 * ((d - 0.5) / 0.5); // orange to white
      }
      let b = d < 0.8 ? 0 : 255 * ((d - 0.8) / 0.2); // yellow/white at the very end
      
      const alpha = Math.min(d * 1.5, 0.7); // Cap opacity at 0.7
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      const x = ((pt.lon - minLon) / lonSpan) * width;
      const y = ((maxLat - pt.lat) / latSpan) * height;
      ctx.fillRect(Math.floor(x - cellPx / 2), Math.floor(y - cellPx / 2), Math.ceil(cellPx), Math.ceil(cellPx));
      return;
    }

    let val = pt.temp;
    if (variable === 'salinity') val = pt.psal ?? pt.salinity;
    else if (variable === 'density') val = pt.density;
    else if (variable === 'current_speed') val = pt.speed;
    else if (variable === 'chlorophyll') val = pt.chlorophyll;

    if (val == null || isNaN(val)) return;

    const { hex } = getColorForValue(val, variable, minVal, maxVal, colorMode, colorScaleMode);

    // Map lon/lat to canvas pixel (lat is inverted: y=0 is top = maxLat)
    const x = ((pt.lon - minLon) / lonSpan) * width;
    const y = ((maxLat - pt.lat) / latSpan) * height;

    ctx.fillStyle = hex;
    ctx.fillRect(Math.floor(x - cellPx / 2), Math.floor(y - cellPx / 2), Math.ceil(cellPx), Math.ceil(cellPx));
  });

  ctx.globalAlpha = 1.0;

  // Apply a gentle Gaussian blur for smooth ocean-fabric aesthetic
  // This is done via CSS filter on the canvas context (supported in all modern browsers)
  // We re-draw onto a second canvas with blur applied
  const blurredCanvas = document.createElement('canvas');
  blurredCanvas.width = width;
  blurredCanvas.height = height;
  const bCtx = blurredCanvas.getContext('2d');
  if (!bCtx) return canvas.toDataURL('image/png');

  bCtx.filter = 'blur(3px)';
  bCtx.drawImage(canvas, 0, 0);
  bCtx.filter = 'none';

  return blurredCanvas.toDataURL('image/png');
}
