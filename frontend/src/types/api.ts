export interface ContourResponse {
  contours: {
    id: string;
    color: string;
    depth: number;
    points: { lon: number; lat: number }[];
  }[];
}

export interface DeltaResponse {
  date: string;
  grid?: number[][];
  points?: {
    lon: number;
    lat: number;
    delta: number;
    norm_delta: number;
  }[];
}
