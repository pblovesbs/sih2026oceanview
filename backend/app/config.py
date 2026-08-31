import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "OceanView 4D - Bay of Bengal Prototype"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Base paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_PROCESSED_DIR: str = os.path.join(BASE_DIR, "data", "processed")
    DATA_RAW_DIR: str = os.path.join(BASE_DIR, "data", "raw")
    STATIC_DIR: str = os.path.join(BASE_DIR, "static")

    # Region bounds for Bay of Bengal (India EEZ slice)
    BBOX: list[float] = [80.0, 6.0, 97.0, 22.0]  # [min_lon, min_lat, max_lon, max_lat]
    CENTER_LON: float = 88.5
    CENTER_LAT: float = 14.0
    
settings = Settings()
