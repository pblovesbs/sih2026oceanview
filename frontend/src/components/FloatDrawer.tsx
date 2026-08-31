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
import { fetchFloatProfile } from '../services/api';

interface FloatDrawerProps {
  selectedFloat: FloatSummary | null;
  onClose: () => void;
}

export const FloatDrawer: React.FC<FloatDrawerProps> = ({ selectedFloat, onClose }) => {
  const [profile, setProfile] = useState<FloatProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'temp' | 'salinity' | 'density' | 'ts'>('temp');

  useEffect(() => {
    if (selectedFloat) {
      setLoading(true);
      fetchFloatProfile(selectedFloat.id)
        .then((data) => setProfile(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setProfile(null);
    }
  }, [selectedFloat]);

  if (!selectedFloat) return null;

  const chartData = profile?.data || [];

  return (
    <div className="absolute top-4 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] z-30 bg-navy-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto transition-all animate-in slide-in-from-right">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-700/60 flex items-center justify-between bg-navy-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Anchor className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
              WMO {selectedFloat.platform_number}
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Cycle #{selectedFloat.cycle}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {selectedFloat.lat.toFixed(2)}°N, {selectedFloat.lon.toFixed(2)}°E
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

      {/* Chart Tabs */}
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
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-navy-950 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-mono">
        <span>Argo Global Ocean Observing Network</span>
        <span className="text-cyan-400">Bay of Bengal Sector</span>
      </div>
    </div>
  );
};
