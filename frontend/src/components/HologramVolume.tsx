import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VolumeShaderMaterial } from '../shaders/oceanFieldShader';
import { useVolumetricField } from '../hooks/useVolumetricField';
import { useOceanStore } from '../store/useOceanStore';
import { FloatSummary } from '../types/ocean';

interface HologramVolumeProps {
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll';
  timeSteps: string[];
  currentTimeIdx: number;
  yPosition?: number;
}

export const HologramVolume: React.FC<HologramVolumeProps> = ({ variable, timeSteps, currentTimeIdx, yPosition = 0.81 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const { texture0, texture1, progress } = useVolumetricField(variable, timeSteps, currentTimeIdx);
  const colorMode = useOceanStore((s) => s.colorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);
  
  const material = useMemo(() => {
    return VolumeShaderMaterial.clone();
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame(({ clock }) => {
    if (material) {
      // Read directly from store to avoid React re-render lag during temporal morphing
      const tPos = useOceanStore.getState().currentTimestep;
      const isMorphing = useOceanStore.getState().showTemporalMorphing;
      const mixFactor = isMorphing ? (tPos - Math.floor(tPos)) : 0;
      
      material.uniforms.uTime.value = clock.elapsedTime;
      material.uniforms.uTimeProgress.value = mixFactor;
      if (texture0) material.uniforms.uVolume0.value = texture0;
      if (texture1) material.uniforms.uVolume1.value = texture1;
      
      let min = 5;
      let max = 30;
      if (variable === 'salinity') { min = 32; max = 37; }
      else if (variable === 'density') { min = 1020; max = 1028; }
      else if (variable === 'chlorophyll') { min = 0.05; max = 5.0; }
      
      material.uniforms.uMinVal.value = min;
      material.uniforms.uMaxVal.value = max;
      material.uniforms.uColorMode.value = colorMode === 'intuitive' ? 1 : (colorMode === 'anomaly' ? 2 : 0);
      material.uniforms.uColorScaleMode.value = colorScaleMode === 'log' ? 1 : 0;
      material.uniforms.uAlphaThreshold.value = 0.02;
    }
  });

  const showThermocline = useOceanStore((s) => s.showThermocline);

  return (
    <group>
      {/* Volumetric Raymarching Box */}
      {texture0 && (
        <mesh ref={meshRef} material={material} position={[0, 0, 0]}>
          <boxGeometry args={[1.8, 1.8, 1.8]} />
        </mesh>
      )}
      
      {/* Living Thermocline Sheet positioned at true basin thermocline depth */}
      {showThermocline && (
        <LivingThermoclineSheet variable={variable} yPosition={yPosition} radius={1.8} />
      )}
    </group>
  );
};

export const LivingThermoclineSheet: React.FC<{ variable: string; yPosition?: number; radius?: number }> = ({
  variable,
  yPosition = -0.2,
  radius = 1.8,
}) => {
  const planeRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (planeRef.current) {
      const geom = planeRef.current.geometry as THREE.PlaneGeometry;
      const posAttribute = geom.attributes.position;
      
      const time = clock.elapsedTime;
      for (let i = 0; i < posAttribute.count; i++) {
        const x = posAttribute.getX(i);
        const y = posAttribute.getY(i);
        
        // Buoyancy frequency (N^2) undulation simulation
        const wave1 = Math.sin(x * 5.0 + time * 1.2) * 0.04;
        const wave2 = Math.cos(y * 4.0 - time * 0.8) * 0.025;
        const wave3 = Math.sin((x + y) * 8.0 + time * 2.0) * 0.01;
        
        const zOffset = wave1 + wave2 + wave3;
        posAttribute.setZ(i, zOffset);
      }
      posAttribute.needsUpdate = true;
      geom.computeVertexNormals();
    }
  });

  return (
    <mesh ref={planeRef} position={[0, yPosition, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[radius, radius, 48, 48]} />
      <meshStandardMaterial 
        color={variable === 'temp' ? "#f59e0b" : variable === 'chlorophyll' ? "#22c55e" : "#3b82f6"} 
        wireframe 
        transparent 
        opacity={0.35} 
        side={THREE.DoubleSide} 
      />
    </mesh>
  );
};
