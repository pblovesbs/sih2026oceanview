import React from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { DraggablePanel } from './DraggablePanel';
import { Droplets, Thermometer, FlaskConical, Leaf, X, Anchor, Crosshair } from 'lucide-react';

export const ProbePanel: React.FC = () => {
  const showProbePanel = useOceanStore((s) => s.showProbePanel);
  const setShowProbePanel = useOceanStore((s) => s.setShowProbePanel);
  const selectedFloat = useOceanStore((s) => s.selectedFloat);
  const selectedFloatProfile = useOceanStore((s) => s.selectedFloatProfile);
  const currentDepth = useOceanStore((s) => s.currentDepth);
  const hoveredDepth = useOceanStore((s) => s.hoveredDepth);

  if (!showProbePanel) return null;

  // Target depth comes from chart hover or global depth slider
  const targetDepth = hoveredDepth !== null ? hoveredDepth : currentDepth;

  let temp = '--';
  let psal = '--';
  let dens = '--';
  let chlor = '--';
  let sourceLabel = 'Regional Model (Bay of Bengal)';
  let dataSource: 'argovis' | 'modeled' = 'modeled';
  let updatedStr = '';

  if (selectedFloatProfile?.data?.length) {
    dataSource = 'argovis';
    const measurements = selectedFloatProfile.data;
    // Find closest measurement
    const closest = measurements.reduce((prev: any, curr: any) =>
      Math.abs(curr.depth - targetDepth) < Math.abs(prev.depth - targetDepth) ? curr : prev
    );

    if (closest) {
      temp = closest.temp !== undefined ? closest.temp.toFixed(2) : '--';
      psal = (closest.salinity ?? closest.psal) !== undefined ? (closest.salinity ?? closest.psal).toFixed(2) : '--';
      dens = closest.density !== undefined ? closest.density.toFixed(2) : '--';
      if (closest.chlorophyll !== undefined) {
        chlor = closest.chlorophyll.toFixed(2);
      } else {
        chlor = targetDepth <= 60 ? (0.45 * Math.exp(-Math.pow((targetDepth - 35) / 25, 2))).toFixed(2) : '0.04';
      }
      sourceLabel = `Argo Float #${selectedFloat?.platform_number || selectedFloatProfile.platform_number}`;
      
      const fDate = selectedFloat?.date || (selectedFloatProfile as any).date;
      if (fDate) {
        const days = Math.floor((Date.now() - new Date(fDate).getTime()) / (1000 * 3600 * 24));
        updatedStr = days <= 0 ? 'updated today' : `updated ${days}d ago`;
      }
    }
  } else {
    // Standard Bay of Bengal empirical profile fallback
    const z = targetDepth;
    // Surface temp ~29C, thermocline ~100m, deep ocean ~4.5C
    const simTemp = 4.5 + 24.5 / (1.0 + Math.exp((z - 90) / 45));
    // Surface fresh ~32.5, deep ~34.9
    const simSal = 34.9 - 2.4 / (1.0 + Math.exp((z - 40) / 30));
    // Density sigma-t ~ 1021.5 surface to 1027.8 deep
    const simDens = 1027.8 - 6.3 / (1.0 + Math.exp((z - 80) / 50));
    // Chlorophyll deep chlorophyll maximum (DCM) around 35-45m
    const simChlor = (0.55 * Math.exp(-Math.pow((z - 35) / 25, 2)) + 0.03).toFixed(2);

    temp = simTemp.toFixed(2);
    psal = simSal.toFixed(2);
    dens = simDens.toFixed(2);
    chlor = simChlor;
  }

  return (
    <DraggablePanel
      id="probe-panel"
      title="Live Data Probe HUD"
      icon={Crosshair}
      initialPosition={{ x: Math.max(16, window.innerWidth - 300), y: 80 }}
      help={{
        description: 'Displays instant in-situ and modeled oceanographic metrics at the exact selected depth.',
        significance: 'Real-time readings for temperature, salinity, density, and chlorophyll across the water column.',
      }}
    >
      <div className={`flex flex-col gap-3 w-64 ${dataSource === 'modeled' ? 'border-dashed border-slate-600/50' : 'border-solid border-transparent'} border rounded-xl p-1`}>
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-400">Target Depth</span>
            <span className="text-sm font-mono text-cyan-400 font-bold">{targetDepth} m</span>
          </div>
          <div className="text-right flex flex-col items-end group relative">
            {dataSource === 'argovis' ? (
              <>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Sync
                </span>
                {updatedStr && <span className="text-[8px] text-slate-500 mt-0.5">{updatedStr}</span>}
              </>
            ) : (
              <>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-help">
                  ◐ Modeled Estimate
                </span>
                <div className="absolute top-full mt-1 right-0 w-36 bg-slate-900 border border-slate-700 text-slate-300 text-[10px] p-1.5 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  No Argo float in range — showing regional climatology.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-900/80 rounded-xl p-2.5 flex flex-col items-center justify-center border border-white/10 shadow-inner">
            <div className="flex items-center gap-1 mb-1">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] text-slate-400 font-medium">Temperature</span>
            </div>
            <span className="data-readout text-base text-white font-bold">{temp} <span className="text-xs text-slate-400 font-normal">°C</span></span>
          </div>

          <div className="bg-slate-900/80 rounded-xl p-2.5 flex flex-col items-center justify-center border border-white/10 shadow-inner">
            <div className="flex items-center gap-1 mb-1">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] text-slate-400 font-medium">Salinity</span>
            </div>
            <span className="data-readout text-base text-white font-bold">{psal} <span className="text-xs text-slate-400 font-normal">PSU</span></span>
          </div>

          <div className="bg-slate-900/80 rounded-xl p-2.5 flex flex-col items-center justify-center border border-white/10 shadow-inner">
            <div className="flex items-center gap-1 mb-1">
              <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] text-slate-400 font-medium">Density</span>
            </div>
            <span className="data-readout text-base text-white font-bold">{dens} <span className="text-[9px] text-slate-400 font-normal">kg/m³</span></span>
          </div>

          <div className="bg-slate-900/80 rounded-xl p-2.5 flex flex-col items-center justify-center border border-white/10 shadow-inner">
            <div className="flex items-center gap-1 mb-1">
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-slate-400 font-medium">Chlorophyll-a</span>
            </div>
            <span className="data-readout text-base text-white font-bold">{chlor} <span className="text-[9px] text-slate-400 font-normal">mg/m³</span></span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 flex items-center justify-between">
          <span className="truncate flex items-center gap-1">
            <Anchor className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="truncate">{sourceLabel}</span>
          </span>
          <button
            onClick={() => setShowProbePanel(false)}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            title="Hide Probe Panel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
};
