import React from 'react';
import { useOceanStore } from '../store/useOceanStore';

export const OutreachHUD: React.FC = () => {
  const explanationMode = useOceanStore((s) => s.explanationMode);
  const selectedVariable = useOceanStore((s) => s.selectedVariable);
  const currentDepth = useOceanStore((s) => s.currentDepth);

  if (explanationMode !== 'simple') return null;

  const getExplanation = () => {
    switch (selectedVariable) {
      case 'temp':
        if (currentDepth < 50) return "Surface waters are warm, heated by the sun. This heat drives monsoons and weather patterns across India.";
        if (currentDepth < 500) return "We are in the Twilight Zone. The water cools rapidly here, creating a 'thermocline' barrier that traps nutrients.";
        return "Deep ocean waters are cold and dark. These ancient waters hold most of the ocean's trapped carbon.";
      case 'salinity':
        if (currentDepth < 50) return "Surface salinity drops drastically during the monsoon due to heavy rainfall and river runoff (like the Ganges/Brahmaputra).";
        if (currentDepth < 500) return "Salinity stabilizes here. Notice how different water masses stack on top of each other like a layer cake.";
        return "Deep water salinity is very stable, originating from icy polar seas thousands of kilometers away.";
      case 'density':
        return "Density is the engine of ocean currents. Cold, salty water is heavy and sinks; warm, fresh water is light and floats.";
      case 'chlorophyll':
        return "Chlorophyll indicates phytoplankton — tiny plants that form the base of the marine food web and produce half the oxygen we breathe.";
      default:
        return "";
    }
  };

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-full max-w-2xl">
      <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 text-center shadow-[0_0_30px_rgba(6,182,212,0.15)] animate-fade-in-up">
        <h3 className="text-cyan-400 font-bold text-lg mb-1 capitalize">
          What are we looking at? ({selectedVariable})
        </h3>
        <p className="text-slate-200 text-sm leading-relaxed">
          {getExplanation()}
        </p>
      </div>
    </div>
  );
};
