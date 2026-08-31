import React from 'react';
import { Compass, Waves, Navigation, ShieldCheck, Database } from 'lucide-react';
import { OceanMetadata } from '../types/ocean';

interface HeaderProps {
  metadata: OceanMetadata | null;
  pointCount: number;
  onFlyTo: (target: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ metadata, pointCount, onFlyTo }) => {
  return (
    <header className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
      {/* Left Title & Status Badge */}
      <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3 shadow-2xl pointer-events-auto">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
          <Waves className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-wide text-white flex items-center gap-1.5">
              OceanView <span className="text-cyan-400 font-mono text-xs px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80">4D</span>
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" /> Full India EEZ
            </span>
          </div>
          <p className="text-xs text-slate-300 font-mono flex items-center gap-2 mt-0.5">
            <span>68°E - 97°E, 6°N - 24°N</span>
            <span className="text-slate-500">•</span>
            <span className="text-cyan-300 font-semibold">{pointCount.toLocaleString()} 3D grid points</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-300">{metadata?.float_count || 15} Argo Floats</span>
          </p>
        </div>
      </div>

      {/* Right Camera Presets */}
      <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl pointer-events-auto">
        <span className="text-xs text-slate-300 font-mono px-2 flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" /> Presets:
        </span>
        <button
          onClick={() => onFlyTo('bay_of_bengal')}
          className="px-3 py-1.5 text-xs font-medium rounded-xl text-slate-200 hover:text-white bg-white/5 hover:bg-cyan-500/80 transition-all border border-white/5 shadow-sm"
        >
          Bay of Bengal
        </button>
        <button
          onClick={() => onFlyTo('full_india')}
          className="px-3 py-1.5 text-xs font-medium rounded-xl text-slate-200 hover:text-white bg-white/5 hover:bg-cyan-500/80 transition-all border border-white/5 shadow-sm"
        >
          India Subcontinent
        </button>
        <button
          onClick={() => onFlyTo('andaman')}
          className="px-3 py-1.5 text-xs font-medium rounded-xl text-slate-200 hover:text-white bg-white/5 hover:bg-cyan-500/80 transition-all border border-white/5 shadow-sm"
        >
          Andaman Basin
        </button>
        <button
          onClick={() => onFlyTo('chennai')}
          className="px-3 py-1.5 text-xs font-medium rounded-xl text-slate-200 hover:text-white bg-white/5 hover:bg-cyan-500/80 transition-all border border-white/5 shadow-sm"
        >
          Coromandel / EICC
        </button>
      </div>
    </header>
  );
};
