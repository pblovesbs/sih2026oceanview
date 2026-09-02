import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import {
  X,
  Activity,
  Compass,
  Anchor,
  Thermometer,
  Droplets,
  Database,
  Layers,
  RotateCcw,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Square,
  Expand,
  Sparkles,
  GripHorizontal,
  Box,
  Leaf,
  MoveVertical,
  Eye,
  Waves,
  CircleDot,
  ScrollText,
  ChevronDown,
  Check
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import { FloatSummary, FloatProfile, SliceData, VariableKey, OceanMetadata } from '../types/ocean';
import { FloatHologram } from './FloatHologram';
import { generateIsopycnals, computeSigmaTheta, classifyWaterMass, computeDCMChlorophyll } from '../utils/oceanPhysics';

// Custom high-precision tooltip for profile LineCharts
const CustomProfileTooltip = ({ active, payload, activeTab }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (!data) return null;
    return (
      <div className="bg-slate-950/95 border border-cyan-500/40 p-2.5 rounded-xl shadow-2xl backdrop-blur-xl font-mono text-xs z-50 pointer-events-none">
        <div className="text-cyan-300 font-bold text-xs flex items-center gap-1.5 border-b border-white/10 pb-1 mb-1">
          <span className="text-slate-400">Depth:</span>
          <span className="text-white font-bold">{data.depth}m</span>
        </div>
        {activeTab === 'temp' && (
          <div className="text-rose-400 font-semibold text-xs">Temp: {data.temp?.toFixed(2)}°C</div>
        )}
        {activeTab === 'salinity' && (
          <div className="text-sky-400 font-semibold text-xs">Salinity: {data.salinity?.toFixed(2)} PSU</div>
        )}
        {activeTab === 'density' && (
          <div className="text-emerald-400 font-semibold text-xs">Density: {data.density?.toFixed(2)} kg/m³</div>
        )}
        {activeTab === 'chlorophyll' && (
          <div className="text-green-400 font-semibold text-xs">Chl-a: {data.chlorophyll?.toFixed(3)} mg/m³</div>
        )}
        {data.sigmaTheta && (
          <div className="text-[10px] text-purple-300/80 mt-1">σ_θ: {data.sigmaTheta} ({data.waterMassCode || 'Bay Water'})</div>
        )}
      </div>
    );
  }
  return null;
};

// Custom high-precision tooltip for T-S ScatterChart
const CustomTSTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (!data || typeof data.salinity !== 'number') return null;
    return (
      <div className="bg-slate-950/95 border border-purple-500/40 p-2.5 rounded-xl shadow-2xl backdrop-blur-xl font-mono text-xs z-50 max-w-xs pointer-events-none">
        <div className="text-purple-300 font-bold text-xs flex items-center justify-between border-b border-white/10 pb-1 mb-1 gap-2">
          <span>Depth: {data.depth}m</span>
          <span className="text-white bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/30 text-[10px]">{data.waterMassCode}</span>
        </div>
        <div className="text-slate-300 text-xs">Temp: <strong className="text-rose-400">{data.temp?.toFixed(2)}°C</strong></div>
        <div className="text-slate-300 text-xs">Salinity: <strong className="text-sky-400">{data.salinity?.toFixed(2)} PSU</strong></div>
        <div className="text-slate-300 text-xs">Density (σ_θ): <strong className="text-emerald-400">{data.sigmaTheta} kg/m³</strong></div>
        {data.waterMassDesc && (
          <div className="text-[10px] text-purple-300/70 mt-1 italic leading-tight">{data.waterMassDesc}</div>
        )}
      </div>
    );
  }
  return null;
};

interface InspectionPanelProps {
  selectedFloat: FloatSummary | null;
  profile: FloatProfile | null;
  allProfiles?: { profile: FloatProfile; summary: FloatSummary }[];
  loading: boolean;
  onClose: () => void;
  metadata: OceanMetadata | null;
  getSlice: (depth: number, timeIdx: number, variable: VariableKey) => SliceData | undefined;
  visitedFloats: Set<string>;
  onReplayCinematic: () => void;
}

export const InspectionPanel: React.FC<InspectionPanelProps> = ({
  selectedFloat,
  profile,
  allProfiles = [],
  loading,
  onClose,
  metadata,
  getSlice,
  visitedFloats,
  onReplayCinematic,
}) => {
  const [activeTab, setActiveTab] = useState<'temp' | 'salinity' | 'density' | 'chlorophyll' | 'ts' | 'summary'>('summary');
  const [isFirstView, setIsFirstView] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Layout states
  const [pos, setPos] = useState({ x: 50, y: 100 });
  const [size, setSize] = useState({ width: 980, height: 620 });
  const [splitRatio, setSplitRatio] = useState(0.48); // Left panel width ratio

  // Stores
  const hoveredDepth = useOceanStore((s) => s.hoveredDepth);
  const setHoveredDepthStore = useOceanStore((s) => s.setHoveredDepth);
  const hologramMode = useOceanStore((s) => s.hologramMode);
  const setHologramMode = useOceanStore((s) => s.setHologramMode);
  const currentDepth = useOceanStore((s) => s.currentDepth);
  const setCurrentDepth = useOceanStore((s) => s.setCurrentDepth);
  const selectedVariable = useOceanStore((s) => s.selectedVariable);
  const setSelectedVariable = useOceanStore((s) => s.setSelectedVariable);

  // Synchronize store selectedVariable to InspectionPanel activeTab
  useEffect(() => {
    if (
      selectedVariable &&
      (selectedVariable === 'temp' ||
        selectedVariable === 'salinity' ||
        selectedVariable === 'density' ||
        selectedVariable === 'chlorophyll')
    ) {
      if (activeTab !== 'ts' && activeTab !== 'summary' && activeTab !== selectedVariable) {
        setActiveTab(selectedVariable);
      }
    }
  }, [selectedVariable]);

  // 3D Visual Layer Toggles
  const showThermocline = useOceanStore((s) => s.showThermocline);
  const setShowThermocline = useOceanStore((s) => s.setShowThermocline);
  const showFieldSlice = useOceanStore((s) => s.showFieldSlice);
  const setShowFieldSlice = useOceanStore((s) => s.setShowFieldSlice);
  const showIsoRipples = useOceanStore((s) => s.showIsoRipples);
  const setShowIsoRipples = useOceanStore((s) => s.setShowIsoRipples);
  const showBiomassParticles = useOceanStore((s) => s.showBiomassParticles);
  const setShowBiomassParticles = useOceanStore((s) => s.setShowBiomassParticles);
  const showStratificationDrape = useOceanStore((s) => s.showStratificationDrape);
  const setShowStratificationDrape = useOceanStore((s) => s.setShowStratificationDrape);
  const setActiveFlashVisual = useOceanStore((s) => s.setActiveFlashVisual);

  const [visualsDropdownOpen, setVisualsDropdownOpen] = useState(false);
  const [flashToast, setFlashToast] = useState<{ title: string; message: string; icon: string } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const triggerVisualToggle = (
    key: string,
    name: string,
    description: string,
    icon: string,
    currentVal: boolean,
    setter: (v: boolean) => void
  ) => {
    const nextVal = !currentVal;
    setter(nextVal);
    if (nextVal) {
      setActiveFlashVisual(key);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setFlashToast({ title: name, message: description, icon });
      toastTimeoutRef.current = setTimeout(() => {
        setFlashToast(null);
        setActiveFlashVisual(null);
      }, 2600);
    }
  };

  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; initW: number; initH: number } | null>(null);
  const splitRef = useRef<{ startX: number; initRatio: number } | null>(null);
  const isScrubbingRef = useRef(false);

  const chartAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFloat) {
      setIsFirstView(!visitedFloats.has(selectedFloat.id));
    }
    setActiveTab('temp');
    if (selectedFloat && !visitedFloats.has(selectedFloat.id)) {
      setPos({
        x: Math.max(16, window.innerWidth / 2 - size.width / 2),
        y: Math.max(76, window.innerHeight / 2 - size.height / 2),
      });
    }
  }, [selectedFloat, visitedFloats]);

  const rawChartData = profile?.data || [];

  // Enriched chart data with potential density (sigma_theta), BGC chlorophyll, & water mass classification
  const enrichedChartData = useMemo(() => {
    return rawChartData.map((d: any) => {
      const sal = d.salinity ?? d.psal ?? 34.0;
      const chl = d.chlorophyll ?? computeDCMChlorophyll(d.depth, selectedFloat?.lat ?? 15.0);
      const sigma = computeSigmaTheta(d.temp, sal);
      const wm = classifyWaterMass(d.temp, sal, d.depth);
      return {
        ...d,
        salinity: sal,
        chlorophyll: parseFloat(chl.toFixed(3)),
        sigmaTheta: parseFloat(sigma.toFixed(2)),
        waterMass: wm.name,
        waterMassCode: wm.code,
        waterMassColor: wm.color,
        waterMassDesc: wm.description,
      };
    });
  }, [rawChartData, selectedFloat]);

  const maxDepth = useMemo(() => {
    if (!enrichedChartData.length) return 2000;
    return Math.max(...enrichedChartData.map((d) => d.depth), 100);
  }, [enrichedChartData]);

  // Isopycnal background contours for T-S plot
  const isopycnals = useMemo(() => {
    if (!enrichedChartData.length) return [];
    const sals = enrichedChartData.map((d: any) => d.salinity);
    const temps = enrichedChartData.map((d: any) => d.temp);
    const salMin = Math.max(28, Math.floor(Math.min(...sals) - 0.5));
    const salMax = Math.min(38, Math.ceil(Math.max(...sals) + 0.5));
    const tempMin = Math.max(2, Math.floor(Math.min(...temps) - 1));
    const tempMax = Math.min(34, Math.ceil(Math.max(...temps) + 1));
    return generateIsopycnals(salMin, salMax, tempMin, tempMax, [22, 23, 24, 25, 26, 27, 27.5, 28]);
  }, [enrichedChartData]);

  const thermocline = useMemo(() => {
    if (enrichedChartData.length < 2) return null;
    let maxGrad = 0;
    let tDepth = 0;
    for (let i = 1; i < enrichedChartData.length; i++) {
      const dz = enrichedChartData[i].depth - enrichedChartData[i - 1].depth;
      const dt = Math.abs(enrichedChartData[i].temp - enrichedChartData[i - 1].temp);
      if (dz > 0 && dt / dz > maxGrad) {
        maxGrad = dt / dz;
        tDepth = enrichedChartData[i].depth;
      }
    }
    return maxGrad > 0.05 ? { depth: tDepth, gradient: maxGrad } : null;
  }, [enrichedChartData]);

  const mld = useMemo(() => {
    if (!enrichedChartData.length) return null;
    const surfaceDensity = enrichedChartData[0].density;
    const threshold = surfaceDensity + 0.03;
    const mldPoint = enrichedChartData.find((d) => d.density > threshold);
    return mldPoint ? mldPoint.depth : null;
  }, [enrichedChartData]);

  const dcm = useMemo(() => {
    if (!enrichedChartData.length) return null;
    let maxChl = 0;
    let dcmDepth = 0;
    enrichedChartData.forEach((d) => {
      if (d.chlorophyll > maxChl) {
        maxChl = d.chlorophyll;
        dcmDepth = d.depth;
      }
    });
    return maxChl > 0.3 ? { depth: dcmDepth, peakChl: maxChl } : null;
  }, [enrichedChartData]);

  const sparklineData = useMemo(() => {
    if (!selectedFloat || !metadata) return [];
    return metadata.time_steps.map((_, i) => {
      const slice = getSlice(0, i, 'temp');
      let nearestTemp: number | null = null;
      if (slice?.points.length) {
        let minDist = Infinity, best = null;
        for (const pt of slice.points) {
          const dist = (pt.lat - selectedFloat.lat) ** 2 + (pt.lon - selectedFloat.lon) ** 2;
          if (dist < minDist) { minDist = dist; best = pt; }
        }
        if (best) nearestTemp = best.temp;
      }
      return { time: metadata.time_steps[i].substring(5, 10), temp: nearestTemp };
    });
  }, [selectedFloat, metadata, getSlice]);

  // Snapped measurement point at active hoveredDepth
  const snappedPoint = useMemo(() => {
    if (hoveredDepth === null || !enrichedChartData.length) return null;
    return enrichedChartData.reduce((prev, curr) =>
      Math.abs(curr.depth - hoveredDepth) < Math.abs(prev.depth - hoveredDepth) ? curr : prev
    );
  }, [hoveredDepth, enrichedChartData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Effortless Magnetic Cursor & Vertical Scrubbing Logic
  // ─────────────────────────────────────────────────────────────────────────

  const handlePointerScrub = useCallback((e: React.PointerEvent) => {
    if (activeTab === 'summary') return;
    if (!chartAreaRef.current || !enrichedChartData.length) return;
    const rect = chartAreaRef.current.getBoundingClientRect();
    if (rect.height <= 0) return;

    if (activeTab === 'ts') {
      // 2D Phase space nearest point calculation
      const mouseXNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const mouseYNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const sals = enrichedChartData.map(d => d.salinity);
      const temps = enrichedChartData.map(d => d.temp);
      const minS = Math.min(...sals), maxS = Math.max(...sals) || minS + 1;
      const minT = Math.min(...temps), maxT = Math.max(...temps) || minT + 1;

      const targetS = minS + mouseXNorm * (maxS - minS);
      const targetT = maxT - mouseYNorm * (maxT - minT);

      const nearest = enrichedChartData.reduce((prev, curr) => {
        const dPrev = Math.pow((curr.salinity - targetS) / (maxS - minS), 2) + Math.pow((curr.temp - targetT) / (maxT - minT), 2);
        const dCurr = Math.pow((prev.salinity - targetS) / (maxS - minS), 2) + Math.pow((prev.temp - targetT) / (maxT - minT), 2);
        return dPrev < dCurr ? curr : prev;
      });

      setHoveredDepthStore(nearest.depth);
      if (isScrubbingRef.current) {
        setCurrentDepth(nearest.depth);
      }
    } else {
      // Vertical Profile Depth Scrubbing (T, S, Density, Chlorophyll)
      // Exact top-to-bottom mapping: Top (Y=0) -> 0m, Bottom (Y=height) -> maxDepth
      const topPadding = 12;
      const bottomPadding = 30;
      const usableHeight = Math.max(1, rect.height - topPadding - bottomPadding);
      const relY = Math.max(0, Math.min(usableHeight, e.clientY - rect.top - topPadding));
      const targetDepth = (relY / usableHeight) * maxDepth;

      const nearest = enrichedChartData.reduce((prev, curr) =>
        Math.abs(curr.depth - targetDepth) < Math.abs(prev.depth - targetDepth) ? curr : prev
      );

      setHoveredDepthStore(nearest.depth);
      if (isScrubbingRef.current) {
        setCurrentDepth(nearest.depth);
      }
    }
  }, [enrichedChartData, maxDepth, activeTab, setHoveredDepthStore, setCurrentDepth]);

  const onChartPointerDown = (e: React.PointerEvent) => {
    if (activeTab === 'summary') return;
    isScrubbingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerScrub(e);
  };

  const onChartPointerMove = (e: React.PointerEvent) => {
    if (activeTab === 'summary') return;
    handlePointerScrub(e);
  };

  const onChartPointerUp = (e: React.PointerEvent) => {
    isScrubbingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
  };

  const onChartPointerLeave = () => {
    if (!isScrubbingRef.current) {
      setHoveredDepthStore(null);
    }
  };

  if (!selectedFloat) return null;

  const varToDataKey = {
    temp: 'temp',
    salinity: 'salinity',
    density: 'density',
    chlorophyll: 'chlorophyll',
  } as const;

  const varToColor = {
    temp: '#f43f5e',
    salinity: '#0ea5e9',
    density: '#10b981',
    chlorophyll: '#22c55e',
  } as const;

  const hologramVariable: 'temp' | 'salinity' | 'density' | 'chlorophyll' =
    activeTab === 'salinity'
      ? 'salinity'
      : activeTab === 'density'
      ? 'density'
      : activeTab === 'chlorophyll'
      ? 'chlorophyll'
      : 'temp';

  // Window drag logic
  const onDragStart = (e: React.PointerEvent) => {
    if (isFullScreen) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, initX: pos.x, initY: pos.y };
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.initX + dx)),
      y: Math.max(64, Math.min(window.innerHeight - 200, dragRef.current.initY + dy)),
    });
  };
  const onDragEnd = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      dragRef.current = null;
    }
  };

  // Window resize logic
  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { startX: e.clientX, startY: e.clientY, initW: size.width, initH: size.height };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dw = e.clientX - resizeRef.current.startX;
    const dh = e.clientY - resizeRef.current.startY;
    setSize({
      width: Math.max(640, Math.min(window.innerWidth - pos.x - 16, resizeRef.current.initW + dw)),
      height: Math.max(400, Math.min(window.innerHeight - pos.y - 16, resizeRef.current.initH + dh)),
    });
  };
  const onResizeEnd = (e: React.PointerEvent) => {
    if (resizeRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      resizeRef.current = null;
    }
  };

  // Split-pane dragging logic
  const onSplitStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    splitRef.current = { startX: e.clientX, initRatio: splitRatio };
  };
  const onSplitMove = (e: React.PointerEvent) => {
    if (!splitRef.current) return;
    const dx = e.clientX - splitRef.current.startX;
    const newRatio = splitRef.current.initRatio + dx / size.width;
    setSplitRatio(Math.max(0.25, Math.min(0.75, newRatio)));
  };
  const onSplitEnd = (e: React.PointerEvent) => {
    if (splitRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      splitRef.current = null;
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed z-50 w-12 h-12 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/50 rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-800 transition-colors pointer-events-auto"
        style={{ left: pos.x, top: pos.y }}
        title="Restore Inspection Panel"
      >
        <Activity className="w-5 h-5 text-cyan-400" />
      </button>
    );
  }

  return (
    <div
      style={isFullScreen ? {
        position: 'fixed',
        inset: '64px 0 0 0',
        zIndex: 50,
      } : {
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 40,
      }}
      className="flex flex-row bg-slate-950/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none"
    >
      {/* ── Left Column: Controls & Graphs ───────────────────────── */}
      <div 
        className="flex flex-col min-h-0 min-w-0 border-r border-white/5 bg-black/20"
        style={{ width: `calc(${splitRatio * 100}% - 4px)` }}
      >
        {/* Header Drag Handle */}
        <div 
          className="p-3 border-b border-white/10 flex items-center justify-between cursor-move bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
          onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="w-4 h-4 text-slate-500" />
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Anchor className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/20">
                  {(selectedFloat as any).platform_type || 'Argo APEX'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedFloat.lat.toFixed(2)}°N, {selectedFloat.lon.toFixed(2)}°E
                </span>
              </div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Float #{selectedFloat.platform_number}
                <button onClick={onReplayCinematic} className="p-1 hover:bg-white/10 rounded-full transition-colors" title="Replay Cinematic">
                  <RotateCcw className="w-3 h-3 text-slate-400 hover:text-white" />
                </button>
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Minimize">
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="hidden md:block p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title={isFullScreen ? "Restore" : "Maximize"}>
              {isFullScreen ? <Square className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Depth Slider integrated in panel */}
        <div className="px-4 py-2 border-b border-white/5 bg-slate-900/50 flex flex-col gap-2 shrink-0">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>Global Depth Field</span>
            <span className="text-cyan-400 font-mono font-bold">{currentDepth}m</span>
          </div>
          <input 
            type="range" 
            min="0" max="2000" step="10" 
            value={currentDepth}
            onChange={(e) => setCurrentDepth(Number(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        {/* Tabs: T(z), S(z), ρ(z), Chl(z), T-S, Summary */}
        <div className="flex p-2 gap-1 border-b border-white/5 bg-black/40 overflow-x-auto shrink-0 flex-wrap">
          {[
            { id: 'temp',        icon: Thermometer, label: 'T(z)' },
            { id: 'salinity',    icon: Droplets,    label: 'S(z)' },
            { id: 'density',     icon: Layers,      label: 'ρ(z)' },
            { id: 'chlorophyll', icon: Leaf,        label: 'Chl(z)' },
            { id: 'ts',          icon: Activity,    label: 'T-S'  },
            { id: 'summary',     icon: Compass,     label: 'Summary' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === 'temp' || tab.id === 'salinity' || tab.id === 'density' || tab.id === 'chlorophyll') {
                  setSelectedVariable(tab.id);
                }
                if (tab.id === 'ts' && hologramMode === 'single') {
                  setHologramMode('phase-space');
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-white/10 text-white border border-white/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Magnetic Scrubber Status Banner */}
        <div className="px-4 py-2 border-b border-white/5 shrink-0 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <MoveVertical className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-300">
              {snappedPoint ? (
                <span>
                  Locked at <strong className="text-cyan-400 font-bold">{snappedPoint.depth}m</strong>
                  {' · '}
                  {activeTab === 'temp' && <span className="text-rose-400">{snappedPoint.temp.toFixed(2)}°C</span>}
                  {activeTab === 'salinity' && <span className="text-sky-400">{snappedPoint.salinity.toFixed(2)} PSU</span>}
                  {activeTab === 'density' && <span className="text-emerald-400">{snappedPoint.density.toFixed(2)} kg/m³</span>}
                  {activeTab === 'chlorophyll' && <span className="text-green-400">{snappedPoint.chlorophyll.toFixed(3)} mg/m³</span>}
                  {activeTab === 'ts' && (
                    <span className="text-purple-400">
                      {snappedPoint.temp.toFixed(1)}°C · {snappedPoint.salinity.toFixed(2)} · σ_θ {snappedPoint.sigmaTheta} ({snappedPoint.waterMassCode})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400">Drag or move mouse anywhere to auto-scrub depth</span>
              )}
            </span>
          </div>
          {activeTab === 'chlorophyll' && dcm && (
            <span className="text-[9px] font-mono text-green-400 bg-green-950/40 px-2 py-0.5 rounded border border-green-500/20">
              DCM: {dcm.depth}m
            </span>
          )}
          {activeTab === 'ts' && (
            <span className="text-[9px] font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
              Isopycnals (σ_θ)
            </span>
          )}
        </div>

        {/* Content Area with Native Zero-Lag Recharts Synchronization */}
        <div
          ref={chartAreaRef}
          className="flex-1 overflow-y-auto p-4 custom-scrollbar relative flex flex-col select-none"
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          ) : enrichedChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              No profile data available for this float.
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* ── Vertical Profiles T(z), S(z), ρ(z), Chl(z) ─────────────── */}
              {(activeTab === 'temp' || activeTab === 'salinity' || activeTab === 'density' || activeTab === 'chlorophyll') && (
                <div className="flex-1 w-full min-h-[210px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={enrichedChartData}
                      layout="vertical"
                      margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
                      onMouseMove={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                          const d = e.activePayload[0].payload.depth;
                          if (typeof d === 'number') {
                            setHoveredDepthStore(d);
                            setCurrentDepth(d);
                          }
                        }
                      }}
                      onMouseLeave={() => setHoveredDepthStore(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis
                        type="number"
                        domain={['auto', 'auto']}
                        stroke="#ffffff20"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        unit={
                          activeTab === 'temp'
                            ? '°C'
                            : activeTab === 'salinity'
                            ? ' PSU'
                            : activeTab === 'density'
                            ? ' kg/m³'
                            : ' mg/m³'
                        }
                      />
                      <YAxis
                        type="number"
                        dataKey="depth"
                        domain={[maxDepth, 0]}
                        stroke="#ffffff20"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        unit="m"
                        width={45}
                      />

                      <Tooltip
                        content={<CustomProfileTooltip activeTab={activeTab} />}
                        cursor={{ stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                        isAnimationActive={false}
                      />

                      {/* Thermocline Reference Marker */}
                      {thermocline && activeTab === 'temp' && (
                        <ReferenceLine
                          y={thermocline.depth}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{ value: `Thermocline (${thermocline.depth}m)`, fill: '#f59e0b', fontSize: 9 }}
                        />
                      )}

                      {/* Deep Chlorophyll Maximum (DCM) Reference Marker */}
                      {dcm && activeTab === 'chlorophyll' && (
                        <ReferenceLine
                          y={dcm.depth}
                          stroke="#22c55e"
                          strokeDasharray="4 4"
                          label={{ value: `DCM Peak (${dcm.depth}m)`, fill: '#22c55e', fontSize: 9 }}
                        />
                      )}

                      <Line
                        type="monotone"
                        dataKey={varToDataKey[activeTab as 'temp' | 'salinity' | 'density' | 'chlorophyll']}
                        stroke={varToColor[activeTab as 'temp' | 'salinity' | 'density' | 'chlorophyll']}
                        strokeWidth={2.5}
                        dot={{ r: 2.5, fill: '#0f172a', strokeWidth: 1.5 }}
                        activeDot={{ r: 7, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                        isAnimationActive={isFirstView}
                        animationDuration={1200}
                        name={
                          activeTab === 'temp'
                            ? 'Temp (°C)'
                            : activeTab === 'salinity'
                            ? 'Salinity (PSU)'
                            : activeTab === 'density'
                            ? 'Density (kg/m³)'
                            : 'Chlorophyll-a (mg/m³)'
                        }
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── T-S Diagram (Isopycnal Density Contours & Zero-Lag Snapping) ─────────── */}
              {activeTab === 'ts' && (
                <div className="flex-1 w-full min-h-[220px] relative flex flex-col">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-xs font-medium text-slate-400">
                      T-S Water Mass Diagram with Isopycnal Density Contours (σ_θ)
                    </span>
                  </div>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 10, right: 15, bottom: 25, left: 10 }}
                        onMouseMove={(e) => {
                          if (e && e.activePayload && e.activePayload.length > 0) {
                            // ScatterChart wraps payload differently; try to find it
                            const pt = e.activePayload[0].payload;
                            // Check if payload is directly pt, or pt.payload (depending on Recharts version)
                            const dataPt = pt.payload || pt;
                            
                            if (dataPt && typeof dataPt.depth === 'number') {
                              setHoveredDepthStore(dataPt.depth);
                              setCurrentDepth(dataPt.depth);
                            }
                          }
                        }}
                        onMouseLeave={() => setHoveredDepthStore(null)}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis
                          type="number"
                          dataKey="salinity"
                          name="Salinity"
                          domain={['dataMin - 0.2', 'dataMax + 0.2']}
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                          stroke="#ffffff20"
                          label={{ value: 'Salinity (PSU)', position: 'bottom', fill: '#64748b', fontSize: 11, offset: 5 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="temp"
                          name="Temperature"
                          domain={['dataMin - 1', 'dataMax + 1']}
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                          stroke="#ffffff20"
                          label={{ value: 'Temperature (°C)', angle: -90, position: 'left', fill: '#64748b', fontSize: 11 }}
                        />
                        <ZAxis type="number" dataKey="depth" range={[35, 35]} name="Depth" />

                        <Tooltip content={<CustomTSTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#a855f7' }} isAnimationActive={false} />

                        {/* Isopycnal lines */}
                        {isopycnals.map((iso) => (
                          <Scatter
                            key={`iso-${iso.sigma}`}
                            name={`σ_θ = ${iso.sigma}`}
                            data={iso.points}
                            fill="#6366f1"
                            line={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '2 3' }}
                            shape={() => null as any}
                            legendType="none"
                            isAnimationActive={false}
                          />
                        ))}

                        {/* Float Trajectory Scatter */}
                        <Scatter
                          name="Water Mass"
                          data={enrichedChartData}
                          fill="#a855f7"
                          line={{ stroke: '#a855f7', strokeWidth: 2 }}
                          isAnimationActive={isFirstView}
                          animationDuration={1500}
                        />

                        {/* Snapped Point Highlight in T-S plot */}
                        {snappedPoint && (
                          <Scatter
                            name="Active Node"
                            data={[snappedPoint]}
                            fill="#ffffff"
                            shape="circle"
                            isAnimationActive={false}
                          />
                        )}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Summary Tab ───────────────────────────────────── */}
              {activeTab === 'summary' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-500 flex-1 overflow-y-auto min-h-0 pointer-events-auto">
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl shrink-0">
                    <h4 className="text-sm font-semibold text-slate-400 mb-3">CMEMS 5-Day Surface Temp</h4>
                    <div className="h-24 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#000', border: '1px solid #333' }} />
                          <Area type="monotone" dataKey="temp" stroke="#eab308" fill="#eab30820" isAnimationActive={isFirstView} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 text-center">
                      At {selectedFloat.lat.toFixed(1)}°N, {selectedFloat.lon.toFixed(1)}°E
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 shrink-0">
                    <div className="bg-cyan-950/30 border border-cyan-900/50 p-3 rounded-xl">
                      <span className="text-xs font-semibold text-cyan-500">Thermocline</span>
                      <div className="text-lg font-mono text-white mt-1">{thermocline ? `${thermocline.depth}m` : 'N/A'}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Max dT/dz gradient</div>
                    </div>
                    <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-xl">
                      <span className="text-xs font-semibold text-emerald-500">Mixed Layer</span>
                      <div className="text-lg font-mono text-white mt-1">{mld ? `${mld}m` : 'N/A'}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Δρ = 0.03 threshold</div>
                    </div>
                    <div className="bg-green-950/30 border border-green-900/50 p-3 rounded-xl">
                      <span className="text-xs font-semibold text-green-400">DCM Peak</span>
                      <div className="text-lg font-mono text-white mt-1">{dcm ? `${dcm.depth}m` : 'N/A'}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{dcm ? `${dcm.peakChl.toFixed(2)} mg/m³` : ''}</div>
                    </div>
                  </div>

                  <div className="bg-indigo-950/30 border border-indigo-900/50 p-4 rounded-xl shrink-0">
                    <h4 className="text-sm font-semibold text-indigo-400 mb-2">Water Mass Signature</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      T-S signature consistent with <span className="text-white font-semibold">Bay of Bengal Fresh Water (BBFW)</span> at surface,
                      transitioning to <span className="text-white font-semibold">Indian Ocean Central Water (IOCW)</span> below thermocline.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Split Pane Divider */}
      <div 
        className="w-2 cursor-col-resize hover:bg-white/10 active:bg-cyan-500/50 transition-colors z-40 shrink-0 border-r border-white/5 flex flex-col justify-center items-center group"
        onPointerDown={onSplitStart} onPointerMove={onSplitMove} onPointerUp={onSplitEnd} onPointerCancel={onSplitEnd}
      >
         <div className="h-8 w-1 rounded-full bg-white/20 group-hover:bg-white/60 transition-colors"></div>
      </div>

      {/* ── Right Column: 3D Hologram ─────────────────────────────── */}
      <div className="relative flex flex-col bg-slate-950 min-h-0" style={{ width: `calc(${(1 - splitRatio) * 100}% - 8px)` }}>
        {/* Top Controls for Hologram */}
        <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-center pointer-events-none gap-2">
          {/* Segmented Control */}
          <div className="flex bg-black/75 backdrop-blur-md p-1 rounded-xl border border-white/10 pointer-events-auto shadow-xl shrink-0">
            <button
              onClick={() => setHologramMode('single')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${hologramMode === 'single' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white border border-transparent'}`}
            >
              Single Float
            </button>
            <button
              onClick={() => setHologramMode('fleet')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${hologramMode === 'fleet' ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30' : 'text-slate-400 hover:text-white border border-transparent'}`}
            >
              <Sparkles className="w-3 h-3" />
              Fleet Field 4D
            </button>
            <button
              onClick={() => setHologramMode('phase-space')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${hologramMode === 'phase-space' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white border border-transparent'}`}
            >
              <Box className="w-3 h-3" />
              3D (S, T, z)
            </button>
          </div>

          <div className="flex gap-1.5 pointer-events-auto items-center shrink-0">
            {/* Visuals Dropdown Menu */}
            <div className="relative pointer-events-auto">
              <button
                onClick={() => setVisualsDropdownOpen((v) => !v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-xl backdrop-blur-md border ${
                  visualsDropdownOpen
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-cyan-500/20'
                    : 'bg-black/75 text-slate-300 hover:text-white hover:bg-white/10 border-white/10'
                }`}
              >
                <Eye className={`w-3.5 h-3.5 ${visualsDropdownOpen ? 'text-slate-950' : 'text-cyan-400'}`} />
                <span>Visuals</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${visualsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {visualsDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-950/95 border border-white/15 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl z-50 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                    <span className="text-xs font-medium text-slate-400">3D Visual Layers</span>
                    <span className="text-[9px] text-cyan-400 font-mono">Live Toggle</span>
                  </div>

                  {/* Layer 1: Living Thermocline Sheet */}
                  <button
                    onClick={() =>
                      triggerVisualToggle(
                        'thermocline',
                        'Living Thermocline Sheet',
                        'Internal gravity waves & buoyancy frequency (N²) boundary',
                        '🌊',
                        showThermocline,
                        setShowThermocline
                      )
                    }
                    className={`flex items-start gap-2 p-2 rounded-xl text-left transition-all border ${
                      showThermocline ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className={`p-1 rounded-lg shrink-0 mt-0.5 ${showThermocline ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                      <Waves className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Thermocline Sheet</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${showThermocline ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                          {showThermocline ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Living internal gravity wave sheet at N² peak</p>
                    </div>
                  </button>

                  {/* Layer 2: Dynamic Layer Field Slice */}
                  <button
                    onClick={() =>
                      triggerVisualToggle(
                        'fieldSlice',
                        'Dynamic Layer Field Slice',
                        'Physics-colored heat-map slice at current depth level',
                        '🌐',
                        showFieldSlice,
                        setShowFieldSlice
                      )
                    }
                    className={`flex items-start gap-2 p-2 rounded-xl text-left transition-all border ${
                      showFieldSlice ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className={`p-1 rounded-lg shrink-0 mt-0.5 ${showFieldSlice ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Layer Field Slice</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${showFieldSlice ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>
                          {showFieldSlice ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Physics color gradient at depth ({activeTab})</p>
                    </div>
                  </button>

                  {/* Layer 3: Iso-Contour Wave Ripples */}
                  <button
                    onClick={() =>
                      triggerVisualToggle(
                        'isoRipples',
                        'Iso-Contour Wave Ripples',
                        'Spatial acoustic radius and sensor correlation waves radiating from float',
                        '💫',
                        showIsoRipples,
                        setShowIsoRipples
                      )
                    }
                    className={`flex items-start gap-2 p-2 rounded-xl text-left transition-all border ${
                      showIsoRipples ? 'bg-sky-500/10 border-sky-500/30 text-sky-200' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className={`p-1 rounded-lg shrink-0 mt-0.5 ${showIsoRipples ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-500'}`}>
                      <CircleDot className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Iso-Contour Ripples</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${showIsoRipples ? 'bg-sky-500/30 text-sky-300' : 'bg-slate-800 text-slate-500'}`}>
                          {showIsoRipples ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Expanding spatial acoustic influence rings</p>
                    </div>
                  </button>

                  {/* Layer 4: Biomass Micro-Particles */}
                  <button
                    onClick={() =>
                      triggerVisualToggle(
                        'biomassParticles',
                        'Biomass Micro-Particles',
                        'Phytoplankton concentration & DCM bloom motes in euphotic zone',
                        '✨',
                        showBiomassParticles,
                        setShowBiomassParticles
                      )
                    }
                    className={`flex items-start gap-2 p-2 rounded-xl text-left transition-all border ${
                      showBiomassParticles ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className={`p-1 rounded-lg shrink-0 mt-0.5 ${showBiomassParticles ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Biomass Particles</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${showBiomassParticles ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                          {showBiomassParticles ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Phytoplankton concentration density motes</p>
                    </div>
                  </button>

                  {/* Layer 5: Stratification Drape Curtain */}
                  <button
                    onClick={() =>
                      triggerVisualToggle(
                        'stratificationDrape',
                        'Stratification Drape Curtain',
                        'Vertical ribbon curtain displaying water column stratification history',
                        '📜',
                        showStratificationDrape,
                        setShowStratificationDrape
                      )
                    }
                    className={`flex items-start gap-2 p-2 rounded-xl text-left transition-all border ${
                      showStratificationDrape ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className={`p-1 rounded-lg shrink-0 mt-0.5 ${showStratificationDrape ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
                      <ScrollText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Stratification Drape</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${showStratificationDrape ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-800 text-slate-500'}`}>
                          {showStratificationDrape ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Vertical gradient profile curtain</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setIsFullScreen(s => !s)} className="p-2 hover:bg-white/10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white transition-colors shadow-lg" title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}>
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-slate-300 hover:text-red-400 transition-colors shadow-lg" title="Close Panel">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live HUD Flash Toast Notification */}
        {flashToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-950/90 border border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-xl px-4 py-2 rounded-2xl flex items-center gap-3">
              <span className="text-lg">{flashToast.icon}</span>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  {flashToast.title}
                  <span className="text-xs font-semibold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">Active</span>
                </h4>
                <p className="text-[10px] text-slate-300 max-w-xs">{flashToast.message}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 w-full h-full">
          <FloatHologram
            selectedProfile={profile}
            allProfiles={allProfiles}
            hoveredDepth={hoveredDepth}
            variable={hologramVariable}
            expanded={isFullScreen} 
            hologramMode={hologramMode}
          />
        </div>
      </div>

      {/* Resize Handle (Bottom Right) */}
      {!isFullScreen && (
        <div 
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 flex items-end justify-end p-1"
          onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 0L0 12H12V0Z" fill="currentColor" className="text-white/20 hover:text-cyan-400 transition-colors"/>
          </svg>
        </div>
      )}
    </div>
  );
};
