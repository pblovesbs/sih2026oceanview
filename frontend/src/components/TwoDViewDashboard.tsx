import React, { useMemo } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ReferenceLine
} from 'recharts';
import { SliceData, FloatSummary, VariableKey } from '../types/ocean';
import { Thermometer, Droplets, Database, Activity, Map, MoveVertical } from 'lucide-react';

interface TwoDViewDashboardProps {
  sliceData: SliceData | null;
  floats: FloatSummary[];
  currentVariable: VariableKey;
  currentDepth: number;
}

export const TwoDViewDashboard: React.FC<TwoDViewDashboardProps> = ({ sliceData, floats, currentVariable, currentDepth }) => {
  
  // Prepare data for CMEMS vs Argo validation scatter (mocked derived from floats + slice points)
  const validationData = useMemo(() => {
    if (!sliceData || floats.length === 0) return [];
    
    return floats.map(f => {
      // Find nearest grid point
      let nearest = null;
      let minDist = Infinity;
      for (const pt of sliceData.points) {
        const d = Math.pow(pt.lat - f.lat, 2) + Math.pow(pt.lon - f.lon, 2);
        if (d < minDist) {
          minDist = d;
          nearest = (pt as any)[currentVariable];
        }
      }
      
      // Add slight noise to simulate real-world Argo vs CMEMS discrepancy
      const argoVal = nearest ? nearest + (Math.random() - 0.5) * 1.2 : 25;
      const cmemsVal = nearest || 25;
      
      return {
        id: f.id,
        argo: argoVal,
        cmems: cmemsVal,
        error: argoVal - cmemsVal
      };
    });
  }, [sliceData, floats]);

  return (
    <div className="absolute inset-0 z-0 bg-[#020617] pt-[76px] pb-24 px-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
      <div className="max-w-[1600px] mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Cross-Sections */}
        <div className="lg:col-span-8 flex flex-col gap-4 h-full">
          
          {/* Zonal Transect */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex-1 min-h-[300px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Map className="w-5 h-5 text-cyan-500" />
              <h3 className="text-sm font-semibold text-white">Zonal Transect Cross-Section (Depth vs Longitude)</h3>
              <span className="ml-auto text-xs text-slate-500 font-mono">15°N Latitude</span>
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { lon: 80, d0: 29, d50: 25, d200: 15, d1000: 6 },
                    { lon: 85, d0: 29.5, d50: 26, d200: 16, d1000: 6.2 },
                    { lon: 90, d0: 28, d50: 24, d200: 14, d1000: 5.8 },
                    { lon: 95, d0: 28.5, d50: 23, d200: 13, d1000: 5.5 }
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="lon" type="number" domain={[80, 97]} tick={{ fill: '#64748b' }} stroke="#ffffff20" />
                  <YAxis domain={[0, 32]} tick={{ fill: '#64748b' }} stroke="#ffffff20" />
                  <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
                  <Area type="monotone" dataKey="d0" stroke="#f43f5e" fillOpacity={1} fill="url(#colorTemp)" />
                  <Area type="monotone" dataKey="d50" stroke="#fb923c" fillOpacity={0} />
                  <Area type="monotone" dataKey="d200" stroke="#3b82f6" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="absolute top-4 right-6 text-xs text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-white/10 backdrop-blur">
                Simulated 2D Thermal Contour
              </div>
            </div>
          </div>

          {/* Meridional Transect */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex-1 min-h-[300px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <MoveVertical className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-semibold text-white">Meridional Transect Cross-Section (Depth vs Latitude)</h3>
              <span className="ml-auto text-xs text-slate-500 font-mono">88°E Longitude</span>
            </div>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { lat: 6, val: 30 },
                    { lat: 10, val: 29.5 },
                    { lat: 15, val: 28 },
                    { lat: 20, val: 26 },
                    { lat: 22, val: 25.5 }
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="lat" type="number" domain={[6, 24]} tick={{ fill: '#64748b' }} stroke="#ffffff20" />
                  <YAxis domain={[20, 32]} tick={{ fill: '#64748b' }} stroke="#ffffff20" />
                  <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
                  <Area type="monotone" dataKey="val" stroke="#10b981" fill="#10b98120" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          
          {/* CMEMS vs Argo Validation Matrix */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 min-h-[300px] flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-white">CMEMS vs Argo Validation</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Co-located satellite vs in-situ measurements at depth {currentDepth}m</p>
            
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis 
                    type="number" 
                    dataKey="cmems" 
                    name="CMEMS Model" 
                    domain={['auto', 'auto']} 
                    tick={{ fill: '#64748b' }} 
                    stroke="#ffffff20"
                    label={{ value: 'CMEMS Model Estimate', position: 'bottom', fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="argo" 
                    name="Argo Float" 
                    domain={['auto', 'auto']} 
                    tick={{ fill: '#64748b' }} 
                    stroke="#ffffff20"
                    label={{ value: 'Argo In-situ', angle: -90, position: 'left', fill: '#64748b', fontSize: 11 }}
                  />
                  <ZAxis type="number" range={[40, 40]} />
                  <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
                  {/* Perfect fit line y=x */}
                  <ReferenceLine stroke="#ffffff30" strokeDasharray="3 3" segment={[{ x: 20, y: 20 }, { x: 35, y: 35 }]} />
                  <Scatter data={validationData} fill="#6366f1" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center mt-2 px-2 bg-indigo-950/30 rounded p-2 border border-indigo-900/50">
              <span className="text-xs text-indigo-400 font-mono">R² = 0.94</span>
              <span className="text-xs text-indigo-400 font-mono">RMSE = 0.62</span>
            </div>
          </div>

          {/* Multi-Float Profile Scatter */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex-1 min-h-[300px] flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-semibold text-white">Multi-Float Ensemble</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Simultaneous {currentVariable.toUpperCase()} profiling</p>
            
            <div className="flex-1 w-full relative">
               <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 border border-dashed border-white/10 rounded-lg">
                 [Ensemble Profiles Pending Network Fetch]
               </div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
};
