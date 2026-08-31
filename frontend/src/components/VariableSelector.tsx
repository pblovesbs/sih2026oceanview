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
}

export const VariableSelector: React.FC<VariableSelectorProps> = ({
  currentVariable,
  onChange,
  showCurrents,
  onToggleCurrents,
  showFloats,
  onToggleFloats,
}) => {
  const variables: { key: VariableKey; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'temp', label: 'Temperature (°C)', icon: Thermometer, color: 'text-amber-400' },
    { key: 'salinity', label: 'Salinity (PSU)', icon: Droplets, color: 'text-cyan-400' },
    { key: 'density', label: 'Density (kg/m³)', icon: Scale, color: 'text-emerald-400' },
  ];

  return (
    <div className="absolute top-20 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
      {/* 3D Scalar Field Selector */}
      <div className="bg-navy-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl p-2 shadow-2xl flex flex-col gap-1 w-56">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-0.5">
          3D Ocean Field
        </span>
        {variables.map((v) => {
          const Icon = v.icon;
          const isActive = currentVariable === v.key;
          return (
            <button
              key={v.key}
              onClick={() => onChange(v.key)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-600/90 text-white shadow-md shadow-cyan-600/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : v.color}`} />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* Vector & Float Overlays Toggles */}
      <div className="bg-navy-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl p-2.5 shadow-2xl flex flex-col gap-2 w-56">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1">
          Layers & Overlays
        </span>
        
        {/* Currents vector toggle */}
        <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <Wind className="w-3.5 h-3.5 text-cyan-300" />
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
        <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
            <span>Argo Float Markers</span>
          </div>
          <input
            type="checkbox"
            checked={showFloats}
            onChange={(e) => onToggleFloats(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 accent-amber-500"
          />
        </label>
      </div>
    </div>
  );
};
