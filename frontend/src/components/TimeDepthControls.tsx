/**
 * TimeDepthControls — Fully redesigned 4D navigation dock.
 *
 * Features:
 *  - Ocean zone color bands (surface/mixed/thermocline/deep/abyssal)
 *  - Working date range picker connected to live data backend
 *  - Vertical exaggeration slider (10×–60×)
 *  - Live data sync indicator + force-refresh button
 *  - Smooth fractional scrubber with step dots
 *  - Playback controls with speed selection
 *  - Quick depth presets
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, Pause, SkipBack, SkipForward, Clock, Zap, Timer,
  RefreshCw, Radio, CalendarRange, ChevronDown, Expand, AlignCenter
} from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useOceanStore } from '../store/useOceanStore';
import { fetchDateRange, triggerLiveSync } from '../services/api';

type PlayMode = 'auto';

// ─── Ocean zone band definitions ─────────────────────────────────────────────
const OCEAN_ZONES = [
  { label: 'Surface',    minDepth: 0,    maxDepth: 10,   color: '#06b6d4', textColor: '#ecfeff' },
  { label: 'Mixed',      minDepth: 10,   maxDepth: 100,  color: '#0ea5e9', textColor: '#e0f2fe' },
  { label: 'Thermo',     minDepth: 100,  maxDepth: 500,  color: '#f97316', textColor: '#fff7ed' },
  { label: 'Deep',       minDepth: 500,  maxDepth: 1500, color: '#6366f1', textColor: '#eef2ff' },
  { label: 'Abyssal',   minDepth: 1500, maxDepth: 2000, color: '#7e22ce', textColor: '#faf5ff' },
];

function getZoneForDepth(depth: number) {
  return OCEAN_ZONES.find(z => depth >= z.minDepth && depth < z.maxDepth) || OCEAN_ZONES[OCEAN_ZONES.length - 1];
}

// ─── Date picker component ────────────────────────────────────────────────────
const DateRangePicker: React.FC<{
  timeSteps: string[];
  onTimeStepsLoaded: (steps: string[], resetPos: boolean) => void;
}> = ({ timeSteps, onTimeStepsLoaded }) => {
  const dateRangeStart    = useOceanStore((s) => s.dateRangeStart);
  const dateRangeEnd      = useOceanStore((s) => s.dateRangeEnd);
  const setDateRange      = useOceanStore((s) => s.setDateRange);
  const isSyncing         = useOceanStore((s) => s.isSyncing);
  const setIsSyncing      = useOceanStore((s) => s.setIsSyncing);
  const isLiveData        = useOceanStore((s) => s.isLiveData);
  const lastSyncTime      = useOceanStore((s) => s.lastSyncTime);
  const setLastSyncTime   = useOceanStore((s) => s.setLastSyncTime);
  const setIsLiveData     = useOceanStore((s) => s.setIsLiveData);

  const [localStart, setLocalStart] = useState(dateRangeStart);
  const [localEnd,   setLocalEnd]   = useState(dateRangeEnd);
  const [open,       setOpen]       = useState(false);
  const [error,      setError]      = useState('');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isNearBottom = rect.bottom > window.innerHeight - 350;
      setDropdownStyle({
        position: 'fixed',
        left: Math.max(8, rect.left),
        top: isNearBottom ? undefined : rect.bottom + 8,
        bottom: isNearBottom ? window.innerHeight - rect.top + 8 : undefined,
        zIndex: 9999,
      });
    }
  }, [open, localStart, localEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const applyRange = async () => {
    if (!localStart || !localEnd || localStart > localEnd) {
      setError('Start date must be before end date');
      return;
    }
    setError('');
    setDateRange(localStart, localEnd);
    setIsSyncing(true);
    try {
      const result = await fetchDateRange(localStart, localEnd);
      onTimeStepsLoaded(result.time_steps, true);
      setIsLiveData(true);
      setLastSyncTime(new Date().toISOString());
    } catch (e) {
      setError('Could not fetch date range. Using cached data.');
    } finally {
      setIsSyncing(false);
      setOpen(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await triggerLiveSync();
      setIsLiveData(true);
      setLastSyncTime(new Date().toISOString());
    } catch (e) {
      console.warn('Sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Live indicator */}
      <button
        onClick={handleSync}
        title={lastSyncTime ? `Last sync: ${new Date(lastSyncTime).toLocaleTimeString()}` : 'Click to enable live data'}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
          isLiveData
            ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-400 hover:bg-emerald-900/40'
            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-emerald-700/50'
        }`}
      >
        {isSyncing ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : (
          <Radio className={`w-3 h-3 ${isLiveData ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
        )}
        {isLiveData ? 'LIVE' : 'STATIC'}
      </button>

      {/* Date range button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[10px] font-mono text-cyan-300 hover:border-cyan-600/60 transition-all"
      >
        <CalendarRange className="w-3 h-3" />
        {dateRangeStart} to {dateRangeEnd}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown picker - PORTAL */}
      {open && createPortal(
        <div 
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-slate-900/95 border border-slate-700/60 rounded-xl p-3 shadow-2xl min-w-[280px] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-cyan-400" />
              Custom Date Range
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-0.5 block">Start Date</label>
                <input
                  type="date"
                  value={localStart}
                  max={localEnd}
                  min="2000-01-01"
                  onChange={e => setLocalStart(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-0.5 block">End Date</label>
                <input
                  type="date"
                  value={localEnd}
                  min={localStart}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setLocalEnd(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Today', days: 0 },
                { label: 'Last 7d', days: 7 },
                { label: 'Last 30d', days: 30 },
                { label: 'Last 90d', days: 90 },
                { label: '2024 Data', start: '2024-05-15', end: '2024-05-19' },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    if (preset.start) {
                      setLocalStart(preset.start);
                      setLocalEnd(preset.end || preset.start);
                    } else {
                      const today = new Date().toISOString().slice(0, 10);
                      const s = new Date(Date.now() - (preset.days || 0) * 86400e3).toISOString().slice(0, 10);
                      setLocalStart(s);
                      setLocalEnd(today);
                    }
                  }}
                  className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {error && <p className="text-[10px] text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-1.5 text-[11px] rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyRange}
                disabled={isSyncing}
                className="flex-1 py-1.5 text-[11px] rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {isSyncing && <RefreshCw className="w-3 h-3 animate-spin" />}
                Apply Range
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface TimeDepthControlsProps {
  depthLevels: number[];
  currentDepth: number;
  onDepthChange: (depth: number) => void;
  timeSteps: string[];
  timePosition: number;
  onTimePositionChange: (pos: number) => void;
  onTimeStepsChange?: (steps: string[]) => void;
  isPanelOpen?: boolean;
}

export const TimeDepthControls: React.FC<TimeDepthControlsProps> = ({
  depthLevels,
  currentDepth,
  onDepthChange,
  timeSteps,
  timePosition,
  onTimePositionChange,
  onTimeStepsChange,
  isPanelOpen = false,
}) => {
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [playbackSpeed,  setPlaybackSpeed]  = useState<number>(1200);
  const verticalExaggeration  = useOceanStore((s) => s.verticalExaggeration);
  const setVerticalExaggeration = useOceanStore((s) => s.setVerticalExaggeration);

  // Use a ref for the internal playback position (prevents interval recreate on every tick)
  const posRef = useRef(timePosition);
  posRef.current = timePosition;

  useEffect(() => {
    if (!isPlaying || timeSteps.length < 2) return;
    const maxPos = timeSteps.length - 1;
    const TICKS_PER_STEP = 30;
    const tickInterval = playbackSpeed / TICKS_PER_STEP;
    const timer = setInterval(() => {
      const next = posRef.current + (1 / TICKS_PER_STEP);
      onTimePositionChange(next >= maxPos + 0.99 ? 0 : Math.min(next, maxPos));
    }, tickInterval);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackSpeed, timeSteps.length]);

  const baseIndex = Math.min(Math.floor(timePosition), timeSteps.length - 1);
  const frac = timePosition - Math.floor(timePosition);

  const currentDate = timeSteps[baseIndex] ? new Date(timeSteps[baseIndex]) : new Date();
  const nextTimeLabel = timeSteps[baseIndex + 1]
    ? new Date(timeSteps[baseIndex + 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const stepBack    = useCallback(() => { onTimePositionChange(Math.max(0, Math.floor(timePosition) - 1)); setIsPlaying(false); }, [timePosition, onTimePositionChange]);
  const stepForward = useCallback(() => { onTimePositionChange(Math.min(timeSteps.length - 1, Math.floor(timePosition) + 1)); setIsPlaying(false); }, [timePosition, timeSteps.length, onTimePositionChange]);

  const currentZone = getZoneForDepth(currentDepth);

  const quickDepths = [
    { label: 'Surface', depth: 0,    color: '#06b6d4' },
    { label: 'Mixed',   depth: 50,   color: '#0ea5e9' },
    { label: 'Thermo',  depth: 200,  color: '#f97316' },
    { label: 'Deep',    depth: 1000, color: '#6366f1' },
    { label: 'Abyssal', depth: 2000, color: '#7e22ce' },
  ];

  const speedOptions = [
    { label: '0.5×', ms: 2400 },
    { label: '1×',   ms: 1200 },
    { label: '2×',   ms: 600  },
    { label: '4×',   ms: 300  },
  ];

  return (
    <>
      {/* ─── Right-Side Ocean Zone Depth Slider ─────────────────────────────── */}
      <DraggablePanel
        id="depth-slider"
        title="Depth Slicer"
        initialPosition={{ x: window.innerWidth - 100, y: 90 }}
        help={{
          description: 'Control the ocean depth cross-section being displayed.',
          significance: 'Colour bands show ocean zones: Surface (cyan), Mixed Layer (blue), Thermocline (orange), Deep (indigo), Abyssal (purple).',
        }}
      >
        <div className="flex flex-col items-center w-20 max-h-[500px] gap-2">
          {/* Current depth badge */}
          <div
            className="px-2 py-1 rounded-md font-mono text-xs font-bold shadow-inner whitespace-nowrap w-full text-center border"
            style={{
              background: `${currentZone.color}22`,
              borderColor: `${currentZone.color}55`,
              color: currentZone.color,
            }}
          >
            -{currentDepth}m
            <div className="text-[9px] font-normal opacity-70">{currentZone.label}</div>
          </div>

          {/* Zone-coloured depth level buttons */}
          <div className="flex flex-col w-full gap-0.5 overflow-y-auto max-h-[400px]">
            {depthLevels.map((d) => {
              const isSelected = currentDepth === d;
              const zone = getZoneForDepth(d);
              return (
                <button
                  key={d}
                  onClick={() => onDepthChange(d)}
                  className={`w-full py-1.5 px-1.5 text-[10px] font-mono rounded transition-all flex items-center justify-between gap-1 ${
                    isSelected ? 'font-bold scale-105 shadow-md' : 'opacity-60 hover:opacity-90'
                  }`}
                  style={{
                    background: isSelected ? `${zone.color}30` : `${zone.color}08`,
                    borderLeft: `3px solid ${zone.color}`,
                    color: isSelected ? zone.color : '#94a3b8',
                  }}
                >
                  <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ background: zone.color, opacity: isSelected ? 1 : 0.5 }} />
                  {d === 0 ? '0m' : `-${d}m`}
                </button>
              );
            })}
          </div>

          {/* Vertical Exaggeration slider */}
          <div className="w-full pt-2 border-t border-white/10">
            <div className="text-[9px] font-mono text-slate-400 text-center mb-1">V.Exagg.</div>
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mb-0.5">
              <span>10×</span><span className="text-cyan-400 font-bold">{verticalExaggeration}×</span><span>60×</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={verticalExaggeration}
              onChange={e => setVerticalExaggeration(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      </DraggablePanel>

      {/* ─── Bottom Timeline Dock ──────────────────────────────────────────────── */}
      <DraggablePanel
        id="timeline-dock"
        title="4D Timeline"
        initialPosition={{ x: Math.max(16, window.innerWidth / 2 - 350), y: window.innerHeight - 170 }}
      >
        <div className="w-[680px] flex flex-col gap-3">

          {/* Row 1: Playback + Date Display + Live Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {/* Playback buttons */}
              <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-xl p-1">
                <button onClick={stepBack} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors" title="Step Back">
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(v => !v)}
                  className={`p-2 rounded-lg text-white transition-all ${isPlaying ? 'bg-amber-600 shadow-md shadow-amber-600/30' : 'bg-cyan-600 shadow-md shadow-cyan-600/30'}`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </button>
                <button onClick={stepForward} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors" title="Step Forward">
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Live date display — now shows actual current date from timeSteps */}
              <div className="flex items-center bg-slate-950/60 border border-slate-700/60 rounded-xl px-3 py-1.5 gap-2 min-w-[160px]">
                <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="flex flex-col">
                  <div className="font-mono text-cyan-200 text-sm font-bold leading-none">
                    {currentDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  {nextTimeLabel && frac > 0.05 && (
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                      interpolating to {nextTimeLabel} ({Math.round(frac * 100)}%)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Date range picker */}
            <DateRangePicker
              timeSteps={timeSteps}
              onTimeStepsLoaded={(steps, reset) => {
                if (onTimeStepsChange) onTimeStepsChange(steps);
                if (reset) onTimePositionChange(0);
              }}
            />
          </div>

          {/* Row 2: Speed + Quick Depth Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950/50 border border-slate-800 rounded-xl p-1">
              <Timer className="w-3 h-3 text-amber-400 ml-1" />
              {speedOptions.map(opt => (
                <button
                  key={opt.ms}
                  onClick={() => setPlaybackSpeed(opt.ms)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-lg transition-colors ${playbackSpeed === opt.ms ? 'bg-amber-600/80 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-slate-950/50 border border-slate-800 rounded-xl p-1">
              <span className="text-[10px] font-mono text-slate-400 px-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Slice:
              </span>
              {quickDepths.map((qd) => (
                <button
                  key={qd.depth}
                  onClick={() => onDepthChange(qd.depth)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-lg transition-all ${
                    currentDepth === qd.depth ? 'font-semibold shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                  style={currentDepth === qd.depth ? { background: `${qd.color}30`, color: qd.color, border: `1px solid ${qd.color}50` } : {}}
                >
                  {qd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Fractional scrubber */}
          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 w-12 shrink-0">
              {timeSteps[0] ? new Date(timeSteps[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'T0'}
            </span>

            <div className="relative flex-1 flex items-center py-2">
              {/* Ocean zone gradient background track */}
              <div className="absolute h-3 top-1/2 -translate-y-1/2 left-0 right-0 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="h-full rounded-full transition-none"
                  style={{
                    width: `${(timePosition / Math.max(timeSteps.length - 1, 1)) * 100}%`,
                    background: 'linear-gradient(90deg, #06b6d4, #0ea5e9, #22d3ee)',
                  }}
                />
              </div>

              {/* Step dots */}
              <div className="absolute inset-0 flex justify-between items-center px-0">
                {timeSteps.slice(0, 50).map((ts, idx) => (
                  <button
                    key={idx}
                    onClick={() => { onTimePositionChange(idx); setIsPlaying(false); }}
                    title={new Date(ts).toLocaleDateString()}
                    className={`rounded-full border-2 z-10 transition-all ${
                      Math.floor(timePosition) === idx
                        ? 'w-4 h-4 bg-cyan-400 border-white scale-125 shadow-lg shadow-cyan-400/60'
                        : 'w-2.5 h-2.5 bg-slate-700 border-slate-900 hover:bg-slate-500 hover:scale-110'
                    }`}
                  />
                ))}
              </div>

              {/* Invisible continuous range input for drag */}
              <input
                type="range"
                min={0}
                max={Math.max(timeSteps.length - 1, 1)}
                step={0.01}
                value={timePosition}
                onChange={e => { onTimePositionChange(parseFloat(e.target.value)); setIsPlaying(false); }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
              />
            </div>

            <span className="text-[10px] font-mono text-slate-500 w-12 shrink-0 text-right">
              {timeSteps[timeSteps.length - 1]
                ? new Date(timeSteps[timeSteps.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : `T${timeSteps.length}`}
            </span>
          </div>

          {/* Live data source badge */}
          <div className="flex items-center gap-2 text-[9px] font-mono text-slate-600">
            <span>Sources:</span>
            <span className="text-slate-500">Argovis • NASA MODIS-Aqua • CMEMS NRT • INCOIS</span>
            <span className="ml-auto text-slate-600">
              {timeSteps.length} time steps • Bay of Bengal EEZ
            </span>
          </div>
        </div>
      </DraggablePanel>
    </>
  );
};
