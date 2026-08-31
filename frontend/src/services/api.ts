import { OceanMetadata, SliceData, FloatSummary, FloatProfile, VariableKey } from '../types/ocean';

const API_BASE = '/api';

export async function fetchMetadata(): Promise<OceanMetadata> {
  const res = await fetch(`${API_BASE}/meta`);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.statusText}`);
  return res.json();
}

export async function fetchFieldSlice(
  depth: number,
  time?: string,
  variable: VariableKey = 'temp'
): Promise<SliceData> {
  const params = new URLSearchParams({
    depth: depth.toString(),
    variable: variable
  });
  if (time) params.append('time', time);

  const res = await fetch(`${API_BASE}/field/slice?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch field slice: ${res.statusText}`);
  return res.json();
}

export async function fetchFloats(): Promise<FloatSummary[]> {
  const res = await fetch(`${API_BASE}/floats`);
  if (!res.ok) throw new Error(`Failed to fetch floats: ${res.statusText}`);
  return res.json();
}

export async function fetchFloatProfile(floatId: string): Promise<FloatProfile> {
  const res = await fetch(`${API_BASE}/floats/${encodeURIComponent(floatId)}/profile`);
  if (!res.ok) throw new Error(`Failed to fetch float profile: ${res.statusText}`);
  return res.json();
}
