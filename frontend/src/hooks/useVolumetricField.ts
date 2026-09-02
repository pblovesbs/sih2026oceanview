import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useOceanStore } from '../store/useOceanStore';

const CACHE_SIZE = 5;

// LRU Cache for decoded Data3DTextures
class VolumetricCache {
  private cache = new Map<string, THREE.Data3DTexture>();
  private keys: string[] = [];

  get(key: string) {
    if (this.cache.has(key)) {
      this.keys = this.keys.filter((k) => k !== key);
      this.keys.push(key);
      return this.cache.get(key);
    }
    return null;
  }

  set(key: string, texture: THREE.Data3DTexture) {
    if (this.cache.has(key)) {
      this.keys = this.keys.filter((k) => k !== key);
    } else if (this.keys.length >= CACHE_SIZE) {
      const oldest = this.keys.shift()!;
      const oldTex = this.cache.get(oldest);
      oldTex?.dispose();
      this.cache.delete(oldest);
    }
    this.cache.set(key, texture);
    this.keys.push(key);
  }
}

const textureCache = new VolumetricCache();

export function useVolumetricField(
  variable: 'temp' | 'salinity' | 'density' | 'chlorophyll',
  timeSteps: string[],
  currentTimeIdx: number
) {
  const [texture0, setTexture0] = useState<THREE.Data3DTexture | null>(null);
  const [texture1, setTexture1] = useState<THREE.Data3DTexture | null>(null);
  const [progress, setProgress] = useState(0);

  const fetchVolume = async (dateStr: string) => {
    const key = `${variable}-${dateStr}`;
    const cached = textureCache.get(key);
    if (cached) return cached;

    try {
      const res = await fetch(`/api/live/volume?date=${dateStr}&variable=${variable}`);
      if (!res.ok) throw new Error('Volume fetch failed');
      const arrayBuffer = await res.arrayBuffer();
      
      const width = 40;  // lon
      const height = 40; // lat
      const depth = 10;  // depth levels
      
      // The endpoint returns a flat float32 array
      const data = new Float32Array(arrayBuffer);
      
      const texture = new THREE.Data3DTexture(data, width, height, depth);
      texture.format = THREE.RedFormat;
      texture.type = THREE.FloatType;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;
      
      textureCache.set(key, texture);
      return texture;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  useEffect(() => {
    if (timeSteps.length === 0) return;

    const baseIdx = Math.floor(currentTimeIdx);
    const nextIdx = Math.min(baseIdx + 1, timeSteps.length - 1);
    const prog = currentTimeIdx - baseIdx;

    let isActive = true;

    const update = async () => {
      const t0 = await fetchVolume(timeSteps[baseIdx]);
      const t1 = await fetchVolume(timeSteps[nextIdx]);
      if (isActive) {
        setTexture0(t0);
        setTexture1(t1);
        setProgress(prog);
      }
    };
    update();

    return () => { isActive = false; };
  }, [variable, currentTimeIdx, timeSteps]);

  return { texture0, texture1, progress };
}
