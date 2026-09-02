export type VariableKey = 'temp' | 'salinity' | 'density' | 'current_speed' | 'chlorophyll';
export type ViewMode = '3d-globe' | '2d-dashboard';

export interface VariableMeta {
  name: string;
  unit: string;
  min: number;
  max: number;
}

export interface OceanMetadata {
  title: string;
  region: string;
  center: [number, number];
  bbox: [number, number, number, number];
  depth_levels: number[];
  time_steps: string[];
  variables: Record<VariableKey, VariableMeta>;
  float_count: number;
  live_data_available?: boolean;
  data_sources?: string[];
}

export interface OceanPoint {
  lon: number;
  lat: number;
  depth: number;
  temp: number;
  salinity: number;
  density: number;
  chlorophyll?: number;
  u: number;
  v: number;
  speed: number;
}

export interface SliceData {
  time: string;
  depth: number;
  variable: VariableKey;
  point_count: number;
  points: OceanPoint[];
  source?: string;
}

export interface FloatSummary {
  id: string;
  platform_number: string;
  cycle: number;
  lon: number;
  lat: number;
  date: string;
  institution: string;
  max_depth: number;
}

export interface FloatMeasurement {
  depth: number;
  pres: number;
  temp: number;
  salinity: number;
  psal?: number;
  density: number;
  chlorophyll?: number; // BGC-Argo floats
  oxygen?: number;      // BGC-Argo floats
}

export interface FloatProfile {
  _id: string;
  platform_number: string;
  cycle_number: number;
  geolocation: {
    type: string;
    coordinates: [number, number];
  };
  date: string;
  institution: string;
  data_mode: string;
  data: FloatMeasurement[];
  source?: string;
}

export interface DateRangeResult {
  start: string;
  end: string;
  step_count: number;
  time_steps: string[];
}
