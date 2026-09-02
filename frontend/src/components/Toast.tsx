import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

export const Toast: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Simulate an automated pipeline update 5 seconds after load
    const timer = setTimeout(() => {
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute top-20 right-4 z-50 bg-slate-950/90 backdrop-blur-md border border-emerald-500/50 p-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-down">
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
        <Activity className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-white">Pipeline sync</span>
        <span className="text-[10px] text-slate-300 font-mono">Latest CMEMS GLORYS12V1 ingested.</span>
      </div>
    </div>
  );
};
