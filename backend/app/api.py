from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from .services import ocean_service

router = APIRouter()

@router.get("/meta")
async def get_meta():
    """Return dataset metadata, coordinates, depth levels, and variables."""
    return ocean_service.get_metadata()


@router.get("/field/slice")
async def get_field_slice(
    depth: int = Query(0, description="Depth level in meters (e.g. 0, 50, 100, 500, 1000, 2000)"),
    time: Optional[str] = Query(None, description="ISO timestamp of the time snapshot"),
    variable: str = Query("temp", description="Primary variable: temp | salinity | density | current_speed")
):
    """Retrieve 3D spatial slice points with scalar values and current vectors."""
    slice_data = ocean_service.get_slice(depth=depth, time_step=time, variable=variable)
    return slice_data


@router.get("/floats")
async def get_floats():
    """Retrieve summary metadata and locations for all Argo floats in Bay of Bengal."""
    return ocean_service.get_floats()


@router.get("/floats/{float_id}/profile")
async def get_float_profile(float_id: str):
    """Retrieve complete vertical column profile for an Argo float."""
    profile = ocean_service.get_float_profile(float_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Float profile not found")
    return profile
