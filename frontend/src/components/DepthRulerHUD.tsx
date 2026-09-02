import React from 'react';
import { useOceanStore } from '../store/useOceanStore';

export const DepthRulerHUD: React.FC = () => {
  const storeHoveredDepth = useOceanStore((s) => s.hoveredDepth);

  // Depth ruler from 0 to 2000
  const maxDepth = 2000;
  const numTicks = 5;

  return (
    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 h-[60%] w-16 pointer-events-none z-30 flex flex-col items-center">
      <div className="relative w-full h-full border-r border-cyan-500/30 flex flex-col justify-between">
        {[...Array(numTicks + 1)].map((_, i) => {
          const depth = (i / numTicks) * maxDepth;
          return (
            <div key={i} className="relative flex items-center justify-end w-full">
              <span className="text-[10px] font-mono text-cyan-500/70 mr-2">{depth}m</span>
              <div className="w-2 h-px bg-cyan-500/50 absolute right-0"></div>
            </div>
          );
        })}

        {/* Animated cursor for active hovered depth */}
        {storeHoveredDepth !== null && (
          <div
            className="absolute right-0 flex items-center justify-end transition-all duration-100 ease-out"
            style={{
              top: `${(storeHoveredDepth / maxDepth) * 100}%`,
              transform: 'translateY(-50%)',
            }}
          >
            <span className="text-[12px] font-mono font-bold text-cyan-300 mr-2 bg-slate-900/80 px-1 rounded">
              {Math.round(storeHoveredDepth)}m
            </span>
            <div className="w-4 h-0.5 bg-cyan-300 shadow-[0_0_8px_#67e8f9]"></div>
            
            {/* Ripple effect */}
            <div className="absolute right-0 w-3 h-3 border border-cyan-300 rounded-full animate-ping opacity-75"></div>
          </div>
        )}
      </div>
    </div>
  );
};
