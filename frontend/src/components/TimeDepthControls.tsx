import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Layers, Clock, Zap } from 'lucide-react';

interface TimeDepthControlsProps {
  depthLevels: number[];
  currentDepth: number;
  onDepthChange: (depth: number) => void;
  timeSteps: string[];
  currentTimeIndex: number;
  onTimeIndexChange: (index: number) => void;
}

export const TimeDepthControls: React.FC<TimeDepthControlsProps> = ({
  depthLevels,
  currentDepth,
  onDepthChange,
  timeSteps,
  currentTimeIndex,
  onTimeIndexChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1500); // ms per step

  // Auto-play timeline loop
  useEffect(() => {
    let timer: any;
    if (isPlaying && timeSteps.length > 0) {
      timer = setInterval(() => {
        onTimeIndexChange((currentTimeIndex + 1) % timeSteps.length);
      }, playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentTimeIndex, timeSteps.length, playbackSpeed]);

  const currentTimeLabel = timeSteps[currentTimeIndex]
    ? new Date(timeSteps[currentTimeIndex]).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '2024-05-15';

  const quickDepths = [
    { label: 'Surface', depth: 0 },
    { label: 'Mixed (50m)', depth: 50 },
    { label: 'Thermocline (200m)', depth: 200 },
    { label: 'Deep (1000m)', depth: 1000 },
    { label: 'Abyssal (2000m)', depth: 2000 },
  ];

  return (
    <>
      {/* Right-Side Vertical Depth Slider Panel */}
      <div className="absolute right-4 top-24 bottom-32 z-20 flex flex-col items-center bg-navy-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl p-3 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 mb-3">
          <Layers className="w-4 h-4" />
          <span className="font-mono text-[11px] uppercase tracking-wider">Depth</span>
        </div>

        {/* Current depth badge */}
        <div className="px-2 py-1 bg-cyan-950 border border-cyan-700/80 rounded-md font-mono text-cyan-300 text-xs font-bold mb-3 shadow-inner">
          -{currentDepth}m
        </div>

        {/* Discrete Depth Buttons */}
        <div className="flex-1 flex flex-col justify-between items-center w-full gap-1">
          {depthLevels.map((d) => {
            const isSelected = currentDepth === d;
            return (
              <button
                key={d}
                onClick={() => onDepthChange(d)}
                className={`w-full py-1 px-1.5 text-[10px] font-mono rounded transition-all ${
                  isSelected
                    ? 'bg-cyan-500 text-navy-950 font-bold shadow-md shadow-cyan-500/40 scale-105'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                {d === 0 ? '0m' : `-${d}m`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Horizontal Timeline & 4D Controls Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-4xl bg-navy-900/90 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 pointer-events-auto">
        <div className="flex items-center justify-between">
          {/* Timeline Playback Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-xl p-1">
              <button
                onClick={() =>
                  onTimeIndexChange(
                    currentTimeIndex === 0 ? timeSteps.length - 1 : currentTimeIndex - 1
                  )
                }
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                title="Previous Time Step"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-2 rounded-lg text-white font-semibold transition-all ${
                  isPlaying
                    ? 'bg-amber-600 shadow-md shadow-amber-600/30'
                    : 'bg-cyan-600 shadow-md shadow-cyan-600/30'
                }`}
                title={isPlaying ? 'Pause 4D Playback' : 'Play 4D Time Series'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                onClick={() => onTimeIndexChange((currentTimeIndex + 1) % timeSteps.length)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                title="Next Time Step"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Date & Step Info */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" /> Observation Epoch
              </span>
              <span className="text-sm font-bold font-mono text-cyan-200">{currentTimeLabel}</span>
            </div>
          </div>

          {/* Quick Depth Presets */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950/50 border border-slate-800 rounded-xl p-1">
            <span className="text-[10px] font-mono text-slate-400 px-2 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Slices:
            </span>
            {quickDepths.map((qd) => (
              <button
                key={qd.depth}
                onClick={() => onDepthChange(qd.depth)}
                className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                  currentDepth === qd.depth
                    ? 'bg-cyan-600/90 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                {qd.label}
              </button>
            ))}
          </div>
        </div>

        {/* Temporal Progress Bar / Step Track */}
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 w-12">T-1</span>
          <div className="relative flex-1 flex items-center">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400 transition-all duration-300"
                style={{
                  width: `${
                    timeSteps.length > 1
                      ? (currentTimeIndex / (timeSteps.length - 1)) * 100
                      : 100
                  }%`,
                }}
              />
            </div>

            {/* Discrete step dots */}
            <div className="absolute inset-0 flex justify-between items-center px-1">
              {timeSteps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => onTimeIndexChange(idx)}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-transform ${
                    currentTimeIndex === idx
                      ? 'bg-cyan-400 border-white scale-125 shadow-lg shadow-cyan-400/50'
                      : 'bg-slate-700 border-slate-900 hover:bg-slate-500'
                  }`}
                  title={`Jump to step ${idx + 1}`}
                />
              ))}
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 w-12 text-right">
            T-{timeSteps.length}
          </span>
        </div>
      </div>
    </>
  );
};
