import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { CesiumGlobe } from './components/CesiumGlobe';
import { VariableSelector } from './components/VariableSelector';
import { Legend } from './components/Legend';
import { TimeDepthControls } from './components/TimeDepthControls';
import { FloatDrawer } from './components/FloatDrawer';
import { OceanMetadata, SliceData, FloatSummary, VariableKey } from './types/ocean';
import { fetchMetadata, fetchFieldSlice, fetchFloats } from './services/api';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [metadata, setMetadata] = useState<OceanMetadata | null>(null);
  const [sliceData, setSliceData] = useState<SliceData | null>(null);
  const [floats, setFloats] = useState<FloatSummary[]>([]);
  const [selectedFloat, setSelectedFloat] = useState<FloatSummary | null>(null);

  const [currentVariable, setCurrentVariable] = useState<VariableKey>('temp');
  const [currentDepth, setCurrentDepth] = useState<number>(0);
  const [currentTimeIndex, setCurrentTimeIndex] = useState<number>(0);

  const [showCurrents, setShowCurrents] = useState<boolean>(true);
  const [showFloats, setShowFloats] = useState<boolean>(true);
  const [flyToTarget, setFlyToTarget] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [sliceLoading, setSliceLoading] = useState<boolean>(false);

  // Load initial metadata and floats
  useEffect(() => {
    async function init() {
      try {
        const [meta, floatsList] = await Promise.all([fetchMetadata(), fetchFloats()]);
        setMetadata(meta);
        setFloats(floatsList);

        // Load initial surface slice
        if (meta.time_steps && meta.time_steps.length > 0) {
          const initialSlice = await fetchFieldSlice(0, meta.time_steps[0], 'temp');
          setSliceData(initialSlice);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Update slice whenever depth, time, or variable changes
  useEffect(() => {
    if (!metadata || metadata.time_steps.length === 0) return;
    const timeStep = metadata.time_steps[currentTimeIndex];

    setSliceLoading(true);
    fetchFieldSlice(currentDepth, timeStep, currentVariable)
      .then((data) => setSliceData(data))
      .catch((err) => console.error('Error fetching slice:', err))
      .finally(() => setSliceLoading(false));
  }, [currentDepth, currentTimeIndex, currentVariable, metadata]);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-navy-950 flex flex-col items-center justify-center gap-4 text-slate-200">
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
  const timeSteps = metadata?.time_steps || [];

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-navy-950">
      {/* Top Header */}
      <Header
        metadata={metadata}
        pointCount={sliceData?.point_count || 0}
        onFlyTo={(target) => setFlyToTarget(target)}
      />

      {/* 3D Cesium Globe */}
      <CesiumGlobe
        metadata={metadata}
        sliceData={sliceData}
        floats={floats}
        currentVariable={currentVariable}
        currentDepth={currentDepth}
        showCurrents={showCurrents}
        showFloats={showFloats}
        onSelectFloat={(f) => setSelectedFloat(f)}
        flyToTarget={flyToTarget}
        onFlyToDone={() => setFlyToTarget(null)}
      />

      {/* Left Variable & Layer Overlays Switcher */}
      <VariableSelector
        currentVariable={currentVariable}
        onChange={(v) => setCurrentVariable(v)}
        showCurrents={showCurrents}
        onToggleCurrents={(s) => setShowCurrents(s)}
        showFloats={showFloats}
        onToggleFloats={(s) => setShowFloats(s)}
      />

      {/* Dynamic Colormap Legend */}
      <Legend
        variable={currentVariable}
        metadata={metadata}
        currentDepth={currentDepth}
      />

      {/* 4D Temporal & Vertical Depth Controls Dock */}
      <TimeDepthControls
        depthLevels={depthLevels}
        currentDepth={currentDepth}
        onDepthChange={(d) => setCurrentDepth(d)}
        timeSteps={timeSteps}
        currentTimeIndex={currentTimeIndex}
        onTimeIndexChange={(idx) => setCurrentTimeIndex(idx)}
      />

      {/* Slide-out Argo Float Profile Drawer */}
      <FloatDrawer
        selectedFloat={selectedFloat}
        onClose={() => setSelectedFloat(null)}
      />
    </main>
  );
};
