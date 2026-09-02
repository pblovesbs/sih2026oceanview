import React, { useState, useMemo } from 'react';
import { Search, MapPin, Calendar, Anchor } from 'lucide-react';
import { FloatSummary } from '../types/ocean';

interface FloatSelectorProps {
  floats: FloatSummary[];
  selectedFloat: FloatSummary | null;
  onSelect: (float: FloatSummary) => void;
}

export const FloatSelector: React.FC<FloatSelectorProps> = ({ floats, selectedFloat, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFloats = useMemo(() => {
    return floats.filter(f => 
      f.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      f.platform_number.toString().includes(searchTerm)
    );
  }, [floats, searchTerm]);

  return (
    <div className="flex flex-col gap-3 w-64">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by Platform ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
        {filteredFloats.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">No floats found</div>
        ) : (
          filteredFloats.map(float => {
            const isSelected = selectedFloat?.id === float.id;
            
            return (
              <button
                key={float.id}
                onClick={() => onSelect(float)}
                className={`w-full text-left p-2 rounded-lg border transition-all duration-200 flex flex-col gap-1.5
                  ${isSelected 
                    ? 'bg-cyan-950/60 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-xs font-bold ${isSelected ? 'text-cyan-400' : 'text-slate-200'}`}>
                    #{float.platform_number}
                  </span>
                </div>
                
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>{float.lat.toFixed(2)}°N, {float.lon.toFixed(2)}°E</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Calendar className="w-3 h-3 text-blue-400" />
                    <span>{new Date(float.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="text-slate-600 mx-0.5">•</span>
                    <Anchor className="w-3 h-3 text-slate-400" />
                    <span>{float.max_depth}m</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
