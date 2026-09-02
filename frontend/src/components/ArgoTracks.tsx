import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';

interface ArgoTracksProps {
  emissiveMultiplier?: number;
}

export const ArgoTracks: React.FC<ArgoTracksProps> = ({ emissiveMultiplier = 2.5 }) => {
  const [data, setData] = useState<{ positions: Float32Array; colors: Float32Array } | null>(null);

  useEffect(() => {
    fetch('/floats.json')
      .then(res => res.json())
      .then(json => {
        if (json.vertices && json.colors) {
          setData({
            positions: new Float32Array(json.vertices),
            colors: new Float32Array(json.colors)
          });
        }
      })
      .catch(err => {
        console.warn('Using fallback float vertices:', err);
        // Fallback default tracks
        const fallbackVertices = [
          0.5, 0.5, 0.5,   0.5, -0.5, 0.5,
          -0.4, 0.5, -0.3, -0.4, -0.5, -0.3,
          0.1, 0.5, -0.6,  0.1, -0.5, -0.6,
          -0.6, 0.5, 0.4,  -0.6, -0.5, 0.4,
          0.3, 0.5, 0.1,   0.3, -0.5, 0.1
        ];
        const fallbackColors = [
          0.0, 1.0, 1.0,   1.0, 0.0, 1.0,
          0.0, 1.0, 1.0,   1.0, 0.0, 1.0,
          0.0, 1.0, 1.0,   1.0, 0.0, 1.0,
          0.0, 1.0, 1.0,   1.0, 0.0, 1.0,
          0.0, 1.0, 1.0,   1.0, 0.0, 1.0
        ];
        setData({
          positions: new Float32Array(fallbackVertices),
          colors: new Float32Array(fallbackColors)
        });
      });
  }, []);

  const geometry = useMemo(() => {
    if (!data) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    return geom;
  }, [data]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      {/* Vertex colors drive the color, high color value triggers bloom */}
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.9}
        linewidth={2}
        color={new THREE.Color(emissiveMultiplier, emissiveMultiplier, emissiveMultiplier)}
      />
    </lineSegments>
  );
};
