/**
 * useOceanStore — Global Zustand state store for OceanView 4D.
 *
 * Single source of truth across all 5 interdependent views:
 *   1. CesiumGlobe  (imperative WebGL/Cesium)
 *   2. InspectionPanel  (2D Recharts profile charts)
 *   3. FloatHologram    (Three.js R3F per-float 4D scene)
 *   4. FleetSpatialHologram (Three.js R3F full-basin scene)
 *   5. TimeDepthControls (slider controls)
 *
 * Design rules:
 *   - Every state mutation is a single store.set() call — no duplicated state.
 *   - Components subscribe only to the exact slices they use (Zustand selectors),
 *     so a Bloom-glow update never re-renders the Cesium entity management code.
 *   - sliceCacheRef stays a React ref inside App.tsx (it's a mutable cache buffer,
 *     not reactive state), but the slice data itself flows through the store.
 */

import { create } from 'zustand';
import {
  OceanMetadata,
  SliceData,
  FloatSummary,
  FloatProfile,
  VariableKey,
} from '../types/ocean';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ViewMode = '3d-globe' | '2d-dashboard';

export type InspectionTab =
  | 'temp'
  | 'salinity'
  | 'density'
  | 'ts'
  | 'summary';

export type ColorScaleMode = 'linear' | 'log';
export type HologramMode = 'single' | 'fleet' | 'phase-space';
export type ColorMode = 'scientific' | 'intuitive' | 'anomaly';
export type ExplanationMode = 'expert' | 'simple';

export interface OceanStoreState {
  // ── Dataset / Bootstrap ────────────────────────────────────────────────────
  metadata: OceanMetadata | null;
  isAppLoading: boolean;
  isSliceLoading: boolean;
  isProfileLoading: boolean;

  // ── All Floats (list + loaded profiles for fleet hologram) ─────────────────
  allFloats: FloatSummary[];
  allProfiles: { profile: FloatProfile; summary: FloatSummary }[];

  // ── Selected Float Context ─────────────────────────────────────────────────
  selectedFloat: FloatSummary | null;
  selectedFloatProfile: FloatProfile | null;
  visitedFloatIds: Set<string>;

  // ── Raster Slice Data (dual-buffer for crossfade) ──────────────────────────
  sliceDataA: SliceData | null;
  sliceDataB: SliceData | null;

  // ── Spatio-Temporal Dimensions ─────────────────────────────────────────────
  /** Continuous depth in metres (0–2000). NOT snapped to discrete levels. */
  currentDepth: number;
  /** Continuous fractional time index (e.g. 2.35 = 35% between steps 2→3). */
  currentTimestep: number;
  /** Uniform vertical exaggeration: 10×–60×, default 40×. */
  verticalExaggeration: number;
  /** Currently selected date string (ISO) for the date range picker. */
  selectedDate: string;
  /** Start date for custom date range picker (ISO date string). */
  dateRangeStart: string;
  /** End date for custom date range picker (ISO date string). */
  dateRangeEnd: string;
  /** Whether the date range picker is open. */
  dateRangePickerOpen: boolean;

  // ── Oceanographic Variable & Scale ─────────────────────────────────────────
  selectedVariable: VariableKey;
  /** Whether to apply a log₁₀ transform to the color-scale mapping.
   *  Useful for salinity and current-speed fields with high dynamic range.
   *  Rendered as a toggle in Display Controls. */
  colorScaleMode: ColorScaleMode;

  // ── Layer Overlays & Volumetric Context ───────────────────────────────────
  showCurrents: boolean;
  showFloats: boolean;
  showGrid: boolean;
  showProbePanel: boolean;
  showTemporalMorphing: boolean;
  showContours: boolean;
  showDeltas: boolean;

  // ── 3D Hologram Visual Layers ──────────────────────────────────────────────
  showThermocline: boolean;
  showFieldSlice: boolean;
  showIsoRipples: boolean;
  showBiomassParticles: boolean;
  showStratificationDrape: boolean;
  activeFlashVisual: string | null;

  // ── Transient Cursor State (chart hover → globe + hologram sync) ───────────
  /** Depth in metres from hovering a 2D chart data-point. Null when not hovering.
   *  Consumed by CesiumGlobe (10 km scanner disc) and FloatHologram (crosshair). */
  hoveredDepth: number | null;

  // ── UI Modes ───────────────────────────────────────────────────────────────
  viewMode: ViewMode;
  activeInspectionTab: InspectionTab;
  flyToTarget: string | null;
  hologramMode: HologramMode;
  colorMode: ColorMode;
  explanationMode: ExplanationMode;
  isAutoCentering: boolean;

  setShowThermocline: (v: boolean) => void;
  setShowFieldSlice: (v: boolean) => void;
  setShowIsoRipples: (v: boolean) => void;
  setShowBiomassParticles: (v: boolean) => void;
  setShowStratificationDrape: (v: boolean) => void;
  setActiveFlashVisual: (name: string | null) => void;

  // ──────────────────────────────────────────────────────────────────────────
  // Actions — one store.set() per logical mutation, nothing else.
  // ──────────────────────────────────────────────────────────────────────────

  setMetadata: (meta: OceanMetadata | null) => void;
  setIsAppLoading: (v: boolean) => void;
  setIsSliceLoading: (v: boolean) => void;
  setIsProfileLoading: (v: boolean) => void;

  setAllFloats: (floats: FloatSummary[]) => void;
  setAllProfiles: (profiles: { profile: FloatProfile; summary: FloatSummary }[]) => void;

  setSelectedFloat: (summary: FloatSummary | null) => void;
  setSelectedFloatProfile: (profile: FloatProfile | null) => void;
  markFloatVisited: (id: string) => void;

  setSliceDataA: (data: SliceData | null) => void;
  setSliceDataB: (data: SliceData | null) => void;
  /** Whether live data is enabled (Argovis + satellite feeds active). */
  isLiveData: boolean;
  /** ISO timestamp of last successful live sync. */
  lastSyncTime: string | null;
  /** Whether a live sync is in progress. */
  isSyncing: boolean;

  setDateRange: (start: string, end: string) => void;
  setSelectedDate: (date: string) => void;
  setDateRangePickerOpen: (open: boolean) => void;
  setIsLiveData: (v: boolean) => void;
  setLastSyncTime: (t: string | null) => void;
  setIsSyncing: (v: boolean) => void;

  setCurrentTimestep: (step: number) => void;
  setCurrentDepth: (depth: number) => void;
  setVerticalExaggeration: (exagg: number) => void;

  setSelectedVariable: (variable: VariableKey) => void;
  setColorScaleMode: (mode: ColorScaleMode) => void;

  toggleLayer: (layer: 'currents' | 'floats' | 'grid' | 'morphing' | 'contours' | 'deltas') => void;
  setShowCurrents: (v: boolean) => void;
  setShowTemporalMorphing: (v: boolean) => void;

  setHoveredDepth: (depth: number | null) => void;
  setShowProbePanel: (show: boolean) => void;

  setViewMode: (mode: ViewMode) => void;
  setActiveInspectionTab: (tab: InspectionTab) => void;
  setFlyToTarget: (target: string | null) => void;
  setHologramMode: (mode: HologramMode) => void;
  setColorMode: (mode: ColorMode) => void;
  setExplanationMode: (mode: ExplanationMode) => void;
  setIsAutoCentering: (v: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useOceanStore = create<OceanStoreState>((set) => ({
  // ── Bootstrap ──────────────────────────────────────────────────────────────
  metadata: null,
  isAppLoading: true,
  isSliceLoading: false,
  isProfileLoading: false,

  // ── Floats ─────────────────────────────────────────────────────────────────
  allFloats: [],
  allProfiles: [],
  selectedFloat: null,
  selectedFloatProfile: null,
  visitedFloatIds: new Set(),

  // ── Slice data ─────────────────────────────────────────────────────────────
  sliceDataA: null,
  sliceDataB: null,

  // ── Dimensions ─────────────────────────────────────────────────────────────
  currentDepth: 0,
  currentTimestep: 0,
  verticalExaggeration: 40,

  // ── Date range picker ──────────────────────────────────────────────────────
  selectedDate: new Date().toISOString().slice(0, 10),
  dateRangeStart: new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10),
  dateRangeEnd:   new Date().toISOString().slice(0, 10),
  dateRangePickerOpen: false,

  // ── Live data status ───────────────────────────────────────────────────────
  isLiveData: false,
  lastSyncTime: null,
  isSyncing: false,

  // ── Variable & scale ───────────────────────────────────────────────────────
  selectedVariable: 'temp',
  colorScaleMode: 'linear',

  // ── Overlays ───────────────────────────────────────────────────────────────
  showCurrents: true,
  showFloats: true,
  showGrid: true,
  showTemporalMorphing: true,
  showContours: false,
  showDeltas: false,

  // ── Transient cursor ───────────────────────────────────────────────────────
  hoveredDepth: null,
  showProbePanel: false,

  // ── 3D Visual Layers ───────────────────────────────────────────────────────
  showThermocline: true,
  showFieldSlice: true,
  showIsoRipples: true,
  showBiomassParticles: true,
  showStratificationDrape: false,
  activeFlashVisual: null,

  // ── UI ─────────────────────────────────────────────────────────────────────
  viewMode: '3d-globe',
  activeInspectionTab: 'summary',
  flyToTarget: null,
  hologramMode: 'single',
  colorMode: 'scientific',
  explanationMode: 'expert',
  isAutoCentering: false,

  // ──────────────────────────────────────────────────────────────────────────
  // Action implementations
  // ──────────────────────────────────────────────────────────────────────────

  setMetadata: (meta) => set({ metadata: meta }),
  setIsAppLoading: (v) => set({ isAppLoading: v }),
  setIsSliceLoading: (v) => set({ isSliceLoading: v }),
  setIsProfileLoading: (v) => set({ isProfileLoading: v }),

  setAllFloats: (floats) => set({ allFloats: floats }),
  setAllProfiles: (profiles) => set({ allProfiles: profiles }),

  setSelectedFloat: (summary) =>
    set((state) => {
      // When de-selecting, also clear profile
      if (!summary) return { selectedFloat: null, selectedFloatProfile: null };
      // Mark float as visited when selected
      const updated = new Set(state.visitedFloatIds);
      updated.add(summary.id);
      return { selectedFloat: summary, visitedFloatIds: updated };
    }),

  setSelectedFloatProfile: (profile) => set({ selectedFloatProfile: profile }),

  markFloatVisited: (id) =>
    set((state) => {
      const updated = new Set(state.visitedFloatIds);
      updated.add(id);
      return { visitedFloatIds: updated };
    }),

  setSliceDataA: (data) => set({ sliceDataA: data }),
  setSliceDataB: (data) => set({ sliceDataB: data }),

  setCurrentDepth: (depth) => set({ currentDepth: depth }),
  setCurrentTimestep: (step) => set({ currentTimestep: step }),
  setVerticalExaggeration: (exagg) =>
    set({ verticalExaggeration: Math.max(10, Math.min(60, exagg)) }),

  setSelectedVariable: (variable) => set({ selectedVariable: variable }),
  setColorScaleMode: (mode) => set({ colorScaleMode: mode }),

  setDateRange: (start, end) => set({ dateRangeStart: start, dateRangeEnd: end }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDateRangePickerOpen: (open) => set({ dateRangePickerOpen: open }),
  setIsLiveData: (v) => set({ isLiveData: v }),
  setLastSyncTime: (t) => set({ lastSyncTime: t }),
  setIsSyncing: (v) => set({ isSyncing: v }),

  toggleLayer: (layer) =>
    set((state) => {
      if (layer === 'currents') return { showCurrents: !state.showCurrents };
      if (layer === 'floats')   return { showFloats: !state.showFloats };
      if (layer === 'grid')     return { showGrid: !state.showGrid };
      if (layer === 'morphing') return { showTemporalMorphing: !state.showTemporalMorphing };
      if (layer === 'contours') return { showContours: !state.showContours };
      if (layer === 'deltas')   return { showDeltas: !state.showDeltas };
      return {};
    }),

  setShowCurrents: (v) => set({ showCurrents: v }),
  setShowTemporalMorphing: (v) => set({ showTemporalMorphing: v }),

  setHoveredDepth: (depth) => set({ hoveredDepth: depth }),
  setShowProbePanel: (show) => set({ showProbePanel: show }),

  setShowThermocline: (v) => set({ showThermocline: v }),
  setShowFieldSlice: (v) => set({ showFieldSlice: v }),
  setShowIsoRipples: (v) => set({ showIsoRipples: v }),
  setShowBiomassParticles: (v) => set({ showBiomassParticles: v }),
  setShowStratificationDrape: (v) => set({ showStratificationDrape: v }),
  setActiveFlashVisual: (name) => set({ activeFlashVisual: name }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveInspectionTab: (tab) => set({ activeInspectionTab: tab }),
  setFlyToTarget: (target) => set({ flyToTarget: target }),
  setHologramMode: (mode) => set({ hologramMode: mode }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setExplanationMode: (mode) => set({ explanationMode: mode }),
  setIsAutoCentering: (v) => set({ isAutoCentering: v }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Convenience selector hooks — use these in components for minimal re-renders.
// Each returns only the exact slice of state the component needs.
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: read + write the currently selected float and its profile */
export const useSelectedFloat = () =>
  useOceanStore((s) => ({
    selectedFloat: s.selectedFloat,
    selectedFloatProfile: s.selectedFloatProfile,
    isProfileLoading: s.isProfileLoading,
    visitedFloatIds: s.visitedFloatIds,
    setSelectedFloat: s.setSelectedFloat,
    markFloatVisited: s.markFloatVisited,
  }));

/** Hook: read + write depth / time / exaggeration */
export const useSpatioTemporal = () =>
  useOceanStore((s) => ({
    currentDepth: s.currentDepth,
    currentTimestep: s.currentTimestep,
    verticalExaggeration: s.verticalExaggeration,
    setCurrentDepth: s.setCurrentDepth,
    setCurrentTimestep: s.setCurrentTimestep,
    setVerticalExaggeration: s.setVerticalExaggeration,
  }));

/** Hook: read + write the active variable and color scale mode */
export const useVariable = () =>
  useOceanStore((s) => ({
    selectedVariable: s.selectedVariable,
    colorScaleMode: s.colorScaleMode,
    setSelectedVariable: s.setSelectedVariable,
    setColorScaleMode: s.setColorScaleMode,
  }));

/** Hook: read + write the transient hover depth cursor */
export const useHoveredDepth = () =>
  useOceanStore((s) => ({
    hoveredDepth: s.hoveredDepth,
    setHoveredDepth: s.setHoveredDepth,
  }));

/** Hook: read + write view mode and inspection tab */
export const useViewMode = () =>
  useOceanStore((s) => ({
    viewMode: s.viewMode,
    activeInspectionTab: s.activeInspectionTab,
    setViewMode: s.setViewMode,
    setActiveInspectionTab: s.setActiveInspectionTab,
  }));

/** Hook: read + write the new UI modes */
export const useUIModes = () =>
  useOceanStore((s) => ({
    hologramMode: s.hologramMode,
    colorMode: s.colorMode,
    explanationMode: s.explanationMode,
    isAutoCentering: s.isAutoCentering,
    setHologramMode: s.setHologramMode,
    setColorMode: s.setColorMode,
    setExplanationMode: s.setExplanationMode,
    setIsAutoCentering: s.setIsAutoCentering,
  }));

/** Hook: read + write layer visibility toggles */
export const useLayerToggles = () =>
  useOceanStore((s) => ({
    showCurrents: s.showCurrents,
    showFloats: s.showFloats,
    showGrid: s.showGrid,
    showContours: s.showContours,
    showDeltas: s.showDeltas,
    toggleLayer: s.toggleLayer,
  }));

/** Hook: read slice data and loading state for Cesium/2D Dashboard */
export const useSliceData = () =>
  useOceanStore((s) => ({
    sliceDataA: s.sliceDataA,
    sliceDataB: s.sliceDataB,
    isSliceLoading: s.isSliceLoading,
    setSliceDataA: s.setSliceDataA,
    setSliceDataB: s.setSliceDataB,
    setIsSliceLoading: s.setIsSliceLoading,
  }));

/** Hook: fleet data for FleetSpatialHologram */
export const useFleetData = () =>
  useOceanStore((s) => ({
    allFloats: s.allFloats,
    allProfiles: s.allProfiles,
    metadata: s.metadata,
  }));
