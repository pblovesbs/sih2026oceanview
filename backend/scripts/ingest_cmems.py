"""
Data Ingestion Script for OceanView 4D: CMEMS Data
Fetches (or generates a realistic mock of) Copernicus Marine Environment Monitoring Service (CMEMS)
data for the full India EEZ (Lat 6°N - 24°N, Lon 68°E - 97°E).
Variables included:
- Sea Surface Height (SSH)
- Sea Surface Winds (SSW u/v components)
- Ocean Currents (u/v components at multiple depths)
"""

import os
import json
import numpy as np

# Bounding box for Bay of Bengal
LON_MIN, LON_MAX = 80.0, 97.0
LAT_MIN, LAT_MAX = 6.0, 22.0
GRID_RES = 0.5  # 0.5 degree spatial resolution

LONS = np.arange(LON_MIN, LON_MAX + 0.1, GRID_RES)
LATS = np.arange(LAT_MIN, LAT_MAX + 0.1, GRID_RES)

DEPTH_LEVELS = [0, 10, 25, 50, 100, 200, 500, 1000, 1500, 2000]
TIME_STEPS = ["2024-05-15T00:00:00Z", "2024-05-16T00:00:00Z", "2024-05-17T00:00:00Z", "2024-05-18T00:00:00Z", "2024-05-19T00:00:00Z"]

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
os.makedirs(PROCESSED_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(PROCESSED_DIR, "cmems_india_eez.json")

def is_ocean(lon, lat):
    """
    Approximate land-sea mask for the India EEZ.
    """
    # India peninsula approximate coastline (western and eastern)
    # Very coarse approximation for mock purposes
    if 72.0 < lon < 80.2 and lat > 8.0: # Indian subcontinent
        return False
    if lon < 82.0 and lat > 14.0 and lon > 80.0:
        return False
    if lon < 84.5 and lat > 18.5 and lon > 80.0:
        return False
    if lon < 86.8 and lat > 20.5 and lon > 80.0:
        return False
    if lat > 21.8 and lon > 87.0:  # Ganges delta land
        return False
    if lon > 94.0 and lat > 18.5:  # Myanmar coast
        return False
    if lon > 96.5 and lat > 15.0:
        return False
    if lon > 98.0:
        return False
    return True

def generate_cmems_data():
    print(f"Generating realistic CMEMS data cache for {LON_MIN}-{LON_MAX}E, {LAT_MIN}-{LAT_MAX}N...")
    
    cmems_data = {
        "metadata": {
            "source": "Copernicus Marine Service (Mocked for offline/demo)",
            "product": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
            "bbox": [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX],
            "lons": [round(x, 2) for x in LONS.tolist()],
            "lats": [round(y, 2) for y in LATS.tolist()],
            "depth_levels": DEPTH_LEVELS,
            "time_steps": TIME_STEPS
        },
        "times": {}
    }
    
    for t_idx, t_str in enumerate(TIME_STEPS):
        cmems_data["times"][t_str] = {
            "surface": [], # ssh, wind_u, wind_v
            "subsurface": {} # depth -> current_u, current_v
        }
        
        # 1. Surface Variables
        for lat in LATS:
            for lon in LONS:
                if not is_ocean(lon, lat):
                    continue
                
                # SSH: Gyre structures (higher in center of BoB and Arabian Sea)
                ssh = 0.5 + 0.2 * np.sin((lon - 80) * 0.1) * np.cos((lat - 10) * 0.1) + np.random.normal(0, 0.05)
                
                # Winds: Pre-monsoon southwesterlies starting to build
                wind_u = 3.0 + 2.0 * np.sin(lat * 0.1) + np.random.normal(0, 0.5)
                wind_v = 2.0 + 1.5 * np.cos(lon * 0.1) + np.random.normal(0, 0.5)
                
                cmems_data["times"][t_str]["surface"].append({
                    "lon": round(lon, 2),
                    "lat": round(lat, 2),
                    "ssh": round(ssh, 3),
                    "wind_u": round(wind_u, 2),
                    "wind_v": round(wind_v, 2)
                })
        
        # 2. Subsurface Currents
        for depth in DEPTH_LEVELS:
            cmems_data["times"][t_str]["subsurface"][str(depth)] = []
            speed_factor = np.exp(-depth / 250.0) # currents decay with depth
            phase = t_idx * 0.4
            
            for lat in LATS:
                for lon in LONS:
                    if not is_ocean(lon, lat):
                        continue
                    
                    # More complex geostrophic-like currents
                    # Arabian Sea Somali current / coastal currents
                    if lon < 78:
                        u_base = 0.3 * np.cos(np.radians(lon)) + 0.1 * np.sin(phase)
                        v_base = 0.4 * np.sin(np.radians(lat)) + 0.1 * np.cos(phase)
                    else:
                        # BoB EICC and gyre
                        u_base = -0.25 * np.sin(np.radians(lat)) + 0.1 * np.sin(phase)
                        v_base = 0.35 * np.cos(np.radians(lon)) + 0.1 * np.cos(phase)
                        
                    u = round(float(u_base * speed_factor + np.random.normal(0, 0.02)), 3)
                    v = round(float(v_base * speed_factor + np.random.normal(0, 0.02)), 3)
                    
                    cmems_data["times"][t_str]["subsurface"][str(depth)].append({
                        "lon": round(lon, 2),
                        "lat": round(lat, 2),
                        "u": u,
                        "v": v
                    })

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(cmems_data, f)
        
    print(f"Saved mocked CMEMS data to {OUTPUT_FILE} ({os.path.getsize(OUTPUT_FILE) / 1024 / 1024:.2f} MB)")

if __name__ == "__main__":
    generate_cmems_data()
