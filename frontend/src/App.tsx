/**
 * App.tsx — Root orchestration component.
 *
 * This is the ONLY place that performs data-fetching and populates the
 * Zustand store. No other component should call the API directly.
 *
 * All UI state (selectedFloat, currentDepth, timePosition, etc.) now lives
 * in useOceanStore — App.tsx reads from the store and mutates it via the
 * typed action methods. Components downstream subscribe only to the slice
 * they need, preventing cascade re-renders during animation playback.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Header } from './components/Header';
import { CesiumGlobe } from './components/CesiumGlobe';
import { VariableSelector } from './components/VariableSelector';
import { Legend } from './components/Legend';
import { TimeDepthControls } from './components/TimeDepthControls';
import { Toast } from './components/Toast';
import { SliceData, VariableKey, FloatSummary } from './types/ocean';
import { fetchMetadata, fetchFieldSlice, fetchFloats, fetchFloatProfile } from './services/api';
import { Loader2, SlidersHorizontal, MapPin, Palette } from 'lucide-react';
import { FloatSelector } from './components/FloatSelector';
import { InspectionPanel } from './components/InspectionPanel';
import { TwoDViewDashboard } from './components/TwoDViewDashboard';
import { DraggablePanel } from './components/DraggablePanel';
import { ProbePanel } from './components/ProbePanel';
import { useOceanStore } from './store/useOceanStore';
import { DepthRulerHUD } from './components/DepthRulerHUD';
import { OutreachHUD } from './components/OutreachHUD';

export const App: React.FC = () => {
  // ── Read from store (selector-based — fine-grained subscriptions) ───────────
  const metadata           = useOceanStore((s) => s.metadata);
  const isAppLoading       = useOceanStore((s) => s.isAppLoading);
  const isSliceLoading     = useOceanStore((s) => s.isSliceLoading);
  const sliceDataA         = useOceanStore((s) => s.sliceDataA);
  const sliceDataB         = useOceanStore((s) => s.sliceDataB);
  const currentDepth       = useOceanStore((s) => s.currentDepth);
  const currentTimestep    = useOceanStore((s) => s.currentTimestep);
  const selectedVariable   = useOceanStore((s) => s.selectedVariable);
  const selectedFloat      = useOceanStore((s) => s.selectedFloat);
  const selectedFloatProfile = useOceanStore((s) => s.selectedFloatProfile);
  const showCurrents       = useOceanStore((s) => s.showCurrents);
  const showFloats         = useOceanStore((s) => s.showFloats);
  const showGrid           = useOceanStore((s) => s.showGrid);
  const flyToTarget        = useOceanStore((s) => s.flyToTarget);
  const viewMode           = useOceanStore((s) => s.viewMode);
  const allFloats          = useOceanStore((s) => s.allFloats);
  const allProfiles        = useOceanStore((s) => s.allProfiles);
  const visitedFloatIds    = useOceanStore((s) => s.visitedFloatIds);
  const isProfileLoading   = useOceanStore((s) => s.isProfileLoading);

  // ── Store actions ───────────────────────────────────────────────────────────
  const setMetadata            = useOceanStore((s) => s.setMetadata);
  const setIsAppLoading        = useOceanStore((s) => s.setIsAppLoading);
  const setIsSliceLoading      = useOceanStore((s) => s.setIsSliceLoading);
  const setSliceDataA          = useOceanStore((s) => s.setSliceDataA);
  const setSliceDataB          = useOceanStore((s) => s.setSliceDataB);
  const setAllFloats           = useOceanStore((s) => s.setAllFloats);
  const setAllProfiles         = useOceanStore((s) => s.setAllProfiles);
  const setSelectedFloat       = useOceanStore((s) => s.setSelectedFloat);
  const setSelectedFloatProfile = useOceanStore((s) => s.setSelectedFloatProfile);
  const setIsProfileLoading    = useOceanStore((s) => s.setIsProfileLoading);
  const markFloatVisited       = useOceanStore((s) => s.markFloatVisited);

  const handleSelectFloat = useCallback((f: FloatSummary) => {
    setSelectedFloat(f);
    markFloatVisited(f.id);
  }, [setSelectedFloat, markFloatVisited]);

  // ── Dynamic time steps (can be updated by date range picker) ───────────────
  const [dynamicTimeSteps, setDynamicTimeSteps] = useState<string[]>([]);

  // Initialize dynamic time steps from metadata
  useEffect(() => {
    if (metadata?.time_steps && metadata.time_steps.length > 0 && dynamicTimeSteps.length === 0) {
      setDynamicTimeSteps(metadata.time_steps);
    }
  }, [metadata]);

  const handleTimeStepsChange = useCallback((steps: string[]) => {
    // Clear cache when new timeline steps are selected to prevent memory bloat and stale data
    sliceCacheRef.current.clear();
    setDynamicTimeSteps(steps);
  }, []);

  const activeTimeSteps = dynamicTimeSteps.length > 0
    ? dynamicTimeSteps
    : (metadata?.time_steps || []);

  // This stays a ref because it's a performance cache, not render-reactive.
  // Slice *data* flows through the store; the cache key is the lookup mechanism.
  const sliceCacheRef   = useRef<Map<string, SliceData>>(new Map());
  const cacheLoadingRef = useRef(false);

  const cacheKey = useCallback(
    (depth: number, dateStr: string, variable: VariableKey) =>
      `${variable}:${depth}:${dateStr}`,
    []
  );

  // Pre-fetch all slices for current variable + depth combo (non-blocking)
  const preFetchAllTimesteps = useCallback(
    async (timeSteps: string[], depth: number, variable: VariableKey) => {
      if (!timeSteps || timeSteps.length === 0 || cacheLoadingRef.current) return;
      cacheLoadingRef.current = true;
      const cache = sliceCacheRef.current;
      for (let i = 0; i < timeSteps.length; i++) {
        const dateStr = timeSteps[i];
        const key = cacheKey(depth, dateStr, variable);
        if (!cache.has(key)) {
          try {
            const data = await fetchFieldSlice(depth, dateStr, variable);
            cache.set(key, data);
          } catch (e) {
            console.warn(`Pre-fetch failed for ${key}:`, e);
          }
        }
      }
      cacheLoadingRef.current = false;
    },
    [cacheKey]
  );

  // ── Bootstrap: fetch metadata + floats, seed initial slice ─────────────────
  useEffect(() => {
    async function init() {
      try {
        const [meta, floatsList] = await Promise.all([
          fetchMetadata(),
          fetchFloats(),
        ]);
        setMetadata(meta);
        setAllFloats(floatsList);

        if (meta.time_steps?.length > 0) {
          const date0 = meta.time_steps[0];
          const initialSlice = await fetchFieldSlice(0, date0, 'temp');
          sliceCacheRef.current.set(cacheKey(0, date0, 'temp'), initialSlice);
          setSliceDataA(initialSlice);

          if (meta.time_steps.length > 1) {
            const date1 = meta.time_steps[1];
            const slice1 = await fetchFieldSlice(0, date1, 'temp');
            sliceCacheRef.current.set(cacheKey(0, date1, 'temp'), slice1);
            setSliceDataB(slice1);
          }
          preFetchAllTimesteps(meta.time_steps, 0, 'temp');
        }

        // Load all float profiles in the background (3s delay to keep initial
        // render fast). These feed the Fleet 4D Spatial Hologram.
        setTimeout(async () => {
          const loaded: typeof allProfiles = [];
          for (const f of floatsList) {
            try {
              const p = await fetchFloatProfile(f.id);
              if (p) loaded.push({ profile: p, summary: f });
            } catch (_) { /* skip failed */ }
          }
          setAllProfiles(loaded);
        }, 3000);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsAppLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Refetch slices when depth / timestep / variable changes ────────────────
  useEffect(() => {
    if (activeTimeSteps.length === 0) return;
    const baseIdx = Math.min(Math.floor(currentTimestep), activeTimeSteps.length - 1);
    const nextIdx = Math.min(baseIdx + 1, activeTimeSteps.length - 1);
    const cache   = sliceCacheRef.current;
    
    const dateA = activeTimeSteps[baseIdx];
    const dateB = activeTimeSteps[nextIdx];
    
    const keyA    = cacheKey(currentDepth, dateA, selectedVariable);
    const keyB    = cacheKey(currentDepth, dateB, selectedVariable);

    const cachedA = cache.get(keyA);
    const cachedB = cache.get(keyB);

    if (cachedA) {
      setSliceDataA(cachedA);
    } else {
      setIsSliceLoading(true);
      fetchFieldSlice(currentDepth, dateA, selectedVariable)
        .then((data) => { cache.set(keyA, data); setSliceDataA(data); })
        .catch((err) => console.error('Slice A fetch error:', err))
        .finally(() => setIsSliceLoading(false));
    }

    if (cachedB) {
      setSliceDataB(cachedB);
    } else if (nextIdx !== baseIdx) {
      fetchFieldSlice(currentDepth, dateB, selectedVariable)
        .then((data) => { cache.set(keyB, data); setSliceDataB(data); })
        .catch((err) => console.error('Slice B fetch error:', err));
    }

    preFetchAllTimesteps(activeTimeSteps, currentDepth, selectedVariable);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(currentTimestep), currentDepth, selectedVariable, activeTimeSteps]);

  // ── Fetch FloatProfile when selected float changes ─────────────────────────
  useEffect(() => {
    if (selectedFloat) {
      setIsProfileLoading(true);
      fetchFloatProfile(selectedFloat.id)
        .then((data) => setSelectedFloatProfile(data))
        .catch((err) => console.error('Error fetching profile:', err))
        .finally(() => setIsProfileLoading(false));
    } else {
      setSelectedFloatProfile(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFloat?.id]);

  // ── Public accessor passed to InspectionPanel for the Summary sparkline ─────
  const getSlice = useCallback(
    (depth: number, timeIdx: number, variable: VariableKey) => {
      if (activeTimeSteps.length === 0) return undefined;
      const dateStr = activeTimeSteps[Math.min(timeIdx, activeTimeSteps.length - 1)];
      return sliceCacheRef.current.get(cacheKey(depth, dateStr, variable));
    },
    [cacheKey, activeTimeSteps]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (isAppLoading) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-200">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white tracking-wide">OceanView 4D</h2>
          <p className="text-xs text-cyan-400 font-mono mt-1">
            Loading Bay of Bengal 4D Ocean Digital Twin...
          </p>
        </div>
      </div>
    );
  }

  const depthLevels = metadata?.depth_levels || [0, 10, 25, 50, 100, 200, 500, 1000, 1500, 2000];
  const timeSteps   = activeTimeSteps;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950">

      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <Header
        metadata={metadata}
        pointCount={sliceDataA?.point_count || 0}
        sliceLoading={isSliceLoading}
        onFlyTo={(target) => useOceanStore.getState().setFlyToTarget(target)}
        viewMode={viewMode}
        onViewModeChange={(mode) => useOceanStore.getState().setViewMode(mode)}
      />

      {viewMode === '3d-globe' ? (
        <>
          {/* ── 3D Cesium Globe ──────────────────────────────────────────────── */}
          <CesiumGlobe
            metadata={metadata}
            sliceData={sliceDataA}
            sliceDataB={sliceDataB}
            timePosition={currentTimestep}
            timeSteps={activeTimeSteps}
            floats={allFloats}
            currentVariable={selectedVariable}
            currentDepth={currentDepth}
            showCurrents={showCurrents}
            showFloats={showFloats}
            showGrid={showGrid}
            selectedFloat={selectedFloat}
            selectedFloatProfile={selectedFloatProfile}
            onSelectFloat={(f) => {
              setSelectedFloat(f);
              markFloatVisited(f.id);
            }}
            flyToTarget={flyToTarget}
            onFlyToDone={() => useOceanStore.getState().setFlyToTarget(null)}
          />
          
          <DepthRulerHUD />
          <OutreachHUD />

          {/* ── UI Overlay — absolute floating panels without flex constraints ────────── */}
          <div className="transition-opacity duration-700 ease-in-out opacity-100 pointer-events-none z-10 absolute inset-0 p-4">

            {/* Display Controls - Docked Top-Left */}
            <DraggablePanel
              id="display-controls"
              title="Display Controls"
              icon={SlidersHorizontal}
              initialPosition={{ x: 16, y: 80 }}
              defaultMinimized={false}
              help={{
                description: 'Switch the displayed ocean variable and toggle map overlays.',
                significance: 'Controls which scalar field (Temp, Salinity, Density) is coloured on the globe.',
              }}
            >
              <VariableSelector />
            </DraggablePanel>

            {/* Argo Float Navigator - Docked Top-Right */}
            <DraggablePanel
              id="float-navigator"
              title="Argo Float Navigator"
              icon={MapPin}
              initialPosition={{ x: Math.max(16, window.innerWidth - 340), y: 80 }}
              defaultMinimized={false}
              help={{
                description: 'Search and select specific Argo profiling floats.',
                significance: 'Allows rapid targeting to inspect localized vertical profiles.',
              }}
            >
              <FloatSelector
                floats={allFloats}
                selectedFloat={selectedFloat}
                onSelect={handleSelectFloat}
              />
            </DraggablePanel>

            {/* Legend - Docked Bottom-Right */}
            <DraggablePanel
              id="legend"
              title="Legend"
              icon={Palette}
              initialPosition={{ x: Math.max(16, window.innerWidth - 340), y: Math.max(80, window.innerHeight - 280) }}
              defaultMinimized={false}
              help={{
                description: 'Displays the colormap scale and active variable data range.',
                significance: 'Provides the visual key for interpreting the currently mapped 3D scalar field.',
              }}
            >
              <Legend
                variable={selectedVariable}
                metadata={metadata}
                currentDepth={currentDepth}
              />
            </DraggablePanel>


            {/* Time/Depth controls and Probe — outside the sidebar, pointer-events managed inside */}
            <TimeDepthControls
              depthLevels={depthLevels}
              currentDepth={currentDepth}
              onDepthChange={(d) => useOceanStore.getState().setCurrentDepth(d)}
              timeSteps={timeSteps}
              timePosition={currentTimestep}
              onTimePositionChange={(pos) => useOceanStore.getState().setCurrentTimestep(pos)}
              onTimeStepsChange={handleTimeStepsChange}
              isPanelOpen={!!selectedFloat}
            />

            <ProbePanel />
          </div>

          <InspectionPanel
            selectedFloat={selectedFloat}
            profile={selectedFloatProfile}
            allProfiles={allProfiles}
            loading={isProfileLoading}
            onClose={() => setSelectedFloat(null)}
            metadata={metadata}
            getSlice={getSlice}
            visitedFloats={visitedFloatIds}
            onReplayCinematic={() => {
              if (selectedFloat) {
                const updated = new Set(visitedFloatIds);
                updated.delete(selectedFloat.id);
                // Directly patch store state for visited set
                useOceanStore.setState({ visitedFloatIds: updated });
              }
            }}
          />
        </>
      ) : (
        /* ── 2D Dashboard ─────────────────────────────────────────────────── */
        <TwoDViewDashboard
          sliceData={sliceDataA}
          floats={allFloats}
          currentVariable={selectedVariable}
          currentDepth={currentDepth}
        />
      )}

      <Toast />
    </main>
  );
};
