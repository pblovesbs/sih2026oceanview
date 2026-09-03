import React from 'react';
import { VariableKey, OceanMetadata } from '../types/ocean';
import { getLegendGradient } from '../utils/colormaps';
import { useOceanStore } from '../store/useOceanStore';

interface LegendProps {
  variable: VariableKey;
  metadata: OceanMetadata | null;
  currentDepth: number;
}

export const Legend: React.FC<LegendProps> = React.memo(({ variable, metadata, currentDepth }) => {
  const colorMode = useOceanStore((s) => s.colorMode);
  const varMeta = metadata?.variables[variable] || {
    name: variable,
    unit: '',
    min: 0,
    max: 100,
  };

  const gradient = getLegendGradient(variable, colorMode);

  return (
    <div className="bg-navy-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl p-3 shadow-2xl w-64 pointer-events-auto">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-slate-200">{varMeta.name}</span>
        <span className="font-mono text-cyan-400 text-[11px]">Depth: {currentDepth}m</span>
      </div>

      {/* Gradient Color Bar */}
      <div
        className="h-3.5 w-full rounded-md shadow-inner border border-slate-700/50 mb-1.5"
        style={{ background: gradient }}
      />

      {/* Min / Max Labels */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>{varMeta.min} {varMeta.unit}</span>
        <span>{((varMeta.min + varMeta.max) / 2).toFixed(1)}</span>
        <span>{varMeta.max} {varMeta.unit}</span>
      </div>
    </div>
  );
});
