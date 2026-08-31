import React from 'react';
import { Thermometer, Droplets, Scale, Wind } from 'lucide-react';
import { VariableKey } from '../types/ocean';

interface VariableSelectorProps {
  currentVariable: VariableKey;
  onChange: (variable: VariableKey) => void;
  showCurrents: boolean;
  onToggleCurrents: (show: boolean) => void;
  showFloats: boolean;
  onToggleFloats: (show: boolean) => void;
  showGrid: boolean;
  onToggleGrid: (show: boolean) => void;
}

export const VariableSelector: React.FC<VariableSelectorProps> = ({
  currentVariable,
  onChange,
  showCurrents,
  onToggleCurrents,
  showFloats,
  onToggleFloats,
  showGrid,
  onToggleGrid,
}) => {
  const variables: { key: VariableKey; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'temp', label: 'Temperature (°C)', icon: Thermometer, color: 'text-amber-400' },
    { key: 'salinity', label: 'Salinity (PSU)', icon: Droplets, color: 'text-cyan-400' },
    { key: 'density', label: 'Density (kg/m³)', icon: Scale, color: 'text-emerald-400' },
  ];

  return (
    <div className="absolute top-20 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
      {/* 3D Scalar Field Selector */}
      <div className="bg-[#00000066] backdrop-blur-[16px] border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 w-64 transition-opacity duration-300">
        <span className="text-[clamp(10px,1vw,12px)] font-mono uppercase tracking-wider text-slate-300 px-2 py-0.5">
          3D Ocean Field
        </span>
        {variables.map((v) => {
          const Icon = v.icon;
          const isActive = currentVariable === v.key;
          return (
            <button
              key={v.key}
              onClick={() => onChange(v.key)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/90 text-white shadow-lg shadow-cyan-500/40 font-semibold border border-cyan-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : v.color}`} />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* Vector & Float Overlays Toggles */}
      <div className="bg-[#00000066] backdrop-blur-[16px] border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-3 w-64 mt-2 transition-opacity duration-300">
        <span className="text-[clamp(10px,1vw,12px)] font-mono uppercase tracking-wider text-slate-300 px-2">
          Layers & Overlays
        </span>
        
        {/* Currents vector toggle */}
        <label className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 cursor-pointer text-sm transition-colors border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3 text-slate-200">
            <Wind className="w-4 h-4 text-cyan-300" />
            <span>Current Vectors</span>
          </div>
          <input
            type="checkbox"
            checked={showCurrents}
            onChange={(e) => onToggleCurrents(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-400 accent-cyan-500"
          />
        </label>

        {/* Argo floats toggle */}
        <label className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 cursor-pointer text-sm transition-colors border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3 text-slate-200">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
            <span>Argo Float Markers</span>
          </div>
          <input
            type="checkbox"
            checked={showFloats}
            onChange={(e) => onToggleFloats(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 accent-amber-500"
          />
        </label>

        {/* Coordinate Grid toggle */}
        <label className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 cursor-pointer text-sm transition-colors border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3 text-slate-200">
            <span className="w-3 h-3 rounded-sm border border-cyan-400 opacity-80" />
            <span>Coordinate Grid</span>
          </div>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onToggleGrid(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-400 accent-cyan-500"
          />
        </label>
      </div>
    </div>
  );
};
