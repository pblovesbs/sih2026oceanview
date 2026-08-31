import os
import json
from typing import Optional, Dict, Any, List
from .config import settings

class OceanDataService:
    def __init__(self):
        self.field_data: Dict[str, Any] = {}
        self.floats_summary: List[Dict[str, Any]] = []
        self.raw_profiles: Dict[str, Any] = {}
        self._load_data()

    def _load_data(self):
        grid_file = os.path.join(settings.DATA_PROCESSED_DIR, "bay_of_bengal_4d.json")
        floats_file = os.path.join(settings.DATA_PROCESSED_DIR, "floats_summary.json")
        raw_file = os.path.join(settings.DATA_RAW_DIR, "argovis_bay_of_bengal_profiles.json")

        if os.path.exists(grid_file):
            print(f"Loading 4D ocean field from {grid_file}...")
            with open(grid_file, "r", encoding="utf-8") as f:
                self.field_data = json.load(f)
        else:
            print("Warning: Processed 4D field cache not found. Please run reconstruction script.")

        if os.path.exists(floats_file):
            with open(floats_file, "r", encoding="utf-8") as f:
                self.floats_summary = json.load(f)

        if os.path.exists(raw_file):
            with open(raw_file, "r", encoding="utf-8") as f:
                profiles_list = json.load(f)
                self.raw_profiles = {p["_id"]: p for p in profiles_list}

    def get_metadata(self) -> Dict[str, Any]:
        meta = self.field_data.get("metadata", {})
        return {
            "title": settings.PROJECT_NAME,
            "region": "Bay of Bengal (India EEZ Sector)",
            "center": [settings.CENTER_LON, settings.CENTER_LAT],
            "bbox": settings.BBOX,
            "depth_levels": meta.get("depth_levels", [0, 10, 25, 50, 100, 200, 500, 1000, 1500, 2000]),
            "time_steps": meta.get("time_steps", []),
            "variables": meta.get("variables", {}),
            "float_count": len(self.floats_summary)
        }

    def get_slice(self, depth: int, time_step: Optional[str] = None, variable: str = "temp") -> Dict[str, Any]:
        slices = self.field_data.get("slices", {})
        time_steps = list(slices.keys())
        
        if not time_steps:
            return {"points": [], "metadata": {}}

        selected_time = time_step if (time_step and time_step in slices) else time_steps[0]
        time_slice = slices.get(selected_time, {})
        
        # Find closest available depth level in slice
        available_depths = [int(k) for k in time_slice.keys()]
        if not available_depths:
            return {"points": [], "metadata": {}}

        closest_depth = min(available_depths, key=lambda d: abs(d - depth))
        points = time_slice.get(str(closest_depth), [])

        return {
            "time": selected_time,
            "depth": closest_depth,
            "variable": variable,
            "point_count": len(points),
            "points": points
        }

    def get_floats(self) -> List[Dict[str, Any]]:
        return self.floats_summary

    def get_float_profile(self, profile_id: str) -> Optional[Dict[str, Any]]:
        return self.raw_profiles.get(profile_id)


ocean_service = OceanDataService()
