import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { FloatMeasurement, FloatProfile, FloatSummary } from '../types/ocean';
import { useOceanStore, HologramMode } from '../store/useOceanStore';
import { HologramVolume, LivingThermoclineSheet } from './HologramVolume';
import { computeSigmaTheta, classifyWaterMass, computeDCMChlorophyll } from '../utils/oceanPhysics';
import type { ColorMode, ColorScaleMode } from '../store/useOceanStore';
import { getColorForValue } from '../utils/colormaps';

// ─────────────────────────────────────────────────────────────────────────────
// Unified Color Mapping Engine (Synced with Global Display Controls & Legend)
// ─────────────────────────────────────────────────────────────────────────────

function getThreeColor(
  val: number,
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll',
  minVal?: number,
  maxVal?: number,
  colorMode: ColorMode = 'scientific',
  colorScaleMode: ColorScaleMode = 'linear'
): THREE.Color {
  let defMin = 4, defMax = 32;
  if (variable === 'salinity') { defMin = 31.0; defMax = 36.5; }
  else if (variable === 'density') { defMin = 1021.0; defMax = 1028.5; }
  else if (variable === 'chlorophyll') { defMin = 0.05; defMax = 2.5; }

  const min = minVal !== undefined ? minVal : defMin;
  const max = maxVal !== undefined ? maxVal : defMax;
  const { r, g, b } = getColorForValue(val, variable, min, max, colorMode, colorScaleMode);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D Float Profile Column (Physical Space)
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileColumnProps {
  measurements: FloatMeasurement[];
  position: [number, number, number];
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  hoveredDepth: number | null;
  isSelected?: boolean;
  platformNumber?: string;
  maxDepth?: number;
}

const ProfileColumn: React.FC<ProfileColumnProps> = ({
  measurements,
  position,
  variable,
  hoveredDepth,
  isSelected,
  platformNumber,
  maxDepth = 2000,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const colorMode = useOceanStore((s) => s.colorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);

  const { thermoclineY, thermoclineDepth, mldY, mldDepth, dcmY, dcmDepth, dcmPeakVal } = useMemo(() => {
    let tDepth = null;
    let mDepth = null;
    let dDepth = null;
    let maxGrad = 0;
    let maxChl = 0;
    for (let i = 1; i < measurements.length; i++) {
      const dz = measurements[i].depth - measurements[i - 1].depth;
      const dt = Math.abs(measurements[i].temp - measurements[i - 1].temp);
      if (dz > 0 && dt / dz > maxGrad) {
        maxGrad = dt / dz;
        tDepth = measurements[i].depth;
      }
    }
    for (let i = 0; i < measurements.length; i++) {
      const chl = measurements[i].chlorophyll ?? computeDCMChlorophyll(measurements[i].depth);
      if (chl > maxChl) {
        maxChl = chl;
        dDepth = measurements[i].depth;
      }
    }
    if (measurements.length) {
      const thresh = measurements[0].density + 0.03;
      mDepth = measurements.find((d) => d.density > thresh)?.depth ?? null;
    }
    const tY = tDepth ? -((tDepth / maxDepth) * 1.8) + 0.9 : null;
    const mY = mDepth ? -((mDepth / maxDepth) * 1.8) + 0.9 : null;
    const dY = dDepth ? -((dDepth / maxDepth) * 1.8) + 0.9 : null;
    return { thermoclineY: tY, thermoclineDepth: tDepth, mldY: mY, mldDepth: mDepth, dcmY: dY, dcmDepth: dDepth, dcmPeakVal: maxChl };
  }, [measurements, maxDepth]);

  const nodes = useMemo(() => {
    if (!measurements.length) return [];
    const sorted = [...measurements].sort((a, b) => a.depth - b.depth);

    // Compute float-specific vertical min/max for expressive individual column gradient
    const vals = sorted.map((m) => {
      if (variable === 'temp') return m.temp;
      if (variable === 'salinity') return m.salinity;
      if (variable === 'chlorophyll') return m.chlorophyll ?? computeDCMChlorophyll(m.depth);
      return m.density;
    });
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    return sorted.map((m) => {
      const y = -((m.depth / maxDepth) * 1.8) + 0.9;
      let val = m.temp;
      if (variable === 'salinity') val = m.salinity;
      else if (variable === 'chlorophyll') val = m.chlorophyll ?? computeDCMChlorophyll(m.depth);
      else if (variable === 'density') val = m.density;

      const col = getThreeColor(val, variable, minVal, maxVal, colorMode, colorScaleMode);

      return {
        pos: new THREE.Vector3(0, y, 0),
        y,
        col,
        hex: `#${col.getHexString()}`,
        depth: m.depth,
      };
    });
  }, [measurements, variable, maxDepth, colorMode, colorScaleMode]);

  const lineGeometry = useMemo(() => {
    if (nodes.length < 2) return null;
    const posArr: number[] = [];
    const colArr: number[] = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      posArr.push(0, nodes[i].y, 0);
      posArr.push(0, nodes[i + 1].y, 0);
      colArr.push(nodes[i].col.r, nodes[i].col.g, nodes[i].col.b);
      colArr.push(nodes[i + 1].col.r, nodes[i + 1].col.g, nodes[i + 1].col.b);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    return g;
  }, [nodes]);

  const hoveredY = hoveredDepth !== null ? -((hoveredDepth / maxDepth) * 1.8) + 0.9 : null;

  return (
    <group ref={groupRef} position={position}>
      {lineGeometry && (
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial vertexColors transparent opacity={0.9} linewidth={2} />
        </lineSegments>
      )}

      {nodes.map((n, idx) => {
        const isHovered = hoveredDepth !== null && Math.abs(n.depth - hoveredDepth) < 30;
        const radius = isHovered ? 0.045 : isSelected ? 0.025 : 0.018;
        return (
          <mesh key={idx} position={[0, n.y, 0]}>
            <sphereGeometry args={[radius, 12, 12]} />
            <meshBasicMaterial color={n.hex} toneMapped={false} />
          </mesh>
        );
      })}

      {platformNumber && (
        <Text
          position={[0, 0.98, 0]}
          fontSize={0.07}
          color={isSelected ? '#38bdf8' : '#94a3b8'}
          anchorX="center"
          anchorY="bottom"
        >
          {platformNumber}
        </Text>
      )}
    </group>
  );
};
// ─────────────────────────────────────────────────────────────────────────────
// 3D Visual Layers
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Single Float Active Layer Field Disk (Dynamic physics-colored horizontal disk) */
const DynamicLayerFieldDisk: React.FC<{
  measurements: FloatMeasurement[];
  activeDepth: number;
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  maxDepth?: number;
  isFlashing?: boolean;
}> = ({ measurements, activeDepth, variable, maxDepth = 2000, isFlashing }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const colorMode = useOceanStore((s) => s.colorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);

  const { activeColor, activeHex, activeValueText } = useMemo(() => {
    if (!measurements.length) {
      return { activeColor: new THREE.Color('#06b6d4'), activeHex: '#06b6d4', activeValueText: '' };
    }
    const nearest = measurements.reduce((prev, curr) =>
      Math.abs(curr.depth - activeDepth) < Math.abs(prev.depth - activeDepth) ? curr : prev
    );

    let val = nearest.temp;
    let text = `${nearest.temp.toFixed(2)}°C`;
    if (variable === 'salinity') {
      val = nearest.salinity;
      text = `${nearest.salinity.toFixed(2)} PSU`;
    } else if (variable === 'density') {
      val = nearest.density;
      text = `${nearest.density.toFixed(2)} kg/m³`;
    } else if (variable === 'chlorophyll') {
      const chl = nearest.chlorophyll ?? computeDCMChlorophyll(nearest.depth);
      val = chl;
      text = `${chl.toFixed(3)} mg/m³`;
    }

    const col = getThreeColor(val, variable, undefined, undefined, colorMode, colorScaleMode);
    return { activeColor: col, activeHex: '#' + col.getHexString(), activeValueText: text };
  }, [measurements, activeDepth, variable, colorMode, colorScaleMode]);

  const yPos = -((activeDepth / maxDepth) * 1.8) + 0.9;

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.elapsedTime;
      const s = 1 + Math.sin(t * 3.0) * 0.03;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={[0, yPos, 0]}>
      {/* Translucent physics-colored horizontal field disc */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.92, 64]} />
        <meshBasicMaterial
          color={activeHex}
          transparent
          opacity={isFlashing ? 0.9 : 0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Sonar grid concentric rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.31, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.61, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Luminous outer boundary perimeter ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 0.94, 64]} />
        <meshBasicMaterial
          color={activeHex}
          transparent
          opacity={isFlashing ? 1.0 : 0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3D Floating Parameter Readout Tag */}
      <group position={[0.5, 0.08, 0.5]}>
        <Text
          fontSize={0.06}
          color="#ffffff"
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#020617"
        >
          {`${Math.round(activeDepth)}m · ${activeValueText}`}
        </Text>
      </group>
    </group>
  );
};

/** 2. Fleet Layer Field Slice (High-Res 128x128 Gaussian IDW Heatmap with In-Situ Dynamic Contrast) */
const FleetLayerFieldSlice: React.FC<{
  allProfiles: { profile: FloatProfile; summary: FloatSummary }[];
  activeDepth: number;
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  maxDepth?: number;
  isFlashing?: boolean;
}> = ({ allProfiles, activeDepth, variable, maxDepth = 2000, isFlashing }) => {
  const canvasRef = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvasRef);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [canvasRef]);

  const colorMode = useOceanStore((s) => s.colorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);
  const [valueRange, setValueRange] = useState<{ min: number; max: number; unit: string }>({ min: 0, max: 0, unit: '' });

  const yPos = -((activeDepth / maxDepth) * 1.8) + 0.9;

  useEffect(() => {
    const ctx = canvasRef.getContext('2d');
    if (!ctx || !allProfiles.length) return;

    const lats = allProfiles.map((p) => p.summary.lat);
    const lons = allProfiles.map((p) => p.summary.lon);
    const latMin = Math.min(...lats), latMax = Math.max(...lats) || latMin + 1;
    const lonMin = Math.min(...lons), lonMax = Math.max(...lons) || lonMin + 1;

    // Sample float values at active depth
    const samples = allProfiles.map(({ profile, summary }) => {
      const u = (summary.lon - lonMin) / (lonMax - lonMin);
      const v = (summary.lat - latMin) / (latMax - latMin);
      const data = profile.data || [];
      const nearest = data.reduce((prev, curr) =>
        Math.abs(curr.depth - activeDepth) < Math.abs(prev.depth - activeDepth) ? curr : prev
      );

      let val = 20;
      if (variable === 'temp') val = nearest?.temp ?? 20;
      else if (variable === 'salinity') val = nearest?.salinity ?? 34;
      else if (variable === 'density') val = nearest?.density ?? 1024;
      else val = nearest?.chlorophyll ?? computeDCMChlorophyll(activeDepth);

      return { x: u * 128, y: (1 - v) * 128, val };
    });

    const vals = samples.map((s) => s.val);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const unit = variable === 'temp' ? '°C' : variable === 'salinity' ? 'PSU' : variable === 'density' ? 'kg/m³' : 'mg/m³';
    setValueRange({ min: minVal, max: maxVal, unit });

    // Adaptive contrast scaling: ensure spatial shifts are visually distinct and vibrant across the layer
    let minSpan = 2.4;
    if (variable === 'salinity') minSpan = 0.7;
    else if (variable === 'density') minSpan = 0.5;
    else if (variable === 'chlorophyll') minSpan = 0.35;

    const span = Math.max(maxVal - minVal, minSpan);
    const midVal = (minVal + maxVal) / 2;
    const effMin = midVal - span / 2;
    const effMax = midVal + span / 2;

    const imgData = ctx.createImageData(128, 128);
    const data = imgData.data;

    // Gaussian Kernel IDW Interpolation
    for (let py = 0; py < 128; py++) {
      for (let px = 0; px < 128; px++) {
        let weightSum = 0;
        let weightedVal = 0;

        for (const s of samples) {
          const dx = (px - s.x) / 128;
          const dy = (py - s.y) / 128;
          const distSq = dx * dx + dy * dy;
          const w = Math.exp(-distSq / (2 * 0.09 * 0.09)) + 0.002 / (distSq + 0.006);
          weightSum += w;
          weightedVal += s.val * w;
        }

        const interpolated = weightSum > 0 ? weightedVal / weightSum : midVal;
        const col = getThreeColor(interpolated, variable, effMin, effMax, colorMode, colorScaleMode);

        const idx = (py * 128 + px) * 4;
        data[idx] = Math.round(col.r * 255);
        data[idx + 1] = Math.round(col.g * 255);
        data[idx + 2] = Math.round(col.b * 255);
        data[idx + 3] = 225; // Rich opacity
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw dynamic contour isolines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    for (const s of samples) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.x, s.y, 32, 0, Math.PI * 2);
      ctx.stroke();
    }

    texture.needsUpdate = true;
  }, [allProfiles, activeDepth, variable, canvasRef, texture, colorMode, colorScaleMode]);

  return (
    <group position={[0, yPos, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={isFlashing ? 0.98 : 0.82}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Grid line accents on slice */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 2, 12, 12]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Floating 3D Parameter Readout Badge with Dynamic Min-Max Range */}
      <group position={[0.92, 0.08, 0.92]}>
        <Text fontSize={0.055} color="#ffffff" anchorX="right" anchorY="bottom" outlineWidth={0.005} outlineColor="#020617">
          {`Fleet 4D Heatmap (${Math.round(activeDepth)}m): ${valueRange.min.toFixed(1)}${valueRange.unit} ── ${valueRange.max.toFixed(1)}${valueRange.unit}`}
        </Text>
      </group>
    </group>
  );
};

/** 3. Multi-Source Wave Influence & Continuous Overlapping Ripples */
const IsoContourRipples: React.FC<{
  position: [number, number, number];
  activeDepthY: number;
  val?: number;
  variable?: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  minVal?: number;
  maxVal?: number;
  isFlashing?: boolean;
}> = ({ position, activeDepthY, val = 20, variable = 'temp', minVal, maxVal, isFlashing }) => {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const colorMode = useOceanStore((s) => s.colorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);

  const waveColor = useMemo(() => {
    return getThreeColor(val, variable, minVal, maxVal, colorMode, colorScaleMode);
  }, [val, variable, minVal, maxVal, colorMode, colorScaleMode]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.6;
    const r1 = (t % 2.4) / 2.4;
    const r2 = ((t + 1.2) % 2.4) / 2.4;

    // Expanding wave influence discs up to ~0.65m radius (continuous cross-float overlap)
    if (ring1Ref.current) {
      ring1Ref.current.scale.set(0.1 + r1 * 0.85, 0.1 + r1 * 0.85, 1);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - r1) * (isFlashing ? 1.0 : 0.75);
    }
    if (ring2Ref.current) {
      ring2Ref.current.scale.set(0.1 + r2 * 0.85, 0.1 + r2 * 0.85, 1);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - r2) * (isFlashing ? 1.0 : 0.75);
    }
    if (discRef.current) {
      const pulse = 0.5 + Math.sin(clock.elapsedTime * 2.5) * 0.15;
      (discRef.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.35;
    }
  });

  return (
    <group position={[position[0], activeDepthY, position[2]]}>
      {/* Soft continuous radial influence disc */}
      <mesh ref={discRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 36]} />
        <meshBasicMaterial color={waveColor} transparent opacity={0.3} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Expanding wavefronts with additive interference */}
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.07, 0.11, 36]} />
        <meshBasicMaterial color={waveColor} transparent opacity={0.8} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.07, 0.11, 36]} />
        <meshBasicMaterial color={waveColor} transparent opacity={0.8} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

/** 4. Structured 3D Euphotic Biomass Bloom Cloud (0m - 150m with DCM Peak) */
const BiomassParticles: React.FC<{
  activeDepth: number;
  activeDepthY: number;
  measurements: FloatMeasurement[];
  position?: [number, number, number];
  showLabel?: boolean;
  isFlashing?: boolean;
}> = ({ activeDepth, activeDepthY, measurements, position = [0, 0, 0], showLabel = true, isFlashing }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Find float's DCM peak depth and in-situ chlorophyll
  const { dcmDepth, peakChl, inSituChl, isInsideDCM, isEuphotic } = useMemo(() => {
    let dDepth = 75;
    let maxChl = 1.8;
    for (let i = 0; i < measurements.length; i++) {
      const chl = measurements[i].chlorophyll ?? computeDCMChlorophyll(measurements[i].depth);
      if (chl > maxChl) {
        maxChl = chl;
        dDepth = measurements[i].depth;
      }
    }

    const nearest = measurements.length
      ? measurements.reduce((prev, curr) => (Math.abs(curr.depth - activeDepth) < Math.abs(prev.depth - activeDepth) ? curr : prev))
      : null;
    const currChl = nearest?.chlorophyll ?? computeDCMChlorophyll(activeDepth);
    const insideDCM = Math.abs(activeDepth - dDepth) <= 25;
    const euphotic = activeDepth <= 150;

    return { dcmDepth: dDepth, peakChl: maxChl, inSituChl: currChl, isInsideDCM: insideDCM, isEuphotic: euphotic };
  }, [measurements, activeDepth]);

  // Generate structured 3D Euphotic Bio-Cloud (peaking at DCM depth)
  const { euphoticGeometry, dcmY } = useMemo(() => {
    const dY = -((dcmDepth / 2000) * 1.8) + 0.9;
    const pos = [];
    const colors = [];
    const totalPoints = 320;

    for (let i = 0; i < totalPoints; i++) {
      // Gaussian distribution centered at DCM depth in euphotic zone (0m to 150m)
      const u1 = Math.random();
      const u2 = Math.random();
      const zNorm = Math.sqrt(-2.0 * Math.log(u1 || 0.001)) * Math.cos(2.0 * Math.PI * u2);
      const depth = Math.max(5, Math.min(150, dcmDepth + zNorm * 30));
      const y = -((depth / 2000) * 1.8) + 0.9;

      const angle = Math.random() * Math.PI * 2;
      const r = (Math.sqrt(Math.random()) * 0.7) * (1 - Math.abs(depth - dcmDepth) / 180);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      pos.push(x, y, z);

      // Concentration-driven color
      const localChl = computeDCMChlorophyll(depth);
      const col = getThreeColor(localChl, 'chlorophyll');
      colors.push(col.r, col.g, col.b);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return { euphoticGeometry: g, dcmY: dY };
  }, [dcmDepth]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.12;
    }
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 4.0) * 0.05;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={position}>
      {/* 3D Euphotic Biomass Constellation Cloud (0m - 150m) */}
      <group ref={groupRef}>
        <points geometry={euphoticGeometry}>
          <pointsMaterial
            vertexColors
            size={isFlashing ? 0.045 : 0.03}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      </group>

      {/* Active Depth Intersect Bio-Ring */}
      {isEuphotic && (
        <group position={[0, activeDepthY, 0]}>
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, 0.28, 36]} />
            <meshBasicMaterial
              color={isInsideDCM ? '#22c55e' : '#10b981'}
              transparent
              opacity={isInsideDCM ? 0.9 : 0.5}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* 3D Photic Ecological Status Readout (only when showLabel is true) */}
          {showLabel && (
            <group position={[0.32, 0.04, 0.32]}>
              <Text fontSize={0.045} color={isInsideDCM ? '#4ade80' : '#a7f3d0'} anchorX="left" anchorY="middle" outlineWidth={0.005} outlineColor="#020617">
                {isInsideDCM
                  ? `🌿 DCM Bloom Peak · ${inSituChl.toFixed(2)} mg/m³`
                  : `Photic Biomass · ${inSituChl.toFixed(2)} mg/m³`}
              </Text>
            </group>
          )}
        </group>
      )}

      {/* Aphotic indicator when deep */}
      {!isEuphotic && showLabel && (
        <group position={[0, activeDepthY, 0]}>
          <group position={[0.32, 0.04, 0.32]}>
            <Text fontSize={0.04} color="#64748b" anchorX="left" anchorY="middle" outlineWidth={0.004} outlineColor="#020617">
              {`Aphotic Abyss · 0.00 mg/m³ Chl`}
            </Text>
          </group>
        </group>
      )}
    </group>
  );
};

/** 5. Stratification Drape Curtain (Vertical water mass ribbon profile) */
const StratificationDrape: React.FC<{
  measurements: FloatMeasurement[];
  activeDepth: number;
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  position?: [number, number, number];
  width?: number;
  maxDepth?: number;
  isFlashing?: boolean;
}> = ({ measurements, activeDepth, variable, position = [0, 0, 0], width = 0.45, maxDepth = 2000, isFlashing }) => {
  const colorMode = useOceanStore((s) => s.colorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);

  const geom = useMemo(() => {
    if (!measurements.length) return null;
    const sorted = [...measurements].sort((a, b) => a.depth - b.depth);
    const sub = sorted.filter((m) => m.depth <= activeDepth + 20);
    if (sub.length < 2) return null;

    const vals = sorted.map((m) => {
      if (variable === 'temp') return m.temp;
      if (variable === 'salinity') return m.salinity;
      if (variable === 'chlorophyll') return m.chlorophyll ?? computeDCMChlorophyll(m.depth);
      return m.density;
    });
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    const pos = [];
    const col = [];
    const halfW = width / 2;

    for (let i = 0; i < sub.length; i++) {
      const m = sub[i];
      const y = -((m.depth / maxDepth) * 1.8) + 0.9;
      let val = m.temp;
      if (variable === 'salinity') val = m.salinity;
      else if (variable === 'density') val = m.density;
      else if (variable === 'chlorophyll') val = m.chlorophyll ?? computeDCMChlorophyll(m.depth);

      const c = getThreeColor(val, variable, minVal, maxVal, colorMode, colorScaleMode);

      // Left edge
      pos.push(-halfW, y, 0);
      col.push(c.r, c.g, c.b);
      // Right edge
      pos.push(halfW, y, 0);
      col.push(c.r, c.g, c.b);
    }

    const indices = [];
    for (let i = 0; i < sub.length - 1; i++) {
      const i0 = i * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;
      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [measurements, activeDepth, variable, width, maxDepth]);

  if (!geom) return null;

  return (
    <group position={position}>
      <mesh geometry={geom}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={isFlashing ? 0.9 : 0.65}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Axis & Ticks for Physical Space
// ─────────────────────────────────────────────────────────────────────────────

const AxisLabels: React.FC<{ maxDepth: number }> = ({ maxDepth }) => {
  const depthLabels = [0, 250, 500, 1000, 1500, 2000].filter((d) => d <= maxDepth);
  return (
    <group>
      {depthLabels.map((d) => {
        const y = -((d / maxDepth) * 1.8) + 0.9;
        return (
          <group key={d}>
            <Text position={[-1.05, y, 0]} fontSize={0.05} color="#64748b" anchorX="right" anchorY="middle">
              {`${d}m`}
            </Text>
            <mesh position={[-1.0, y, 0]}>
              <boxGeometry args={[0.04, 0.005, 2.0]} />
              <meshBasicMaterial color="#1e293b" transparent opacity={0.6} />
            </mesh>
          </group>
        );
      })}
      <Text position={[0, -1.02, 0]} fontSize={0.06} color="#0ea5e9" anchorX="center" anchorY="top">
        Longitude Axis
      </Text>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3D T-S Phase Space Scene (Idea 1: Dual-Space Hologram)
// Coordinates: X = Salinity (30..36), Y = Temperature (4..32), Z = Depth (0..2000)
// ─────────────────────────────────────────────────────────────────────────────

interface TSPhaseSpaceSceneProps {
  profile: FloatProfile | null;
  hoveredDepth: number | null;
}

const TSPhaseSpaceScene: React.FC<TSPhaseSpaceSceneProps> = ({ profile, hoveredDepth }) => {
  const measurements = profile?.data || [];
  
  const salMin = 30.5;
  const salMax = 36.0;
  const tempMin = 4.0;
  const tempMax = 32.0;
  const depthMax = 2000.0;

  // Map (S, T, z) to 3D Box coordinates [-0.9, +0.9]
  const mapCoords = (s: number, t: number, z: number): [number, number, number] => {
    const x = ((s - salMin) / (salMax - salMin)) * 1.8 - 0.9;
    const y = ((t - tempMin) / (tempMax - tempMin)) * 1.8 - 0.9;
    const zPos = -((z / depthMax) * 1.8) + 0.9;
    return [x, y, zPos];
  };

  const points = useMemo(() => {
    if (!measurements.length) return [];
    return measurements.map((m) => {
      const sal = m.salinity ?? m.psal ?? 34.0;
      const [x, y, z] = mapCoords(sal, m.temp, m.depth);
      const sigma = computeSigmaTheta(m.temp, sal);
      const wm = classifyWaterMass(m.temp, sal, m.depth);
      const col = getThreeColor(m.temp, 'temp');
      return {
        x, y, z,
        rawS: sal,
        rawT: m.temp,
        depth: m.depth,
        sigma,
        wm,
        col,
        hex: `#${col.getHexString()}`,
      };
    });
  }, [measurements]);

  const trajectoryLine = useMemo(() => {
    if (points.length < 2) return null;
    const posArr: number[] = [];
    const colArr: number[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      posArr.push(points[i].x, points[i].y, points[i].z);
      posArr.push(points[i + 1].x, points[i + 1].y, points[i + 1].z);
      colArr.push(points[i].col.r, points[i].col.g, points[i].col.b);
      colArr.push(points[i + 1].col.r, points[i + 1].col.g, points[i + 1].col.b);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    return g;
  }, [points]);

  // Find the exact hovered node
  const hoveredNode = useMemo(() => {
    if (hoveredDepth === null || !points.length) return null;
    return points.reduce((prev, curr) =>
      Math.abs(curr.depth - hoveredDepth) < Math.abs(prev.depth - hoveredDepth) ? curr : prev
    );
  }, [hoveredDepth, points]);

  return (
    <>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 10, 5]} intensity={1.3} />

      {/* 3D Phase Space Bounding Box */}
      <mesh>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.25} />
      </mesh>

      {/* Phase Space Axis Labels */}
      <Text position={[0, -1.0, 0.9]} fontSize={0.06} color="#38bdf8" anchorX="center">
        Salinity Axis (PSU)
      </Text>
      <Text position={[-1.0, 0, 0.9]} fontSize={0.06} color="#f43f5e" anchorX="center" rotation={[0, 0, Math.PI / 2]}>
        Temperature Axis (°C)
      </Text>
      <Text position={[-0.9, -1.0, 0]} fontSize={0.06} color="#06b6d4" anchorX="center" rotation={[0, Math.PI / 2, 0]}>
        ← Depth (z)
      </Text>

      {/* Water Mass Domain Annotations in 3D Space */}
      <group position={[-0.6, 0.7, 0.7]}>
        <Text fontSize={0.045} color="#38bdf8" anchorX="left">
          ● Bay of Bengal Fresh Plume (BBFW)
        </Text>
      </group>
      <group position={[0.2, 0.0, 0.0]}>
        <Text fontSize={0.045} color="#f97316" anchorX="left">
          ● Thermocline Duct (TTW)
        </Text>
      </group>
      <group position={[0.4, -0.7, -0.7]}>
        <Text fontSize={0.045} color="#6366f1" anchorX="left">
          ● Central / Deep Abyss (IOCW/NIDW)
        </Text>
      </group>

      {/* 3D T-S Trajectory Ribbon */}
      {trajectoryLine && (
        <lineSegments geometry={trajectoryLine}>
          <lineBasicMaterial vertexColors transparent opacity={0.95} linewidth={3} />
        </lineSegments>
      )}

      {/* 3D Spheres for Each Measurement */}
      {points.map((pt, idx) => {
        const isHovered = hoveredNode && Math.abs(pt.depth - hoveredNode.depth) < 15;
        return (
          <mesh key={idx} position={[pt.x, pt.y, pt.z]}>
            <sphereGeometry args={[isHovered ? 0.045 : 0.022, 16, 16]} />
            <meshBasicMaterial color={isHovered ? '#ffffff' : pt.hex} toneMapped={false} />
          </mesh>
        );
      })}

      {/* Synchronized Hover Beacon in 3D Phase Space */}
      {hoveredNode && (
        <group position={[hoveredNode.x, hoveredNode.y, hoveredNode.z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.12, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <ringGeometry args={[0.07, 0.12, 32]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <Text position={[0.12, 0.08, 0]} fontSize={0.05} color="#ffffff" anchorX="left">
            {`Depth: ${hoveredNode.depth}m | T: ${hoveredNode.rawT.toFixed(1)}°C | S: ${hoveredNode.rawS.toFixed(2)} | σ_θ: ${hoveredNode.sigma.toFixed(2)}`}
          </Text>
        </group>
      )}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={8}
        autoRotate={!hoveredDepth}
        autoRotateSpeed={0.5}
      />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hologram Current Streamlines (GPU-Instanced Particles)
// Renders advecting cyan-to-magenta particles through the 3D volume.
// Mirrors CesiumGlobe current streamline aesthetic inside the Three.js scene.
// ─────────────────────────────────────────────────────────────────────────────

interface HologramStreamlinesProps {
  combinedMode: boolean;
  columns: { position: [number, number, number] }[];
}

const HologramStreamlines: React.FC<HologramStreamlinesProps> = ({ combinedMode, columns }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleData = useMemo(() => {
    const N = combinedMode ? 280 : 140;
    return Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * 2.0,
      y: (Math.random() - 0.5) * 1.8,
      z: (Math.random() - 0.5) * 2.0,
      // directional drift (geostrophic: mostly x, slight y sinking)
      dx: (Math.random() - 0.5) * 0.004,
      dy: -Math.random() * 0.0015,
      dz: (Math.random() - 0.5) * 0.003,
      age: Math.random(),
      life: 0.4 + Math.random() * 0.6,
      // hue 0.0 = cyan, 1.0 = magenta
      hue: Math.random(),
    }));
  }, [combinedMode]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    particleData.forEach((p, i) => {
      p.age += 0.008;
      if (p.age > p.life) {
        p.age = 0;
        p.x = (Math.random() - 0.5) * 2.0;
        p.y = (Math.random() - 0.5) * 1.8;
        p.z = (Math.random() - 0.5) * 2.0;
      }
      p.x += p.dx;
      p.y += p.dy;
      p.z += p.dz;
      // Clamp to hologram volume
      if (Math.abs(p.x) > 1.0) p.dx *= -1;
      if (Math.abs(p.z) > 1.0) p.dz *= -1;
      if (p.y < -0.9) { p.y = 0.9; }

      const alpha = Math.sin((p.age / p.life) * Math.PI);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(alpha * 0.018 + 0.004);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // cyan (#00ffff) to magenta (#ff00ff) based on hue
      color.setHSL(0.5 - p.hue * 0.33, 1.0, 0.55 + alpha * 0.25);
      meshRef.current!.setColorAt(i, color);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  const count = particleData.length;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial vertexColors transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Inner Physical Scene (Single Float & Fleet 4D)
// ─────────────────────────────────────────────────────────────────────────────

interface FloatHologramSceneProps {
  selectedProfile: FloatProfile | null;
  allProfiles: { profile: FloatProfile; summary: FloatSummary }[];
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  hoveredDepth: number | null;
  combinedMode: boolean;
  timeSteps: string[];
  currentTimeIdx: number;
}

const FloatHologramScene: React.FC<FloatHologramSceneProps> = ({
  selectedProfile,
  allProfiles,
  variable,
  hoveredDepth,
  combinedMode,
  timeSteps,
  currentTimeIdx,
}) => {
  const currentDepth = useOceanStore((s) => s.currentDepth);

  const maxDepth = useMemo(() => {
    let max = 2000;
    if (selectedProfile?.data?.length) {
      max = Math.max(...selectedProfile.data.map((m) => m.depth), 100);
    }
    return max;
  }, [selectedProfile]);

  const columns = useMemo(() => {
    if (!combinedMode && selectedProfile) {
      return [
        {
          profile: selectedProfile,
          position: [0, 0, 0] as [number, number, number],
          isSelected: true,
          platformNumber: selectedProfile.platform_number,
        },
      ];
    }

    if (!allProfiles.length && selectedProfile) {
      return [
        {
          profile: selectedProfile,
          position: [0, 0, 0] as [number, number, number],
          isSelected: true,
          platformNumber: selectedProfile.platform_number,
        },
      ];
    }

    const lons = allProfiles.map((p) => p.summary.lon);
    const lats = allProfiles.map((p) => p.summary.lat);
    const lonMin = Math.min(...lons), lonMax = Math.max(...lons) || lonMin + 1;
    const latMin = Math.min(...lats), latMax = Math.max(...lats) || latMin + 1;

    return allProfiles.map(({ profile, summary }) => {
      const nx = ((summary.lon - lonMin) / (lonMax - lonMin)) * 1.8 - 0.9;
      const nz = ((summary.lat - latMin) / (latMax - latMin)) * 1.8 - 0.9;
      return {
        profile,
        position: [nx, 0, nz] as [number, number, number],
        isSelected: selectedProfile ? profile._id === selectedProfile._id : false,
        platformNumber: profile.platform_number,
      };
    });
  }, [selectedProfile, allProfiles, combinedMode]);

  const currentDepthY = -((currentDepth / maxDepth) * 1.8) + 0.9;

  // Compute float's actual thermocline depth Y
  const floatThermoclineY = useMemo(() => {
    if (!selectedProfile?.data?.length) return 0.81;
    const measurements = selectedProfile.data;
    let tDepth = null;
    let maxGrad = 0;
    for (let i = 1; i < measurements.length; i++) {
      const dz = measurements[i].depth - measurements[i - 1].depth;
      const dt = Math.abs(measurements[i].temp - measurements[i - 1].temp);
      if (dz > 0 && dt / dz > maxGrad) {
        maxGrad = dt / dz;
        tDepth = measurements[i].depth;
      }
    }
    return tDepth ? -((tDepth / maxDepth) * 1.8) + 0.9 : 0.81;
  }, [selectedProfile, maxDepth]);

  // Compute basin-wide average thermocline depth
  const basinThermoclineY = useMemo(() => {
    if (!allProfiles.length) return floatThermoclineY;
    let sumDepth = 0;
    let count = 0;
    for (const { profile } of allProfiles) {
      const data = profile.data || [];
      let maxGrad = 0;
      let tDepth = null;
      for (let i = 1; i < data.length; i++) {
        const dz = data[i].depth - data[i - 1].depth;
        const dt = Math.abs(data[i].temp - data[i - 1].temp);
        if (dz > 0 && dt / dz > maxGrad) {
          maxGrad = dt / dz;
          tDepth = data[i].depth;
        }
      }
      if (tDepth !== null) {
        sumDepth += tDepth;
        count++;
      }
    }
    const avgDepth = count > 0 ? sumDepth / count : 100;
    return -((avgDepth / maxDepth) * 1.8) + 0.9;
  }, [allProfiles, floatThermoclineY, maxDepth]);

  const showThermocline = useOceanStore((s) => s.showThermocline);
  const showFieldSlice = useOceanStore((s) => s.showFieldSlice);
  const showIsoRipples = useOceanStore((s) => s.showIsoRipples);
  const showBiomassParticles = useOceanStore((s) => s.showBiomassParticles);
  const showStratificationDrape = useOceanStore((s) => s.showStratificationDrape);
  const showGrid = useOceanStore((s) => s.showGrid);
  const showCurrents = useOceanStore((s) => s.showCurrents);
  const activeFlashVisual = useOceanStore((s) => s.activeFlashVisual);

  const activeDepth = hoveredDepth !== null ? hoveredDepth : currentDepth;
  const activeDepthY = -((activeDepth / maxDepth) * 1.8) + 0.9;

  return (
    <>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />

      {/* 4D Spatial Hologram Cube Wireframe — gated on showGrid */}
      {showGrid && (
        <mesh>
          <boxGeometry args={[2, 1.8, 2]} />
          <meshBasicMaterial color="#0e7490" wireframe transparent opacity={0.3} />
        </mesh>
      )}

      {/* Base Grid Floor — gated on showGrid */}
      {showGrid && (
        <gridHelper args={[2, 10, '#0284c7', '#0f172a']} position={[0, -0.9, 0]} />
      )}
      <AxisLabels maxDepth={maxDepth} />

      {/* ── 0. Hologram Current Streamlines ── */}
      {showCurrents && (
        <HologramStreamlines combinedMode={combinedMode} columns={columns} />
      )}

      {/* ── 1. Dynamic Layer Field Slice ── */}
      {showFieldSlice && (
        <>
          {!combinedMode && selectedProfile && (
            <DynamicLayerFieldDisk
              measurements={selectedProfile.data || []}
              activeDepth={activeDepth}
              variable={variable}
              maxDepth={maxDepth}
              isFlashing={activeFlashVisual === 'fieldSlice'}
            />
          )}
          {combinedMode && (
            <FleetLayerFieldSlice
              allProfiles={allProfiles}
              activeDepth={activeDepth}
              variable={variable}
              maxDepth={maxDepth}
              isFlashing={activeFlashVisual === 'fieldSlice'}
            />
          )}
        </>
      )}

      {/* ── 2. Iso-Contour Wave Ripples (Multi-Source Overlap Field) ── */}
      {showIsoRipples && (
        <>
          {!combinedMode && selectedProfile && (
            <IsoContourRipples
              position={[0, 0, 0]}
              activeDepthY={activeDepthY}
              val={
                (selectedProfile.data || []).reduce((prev, curr) =>
                  Math.abs(curr.depth - activeDepth) < Math.abs(prev.depth - activeDepth) ? curr : prev
                )?.[variable === 'chlorophyll' ? 'chlorophyll' : variable] ?? 20
              }
              variable={variable}
              isFlashing={activeFlashVisual === 'isoRipples'}
            />
          )}
          {combinedMode &&
            columns.map((col, i) => {
              const nearest = (col.profile.data || []).reduce((prev, curr) =>
                Math.abs(curr.depth - activeDepth) < Math.abs(prev.depth - activeDepth) ? curr : prev
              );
              let val = nearest?.temp ?? 20;
              if (variable === 'salinity') val = nearest?.salinity ?? 34;
              else if (variable === 'density') val = nearest?.density ?? 1024;
              else if (variable === 'chlorophyll') val = nearest?.chlorophyll ?? computeDCMChlorophyll(activeDepth);

              return (
                <IsoContourRipples
                  key={`ripple-${i}`}
                  position={col.position}
                  activeDepthY={activeDepthY}
                  val={val}
                  variable={variable}
                  isFlashing={activeFlashVisual === 'isoRipples'}
                />
              );
            })}
        </>
      )}

      {/* ── 3. Structured 3D Euphotic Biomass Bloom Cloud ── */}
      {showBiomassParticles && (
        <>
          {!combinedMode && selectedProfile && (
            <BiomassParticles
              activeDepth={activeDepth}
              activeDepthY={activeDepthY}
              measurements={selectedProfile.data || []}
              position={[0, 0, 0]}
              isFlashing={activeFlashVisual === 'biomassParticles'}
            />
          )}
          {combinedMode &&
            columns.map((col, i) => (
              <BiomassParticles
                key={`biomass-${i}`}
                activeDepth={activeDepth}
                activeDepthY={activeDepthY}
                measurements={col.profile.data || []}
                position={col.position}
                showLabel={col.isSelected}
                isFlashing={activeFlashVisual === 'biomassParticles'}
              />
            ))}
        </>
      )}

      {/* ── 4. Basin-Wide Stratification Drape Curtains ── */}
      {showStratificationDrape && (
        <>
          {!combinedMode && selectedProfile && (
            <StratificationDrape
              measurements={selectedProfile.data || []}
              activeDepth={activeDepth}
              variable={variable}
              position={[0, 0, 0]}
              width={0.45}
              maxDepth={maxDepth}
              isFlashing={activeFlashVisual === 'stratificationDrape'}
            />
          )}
          {combinedMode &&
            columns.map((col, i) => (
              <StratificationDrape
                key={`drape-${i}`}
                measurements={col.profile.data || []}
                activeDepth={activeDepth}
                variable={variable}
                position={col.position}
                width={0.2}
                maxDepth={maxDepth}
                isFlashing={activeFlashVisual === 'stratificationDrape'}
              />
            ))}
        </>
      )}

      {/* ── 5. Living Thermocline Sheet ── */}
      {showThermocline && !combinedMode && selectedProfile && (
        <LivingThermoclineSheet
          variable={variable}
          yPosition={floatThermoclineY}
          radius={1.5}
        />
      )}
      {showThermocline && combinedMode && (
        <LivingThermoclineSheet
          variable={variable}
          yPosition={basinThermoclineY}
          radius={1.8}
        />
      )}

      {/* Profile Columns */}
      {columns.map((col, i) => (
        <ProfileColumn
          key={col.profile._id || i}
          measurements={col.profile.data || []}
          position={col.position}
          variable={variable}
          hoveredDepth={hoveredDepth}
          isSelected={col.isSelected}
          platformNumber={combinedMode ? (col.isSelected ? col.platformNumber : undefined) : col.platformNumber}
          maxDepth={maxDepth}
        />
      ))}

      {/* Volumetric Data in Fleet Mode */}
      {combinedMode && (
        <HologramVolume
          variable={variable}
          timeSteps={timeSteps}
          currentTimeIdx={currentTimeIdx}
          yPosition={basinThermoclineY}
        />
      )}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={8}
        autoRotate={!hoveredDepth}
        autoRotateSpeed={0.5}
      />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Public Component
// ─────────────────────────────────────────────────────────────────────────────

export interface FloatHologramProps {
  selectedProfile: FloatProfile | null;
  allProfiles?: { profile: FloatProfile; summary: FloatSummary }[];
  hoveredDepth?: number | null;
  variable?: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  expanded?: boolean;
  hologramMode?: HologramMode;
}

export const FloatHologram: React.FC<FloatHologramProps> = ({
  selectedProfile,
  allProfiles = [],
  hoveredDepth = null,
  variable = 'temp',
  expanded = false,
  hologramMode = 'single',
}) => {
  const combinedMode = hologramMode === 'fleet';
  const isPhaseSpace = hologramMode === 'phase-space';
  const timeSteps = useOceanStore((s) => s.metadata?.time_steps ?? []);
  const currentTimeIdx = useOceanStore((s) => s.currentTimestep);

  return (
    <div className={`relative flex flex-col bg-[#020617] rounded-xl overflow-hidden shadow-inner ${expanded ? 'w-full h-full' : 'w-full h-full min-h-[300px]'}`}>
      <div className="flex-1 w-full h-full">
        {(selectedProfile?.data?.length ?? 0) > 0 || (combinedMode && allProfiles.length > 0) ? (
          <Canvas
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 1.5]}
            camera={{ position: [2.5, 1.4, 2.5], fov: 42 }}
          >
            {isPhaseSpace ? (
              <TSPhaseSpaceScene profile={selectedProfile} hoveredDepth={hoveredDepth} />
            ) : (
              <FloatHologramScene
                selectedProfile={selectedProfile}
                allProfiles={allProfiles}
                variable={variable}
                hoveredDepth={hoveredDepth}
                combinedMode={combinedMode}
                timeSteps={timeSteps}
                currentTimeIdx={currentTimeIdx}
              />
            )}
          </Canvas>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center font-mono">
            <div className="w-8 h-8 rounded-full border border-cyan-500/40 border-t-cyan-400 animate-spin mb-1" />
            <p className="text-xs text-slate-300">Loading 4D Hologram Profile...</p>
            <p className="text-[10px] text-slate-500">Select any Argo Float or switch to Fleet mode</p>
          </div>
        )}
      </div>

      {/* Bottom legend */}
      <div className="absolute bottom-2 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="text-[10px] font-mono text-cyan-400 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-white/10">
          {isPhaseSpace
            ? '3D (S, T, z) Water Mass Phase Space'
            : combinedMode
            ? `${allProfiles.length} floats · fleet field active`
            : `${selectedProfile?.data?.length ?? 0} depth levels · ${selectedProfile?.platform_number ? `Float #${selectedProfile.platform_number}` : ''}`}
        </div>
        <div className="text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-white/10">
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  );
};
