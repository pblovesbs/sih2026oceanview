/**
 * VariableSelector — Display Controls panel with collapsible sections for:
 * 1. 3D Scalar Fields (Variables)
 * 2. Overlays & Volumetric Context (Streamlines, Wavy Isosurfaces, Temporal Morphing, Floats, Grid, Probe)
 * 3. Display Modes & Palettes (Color Palette, Scale Mapping, Outreach Level)
 */
import React, { useState } from 'react';
import {
  ThermometerSun,
  Droplets,
  Scale,
  Leaf,
  Wind,
  Waves,
  Sparkles,
  Radio,
  Crosshair,
  Scan,
  Palette,
  SlidersHorizontal,
  Type,
  ChevronDown,
  Layers,
  Compass,
  Sliders,
  Gauge,
  Grid,
  Spline,
  GitCompare,
} from 'lucide-react';
import { VariableKey } from '../types/ocean';
import { useOceanStore } from '../store/useOceanStore';
import { HelpTooltip } from './HelpTooltip';

export const VariableSelector: React.FC = React.memo(() => {
  // Global store subscriptions
  const selectedVariable = useOceanStore((s) => s.selectedVariable);
  const setSelectedVariable = useOceanStore((s) => s.setSelectedVariable);

  const showCurrents = useOceanStore((s) => s.showCurrents);
  const showFloats = useOceanStore((s) => s.showFloats);
  const showGrid = useOceanStore((s) => s.showGrid);
  const showProbePanel = useOceanStore((s) => s.showProbePanel);
  const showThermocline = useOceanStore((s) => s.showThermocline);
  const showTemporalMorphing = useOceanStore((s) => s.showTemporalMorphing);
  const showContours = useOceanStore((s) => s.showContours);
  const showDeltas = useOceanStore((s) => s.showDeltas);

  const toggleLayer = useOceanStore((s) => s.toggleLayer);
  const setShowProbePanel = useOceanStore((s) => s.setShowProbePanel);
  const setShowThermocline = useOceanStore((s) => s.setShowThermocline);
  const setShowTemporalMorphing = useOceanStore((s) => s.setShowTemporalMorphing);

  const colorMode = useOceanStore((s) => s.colorMode);
  const setColorMode = useOceanStore((s) => s.setColorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);
  const setColorScaleMode = useOceanStore((s) => s.setColorScaleMode);
  const explanationMode = useOceanStore((s) => s.explanationMode);
  const setExplanationMode = useOceanStore((s) => s.setExplanationMode);

  // Collapsible section states (all open by default for discoverability)
  const [openScalar, setOpenScalar] = useState(true);
  const [openOverlays, setOpenOverlays] = useState(true);
  const [openModes, setOpenModes] = useState(true);

  const variables: { key: VariableKey; label: string; unit: string; icon: React.ElementType; color: string; desc: string; sig: string }[] = [
    { key: 'temp', label: 'Temperature', unit: '°C', icon: ThermometerSun, color: 'text-amber-400', desc: 'Sea water potential temperature', sig: 'Fundamental property dictating stratification and heat transport.' },
    { key: 'salinity', label: 'Salinity', unit: 'PSU', icon: Droplets, color: 'text-blue-400', desc: 'Practical Salinity Units', sig: 'Drives thermohaline circulation alongside temperature.' },
    { key: 'density', label: 'Density', unit: 'kg/m³', icon: Scale, color: 'text-emerald-400', desc: 'Potential Density Anomaly (σθ)', sig: 'Determines buoyancy and water mass stability/mixing.' },
    { key: 'chlorophyll', label: 'Chlorophyll-a', unit: 'mg/m³', icon: Leaf, color: 'text-green-400', desc: 'Photosynthetic pigment concentration', sig: 'Primary indicator of phytoplankton biomass and ocean productivity.' },
  ];

  const overlayItems = [
    {
      id: 'currents',
      label: 'Current Streamlines',
      description: 'GPU streaks advecting 3D geostrophic flow',
      significance: 'Visualizes the real-time velocity and direction of ocean currents, highlighting eddies and boundary currents.',
      icon: Wind,
      color: 'bg-indigo-500',
      activeColor: 'text-indigo-400',
      value: showCurrents,
      onClick: () => toggleLayer('currents'),
    },
    {
      id: 'thermocline',
      label: 'Wavy Isosurfaces',
      description: 'Thermocline barrier mesh with N² Gerstner waves',
      significance: 'Reveals internal wave dynamics and density gradients along the thermocline/isopycnal surfaces.',
      icon: Waves,
      color: 'bg-cyan-500',
      activeColor: 'text-cyan-400',
      value: showThermocline,
      onClick: () => setShowThermocline(!showThermocline),
    },
    {
      id: 'morphing',
      label: 'Temporal Morphing',
      description: '4D cross-fade interpolation across timesteps (Note: only visible during playback)',
      significance: 'Demonstrates the passage of time by visibly merging future states into current data.',
      icon: Sparkles,
      color: 'bg-purple-500',
      activeColor: 'text-purple-400',
      value: showTemporalMorphing,
      onClick: () => setShowTemporalMorphing(!showTemporalMorphing),
    },
    {
      id: 'floats',
      label: 'Argo Profilers',
      description: 'Active profiling float markers & tracks',
      significance: 'Displays the location and trajectories of autonomous Argo floats collecting in-situ profiles.',
      icon: Radio,
      color: 'bg-amber-500',
      activeColor: 'text-amber-400',
      value: showFloats,
      onClick: () => toggleLayer('floats'),
    },
    {
      id: 'grid',
      label: 'Coordinate Grid',
      description: 'Geospatial lat/lon & depth coordinates',
      significance: 'Provides spatial reference for latitude, longitude, and bathymetric depth across the basin.',
      icon: Grid,
      color: 'bg-teal-500',
      activeColor: 'text-teal-400',
      value: showGrid,
      onClick: () => toggleLayer('grid'),
    },
    {
      id: 'probe',
      label: 'Data Probe HUD',
      description: 'Real-time in-situ parameter inspection',
      significance: 'Enables interactive point-inspection to extract precise temperature, salinity, and depth values.',
      icon: Scan,
      color: 'bg-pink-500',
      activeColor: 'text-pink-400',
      value: showProbePanel,
      onClick: () => setShowProbePanel(!showProbePanel),
    },
    {
      id: 'contours',
      label: 'Isoline Contours',
      description: 'Dynamic data-driven marching squares isolines',
      significance: 'Outlines areas of equal value (isotherms, isohalines) to identify frontal boundaries and gradients.',
      icon: Spline,
      color: 'bg-lime-500',
      activeColor: 'text-lime-400',
      value: showContours,
      onClick: () => toggleLayer('contours'),
    },
    {
      id: 'deltas',
      label: 'Delta Anomaly Raster',
      description: 'Raster displaying anomaly changes between intervals',
      significance: 'Highlights regions undergoing the most rapid environmental changes compared to a baseline or previous timestep.',
      icon: GitCompare,
      color: 'bg-rose-500',
      activeColor: 'text-rose-400',
      value: showDeltas,
      onClick: () => toggleLayer('deltas'),
    },
  ];

  const activeOverlayCount = overlayItems.filter((item) => item.value).length;

  return (
    <div className="flex flex-col gap-2 w-72 pr-1 select-none custom-scrollbar">
      {/* ── Section 1: 3D Scalar Fields ────────────────────────────────────── */}
      <div className="flex flex-col rounded-xl bg-slate-900/40 border border-white/5 overflow-hidden transition-all">
        <button
          onClick={() => setOpenScalar(!openScalar)}
          className="flex items-center justify-between px-3 py-2 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">
              Scalar Fields
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
              {variables.find((v) => v.key === selectedVariable)?.label?.split(' ')[0] ?? 'Loading...'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openScalar ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </div>
        </button>

        {openScalar && (
          <div className="flex flex-col gap-1.5 p-2.5 bg-slate-950/20 max-h-48 overflow-y-auto custom-scrollbar">
            {variables.map((v) => {
              const Icon = v.icon;
              const isActive = selectedVariable === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setSelectedVariable(v.key)}
                  className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white shadow-md shadow-cyan-900/30 border border-cyan-400/60 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : v.color}`} />
                    <div className="flex items-center gap-1.5">
                      <span>{v.label}</span>
                      <div onClick={e => e.stopPropagation()}>
                        <HelpTooltip title={v.label} description={v.desc} significance={v.sig} iconOnly={true} />
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono ${isActive ? 'text-cyan-100' : 'text-slate-500'}`}>
                    {v.unit}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Overlays & Volumetric Context ───────────────────────── */}
      <div className="flex flex-col rounded-xl bg-slate-900/40 border border-white/5 overflow-hidden transition-all">
        <button
          onClick={() => setOpenOverlays(!openOverlays)}
          className="flex items-center justify-between px-3 py-2 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">
              Overlays &amp; Context
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60 text-indigo-300">
              {activeOverlayCount}/{overlayItems.length} Active
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openOverlays ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </div>
        </button>

        {openOverlays && (
          <div className="flex flex-col gap-1 p-2 bg-slate-950/20 max-h-64 overflow-y-auto custom-scrollbar">
            {overlayItems.map(({ id, icon: Icon, label, description, significance, color, activeColor, value, onClick }) => (
              <div
                key={id}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/5 transition-all text-left w-full"
              >
                <div className="flex items-start gap-2.5 min-w-0 pr-2 cursor-pointer w-full group" onClick={onClick}>
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${value ? activeColor : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white leading-tight">
                        {label}
                      </span>
                      <HelpTooltip 
                        title={label} 
                        description={description} 
                        significance={significance}
                        iconOnly={true}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">
                      {description}
                    </span>
                  </div>
                </div>

                <button
                  onClick={onClick}
                  className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
                    value ? color : 'bg-slate-700/80'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      value ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Display Modes & Palettes ────────────────────────────── */}
      <div className="flex flex-col rounded-xl bg-slate-900/40 border border-white/5 overflow-hidden transition-all">
        <button
          onClick={() => setOpenModes(!openModes)}
          className="flex items-center justify-between px-3 py-2 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-semibold text-slate-200">
              Display Modes
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300">
              {colorMode}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openModes ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </div>
        </button>

        {openModes && (
          <div className="flex flex-col gap-3 p-2.5 bg-slate-950/20">
            {/* Color Palette Mode */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium">
                <Palette className="w-3.5 h-3.5 text-cyan-400" />
                Color Palette
                <HelpTooltip 
                  title="Color Palette" 
                  description="Choose the visual color mapping algorithm." 
                  significance="Scientific sets standard oceanographic colors; Intuitive maps blue-red; Anomaly highlights extremes." 
                  iconOnly={true} 
                />
              </div>
              <div className="flex bg-slate-800/80 border border-slate-700/50 rounded-lg p-0.5 overflow-hidden">
                {['scientific', 'intuitive', 'anomaly'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setColorMode(mode as any)}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                      colorMode === mode
                        ? 'bg-cyan-600 text-white shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale Mapping (Linear / Log) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                Scale Mapping
                <HelpTooltip 
                  title="Scale Mapping" 
                  description="Adjust how data values are mapped to the color gradient." 
                  significance="Logarithmic scaling helps reveal details in highly skewed variables like Chlorophyll-a." 
                  iconOnly={true} 
                />
              </div>
              <div className="flex bg-slate-800/80 border border-slate-700/50 rounded-lg p-0.5 overflow-hidden">
                {['linear', 'log'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setColorScaleMode(mode as any)}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                      colorScaleMode === mode
                        ? 'bg-cyan-600 text-white shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    {mode === 'linear' ? 'Linear' : 'Logarithmic'}
                  </button>
                ))}
              </div>
            </div>

            {/* Outreach Level */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium">
                <Type className="w-3.5 h-3.5 text-cyan-400" />
                Outreach Level
                <HelpTooltip 
                  title="Outreach Level" 
                  description="Toggle the complexity of text descriptions across the app." 
                  significance="Simplifies technical jargon (e.g. 'Thermohaline') into accessible concepts for public science communication." 
                  iconOnly={true} 
                />
              </div>
              <div className="flex bg-slate-800/80 border border-slate-700/50 rounded-lg p-0.5 overflow-hidden">
                {['expert', 'simple'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setExplanationMode(mode as any)}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                      explanationMode === mode
                        ? 'bg-cyan-600 text-white shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    {mode === 'expert' ? 'Expert (Sci)' : 'Outreach (Simple)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
