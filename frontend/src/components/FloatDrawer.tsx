import React, { useEffect, useState } from 'react';
import { X, Activity, Compass, Anchor, ExternalLink, RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { FloatSummary, FloatProfile } from '../types/ocean';

interface FloatDrawerProps {
  selectedFloat: FloatSummary | null;
  profile: FloatProfile | null;
  loading: boolean;
  onClose: () => void;
}

export const FloatDrawer: React.FC<FloatDrawerProps> = ({ selectedFloat, profile, loading, onClose }) => {
  const [activeTab, setActiveTab] = useState<'temp' | 'salinity' | 'density' | 'ts'>('temp');
  
  // Expose an event to the global window object to tell Cesium to toggle 3D mode
  const [is3DMode, setIs3DMode] = useState(false);

  useEffect(() => {
    const event = new CustomEvent('toggle3DHologram', { detail: { enabled: is3DMode } });
    window.dispatchEvent(event);
  }, [is3DMode]);



  if (!selectedFloat) return null;

  const chartData = profile?.data || [];

  return (
    <div className="absolute top-4 right-4 z-30 w-full max-w-[clamp(320px,25vw,400px)] h-[calc(100dvh-2rem)] bg-[#00000066] backdrop-blur-[16px] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto transition-transform duration-500 ease-out translate-x-0">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex justify-between items-start bg-black/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Anchor className="w-4 h-4" />
          </div>
          <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-[clamp(16px,1.5vw,18px)] font-bold text-white tracking-wide">Argo Float {selectedFloat.platform_number}</h2>
          </div>
          <p className="text-[clamp(11px,1vw,12px)] text-slate-400 font-mono">
            Cycle {selectedFloat.cycle} • {new Date(selectedFloat.date).toLocaleDateString()}
          </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metadata Overview Badge Grid */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/40 border-b border-slate-800 text-[11px] font-mono">
        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-500 block">Institution</span>
          <span className="text-slate-200 font-medium truncate block">
            {selectedFloat.institution}
          </span>
        </div>
        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-500 block">Obs Date</span>
          <span className="text-cyan-300 font-medium block">
            {new Date(selectedFloat.date).toLocaleDateString()}
          </span>
        </div>
        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-500 block">Max Profile Depth</span>
          <span className="text-emerald-400 font-medium block">-{selectedFloat.max_depth}m</span>
        </div>
        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-500 block">Data Mode</span>
          <span className="text-amber-400 font-medium block">Delayed Mode (QC)</span>
        </div>
      </div>

      {/* 2D vs 3D Mode Switcher */}
      <div className="p-3 bg-navy-950/80 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-300 font-medium">Visualization Mode</span>
        <button
          onClick={() => setIs3DMode(!is3DMode)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
            is3DMode ? 'bg-cyan-500' : 'bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              is3DMode ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Chart Tabs (Hidden in 3D Mode) */}
      {!is3DMode && (
        <div className="flex border-b border-slate-800 bg-navy-950/40 p-1 gap-1">
        <button
          onClick={() => setActiveTab('temp')}
          className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
            activeTab === 'temp'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Temp T(z)
        </button>
        <button
          onClick={() => setActiveTab('salinity')}
          className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
            activeTab === 'salinity'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Salinity S(z)
        </button>
        <button
          onClick={() => setActiveTab('density')}
          className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
            activeTab === 'density'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Density
        </button>
        <button
          onClick={() => setActiveTab('ts')}
          className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
            activeTab === 'ts'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          T-S Curve
        </button>
      </div>
      )}

      {/* Chart Display Area */}
      <div className="flex-1 p-3 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
            <span>Loading vertical ocean profile...</span>
          </div>
        ) : (
          <div className="w-full h-full min-h-[300px]">
            {activeTab === 'temp' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    type="number"
                    dataKey="temp"
                    domain={['auto', 'auto']}
                    unit="°C"
                    stroke="#94a3b8"
                    fontSize={10}
                  />
                  <YAxis
                    type="number"
                    dataKey="depth"
                    reversed
                    unit="m"
                    stroke="#94a3b8"
                    fontSize={10}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`${val} °C`, 'Temperature']}
                    labelFormatter={(depth: any) => `Depth: ${depth}m`}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#f59e0b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'salinity' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    type="number"
                    dataKey="psal"
                    domain={['auto', 'auto']}
                    unit="PSU"
                    stroke="#94a3b8"
                    fontSize={10}
                  />
                  <YAxis
                    type="number"
                    dataKey="depth"
                    reversed
                    unit="m"
                    stroke="#94a3b8"
                    fontSize={10}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`${val} PSU`, 'Salinity']}
                    labelFormatter={(depth: any) => `Depth: ${depth}m`}
                  />
                  <Line
                    type="monotone"
                    dataKey="psal"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#06b6d4' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'density' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    type="number"
                    dataKey="density"
                    domain={['auto', 'auto']}
                    unit="kg/m³"
                    stroke="#94a3b8"
                    fontSize={10}
                  />
                  <YAxis
                    type="number"
                    dataKey="depth"
                    reversed
                    unit="m"
                    stroke="#94a3b8"
                    fontSize={10}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`${val} kg/m³`, 'Density']}
                    labelFormatter={(depth: any) => `Depth: ${depth}m`}
                  />
                  <Line
                    type="monotone"
                    dataKey="density"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'ts' && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    type="number"
                    dataKey="psal"
                    name="Salinity"
                    unit="PSU"
                    stroke="#94a3b8"
                    fontSize={10}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    type="number"
                    dataKey="temp"
                    name="Temperature"
                    unit="°C"
                    stroke="#94a3b8"
                    fontSize={10}
                    domain={['auto', 'auto']}
                  />
                  <ZAxis type="number" dataKey="depth" range={[20, 80]} name="Depth" unit="m" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any, name: string) => [`${val}`, name]}
                  />
                  <Scatter data={chartData} fill="#c084fc" line={{ stroke: '#c084fc', strokeWidth: 1.5 }} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
        {is3DMode && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <Activity className="w-10 h-10 text-cyan-400 mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-white mb-2">3D Hologram Active</h4>
            <p className="text-xs text-slate-400">
              Look at the 3D globe to explore the holographic T-S scatter plot and volumetric data. Use Blender-style controls to orbit and pan around the float.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-navy-950 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-mono">
        <span>Argo Global Ocean Observing Network</span>
        <span className="text-cyan-400">Full India EEZ</span>
      </div>
    </div>
  );
};
