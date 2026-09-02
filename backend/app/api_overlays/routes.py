from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.live_data import live_service
from app.services import ocean_service
import numpy as np
import skimage.measure
from datetime import datetime, timedelta, timezone

router = APIRouter()

async def _get_slice_data(depth: int, date_str: str, variable: str) -> dict:
    if variable == "chlorophyll":
        return await live_service.get_live_slice(depth=0, date_str=date_str, variable="chlorophyll")
    
    # Try static
    slice_data = ocean_service.get_slice(depth=depth, time_step=date_str, variable=variable)
    static_dates = list(ocean_service.field_data.get("slices", {}).keys())
    requested_date = date_str[:10]
    in_static = any(requested_date in s for s in static_dates)

    if (not slice_data.get("points") or not in_static):
        live_result = await live_service.get_live_slice(depth=depth, date_str=date_str, variable=variable)
        if live_result.get("points"):
            return live_result

    return slice_data

@router.get("/contours")
async def get_contours(
    date: str = Query(..., description="ISO date string e.g. 2025-03-15"),
):
    """
    Compute real contour geometry for Mixed Layer Base (~40m) and Thermocline Core (~100m)
    by analyzing the temperature field. 
    Using Marching Squares (skimage.measure.find_contours).
    """
    # 1. Fetch surface and deeper temperature slices to compute gradients
    # We fetch depths: 0, 40 (MLD proxy), 100 (Thermocline proxy)
    try:
        slice_0 = await _get_slice_data(depth=0, date_str=date, variable="temp")
        slice_40 = await _get_slice_data(depth=40, date_str=date, variable="temp")
        slice_100 = await _get_slice_data(depth=100, date_str=date, variable="temp")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {e}")

    pts_0 = slice_0.get("points", [])
    pts_40 = slice_40.get("points", [])
    pts_100 = slice_100.get("points", [])

    if not pts_0 or not pts_40 or not pts_100:
        return {"contours": []}

    # Points might be sparse (e.g. 965 instead of 1024 due to landmask).
    # Reconstruct into 2D grid
    lon_w, lat_s, lon_e, lat_n = 80.0, 6.0, 97.0, 22.0
    n_lat, n_lon = 32, 32

    def build_grid(pts, var_name, default_val=25.0):
        grid = np.full((n_lat, n_lon), default_val)
        for p in pts:
            lon = p.get("lon")
            lat = p.get("lat")
            if lon is not None and lat is not None:
                # Map lon, lat to c, r
                c = int(round((lon - lon_w) / (lon_e - lon_w) * n_lon - 0.5))
                r = int(round((lat - lat_s) / (lat_n - lat_s) * n_lat - 0.5))
                if 0 <= c < n_lon and 0 <= r < n_lat:
                    grid[r, c] = p.get(var_name, default_val)
        return grid

    temp_0 = build_grid(pts_0, "temp", 25.0)
    temp_40 = build_grid(pts_40, "temp", 25.0)
    temp_100 = build_grid(pts_100, "temp", 25.0)

    # Simple proxy formulas based on Conclusive Summary tab logic:
    # MLD: Depth where temp is T_surface - 0.2
    # Thermocline: Max vertical gradient (dT/dz). For this 2D contouring, 
    # we will threshold the temperature difference to find fronts.

    # 1. MLD Fronts: Areas where the 40m temp has dropped significantly below surface (shallow MLD)
    mld_diff = temp_0 - temp_40
    # 2. Thermocline Core: Areas where 100m temp indicates the core boundary 
    # (Typically 20°C isotherm in Indian Ocean)
    
    contours = []

    def extract_polylines(grid, threshold, layer_id, color, depth):
        extracted = []
        try:
            # find_contours returns a list of (row, col) coordinates
            raw_contours = skimage.measure.find_contours(grid, threshold)
            for raw_c in raw_contours:
                if len(raw_c) < 4: continue # Skip tiny fragments
                
                # Convert back to (lon, lat)
                coords = []
                for r, c in raw_c:
                    lon = lon_w + (lon_e - lon_w) * (c + 0.5) / n_lon
                    lat = lat_s + (lat_n - lat_s) * (r + 0.5) / n_lat
                    coords.append({"lon": float(lon), "lat": float(lat)})
                
                extracted.append({
                    "id": layer_id,
                    "color": color,
                    "depth": depth,
                    "points": coords
                })
        except Exception as e:
            print(f"Contour extraction error: {e}")
        return extracted

    # MLD boundary: threshold where 40m water is 0.5°C cooler than surface
    contours.extend(extract_polylines(mld_diff, 0.5, "mld-ring", "#f59e0b", 40))
    
    # Thermocline core: 20°C isotherm at 100m depth
    contours.extend(extract_polylines(temp_100, 20.0, "thermocline-ring", "#06b6d4", 100))

    return {"contours": contours}


@router.get("/deltas")
async def get_deltas(
    date: str = Query(..., description="ISO date string e.g. 2025-03-15"),
    variable: str = Query("temp", description="temp | salinity | density | chlorophyll"),
    depth: int = Query(0, description="Depth in metres"),
):
    """
    Compute absolute difference |value(t) - value(t-1)| across the 2D grid.
    Returns a normalized delta grid.
    """
    try:
        d_curr = datetime.fromisoformat(date[:10].replace("Z", "+00:00"))
        d_prev = d_curr - timedelta(days=1)
        date_prev_str = d_prev.strftime("%Y-%m-%d")

        slice_curr = await _get_slice_data(depth=depth, date_str=date, variable=variable)
        slice_prev = await _get_slice_data(depth=depth, date_str=date_prev_str, variable=variable)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {e}")

    pts_curr = slice_curr.get("points", [])
    pts_prev = slice_prev.get("points", [])

    if not pts_curr or not pts_prev or len(pts_curr) != len(pts_prev):
        # If prev day not available, return zeroes
        for p in pts_curr:
            p["delta"] = 0.0
            p["norm_delta"] = 0.0
        return {"date": date, "points": pts_curr}

    # Compute deltas
    deltas = []
    for pc, pp in zip(pts_curr, pts_prev):
        vc = pc.get(variable, 0)
        vp = pp.get(variable, 0)
        diff = abs(vc - vp)
        deltas.append(diff)
    
    max_delta = max(deltas) if deltas else 1.0
    if max_delta < 1e-6: max_delta = 1.0

    # Non-linear gain to highlight small changes
    # normalized = (delta / max_delta) ^ 0.5
    for i, pc in enumerate(pts_curr):
        pc["delta"] = deltas[i]
        pc["norm_delta"] = (deltas[i] / max_delta) ** 0.5

    return {"date": date, "points": pts_curr}
