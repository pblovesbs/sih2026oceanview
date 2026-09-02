import { OceanMetadata, SliceData, FloatSummary, FloatProfile, VariableKey, DateRangeResult } from '../types/ocean';
import { ContourResponse, DeltaResponse } from '../types/api';

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
    variable: variable,
  });
  if (time) params.append('time', time);
  const res = await fetch(`${API_BASE}/field/slice?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch field slice: ${res.statusText}`);
  return res.json();
}

export async function fetchLiveSlice(
  depth: number,
  date: string,
  variable: VariableKey
): Promise<SliceData> {
  const params = new URLSearchParams({
    depth: depth.toString(),
    date:  date,
    variable,
  });
  const res = await fetch(`${API_BASE}/live/slice?${params.toString()}`);
  if (!res.ok) throw new Error(`Live slice fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchChlorophyllSlice(date?: string): Promise<SliceData> {
  const params = new URLSearchParams({ variable: 'chlorophyll', depth: '0' });
  if (date) params.append('time', date);
  const res = await fetch(`${API_BASE}/field/slice?${params.toString()}`);
  if (!res.ok) throw new Error(`Chlorophyll fetch failed: ${res.statusText}`);
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
  const profile = await res.json();
  if (profile && profile.data) {
    profile.data.forEach((m: any) => {
      if (m.psal !== undefined && m.salinity === undefined) {
        m.salinity = m.psal;
      }
    });
  }
  return profile;
}

export async function fetchDateRange(start: string, end: string): Promise<DateRangeResult> {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${API_BASE}/daterange?${params.toString()}`);
  if (!res.ok) throw new Error(`Date range fetch failed: ${res.statusText}`);
  return res.json();
}

export async function triggerLiveSync(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/live/sync`, { method: 'POST' });
  if (!res.ok) throw new Error(`Live sync trigger failed: ${res.statusText}`);
  return res.json();
}

export async function fetchContours(date: string): Promise<ContourResponse> {
  const params = new URLSearchParams({ date });
  const res = await fetch(`${API_BASE}/overlays/contours?${params.toString()}`);
  if (!res.ok) throw new Error(`Contours fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchDeltas(date: string, variable: VariableKey, depth: number): Promise<DeltaResponse> {
  const params = new URLSearchParams({ date, variable, depth: depth.toString() });
  const res = await fetch(`${API_BASE}/overlays/deltas?${params.toString()}`);
  if (!res.ok) throw new Error(`Deltas fetch failed: ${res.statusText}`);
  return res.json();
}
