# 🌊 OceanView 4D — Full India EEZ Prototype

**OceanView 4D** is an interactive, browser-based 3D ocean data visualization prototype scoped specifically to the **Full India Exclusive Economic Zone (EEZ)** (roughly 68°E–97°E, 6°N–24°N).

It reconstructs 4D volumetric ocean fields (Time $\times$ Depth $\times$ Lat $\times$ Lon) and renders temperature, salinity, density, and ocean current vectors in an interactive CesiumJS digital twin with real Argo float profiles.

---

## 🚀 Key Features

- **Physics-Informed Deep Learning**: Precomputed 4D tensor using local CPU-trained ML models (PINN for subsurface currents, U-Net for scalar reconstruction, ConvLSTM for forecasting) overriding legacy SciPy RBF spatial interpolation.
- **Interactive Depth Slicing**: Explore the ocean water column from surface (`0m`) down to the abyssal plain (`2000m`) with a volumetric "laser-cut" plane effect.
- **4D Temporal Playback & Forecasting**: Animated timeline playback with step controls across observation epochs, including forecasted future states.
- **WebGL Particle Trails**: Animated 3D current flow particles capturing the East India Coastal Current (EICC), reversing monsoon currents, and the Bay of Bengal anticyclonic gyre.
- **Real Argo Float Profiles**: Interactive 3D beacon markers with a cinematic camera swoop and a slide-out drawer plotting:
  - Temperature vs. Depth $T(z)$
  - Salinity vs. Depth $S(z)$
  - Potential Density $\rho(z)$
  - Temperature-Salinity ($T$-$S$) Water Mass Diagram
- **Camera Navigation Presets**: Instant fly-to buttons for Bay of Bengal, India Subcontinent, Andaman Basin, and Coromandel Coast.
- **Air-gapped Deployment**: Fully packaged with a multi-container Docker Compose setup, including an Nginx reverse proxy for basic authentication. No cloud dependency.

---

## 🛠️ Architecture

```
oceanview4d-prototype/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app & static file serving
│   │   ├── api.py               # REST endpoints (/meta, /field/slice, /floats, /forecast)
│   │   ├── services.py          # Data query engine & ML ONNX loader (PINN/U-Net/ConvLSTM fallback to RBF)
│   │   └── config.py            # Region bounding box (68E-97E, 6N-24N) & metadata
│   ├── data/
│   │   ├── raw/                 # Ingested Argo profiles & CMEMS data
│   │   ├── processed/           # Cached 4D tensor (india_eez_4d.json)
│   │   └── models/              # Trained ONNX ML models
│   ├── scripts/
│   │   ├── ingest_cmems.py      # CMEMS current velocity ingest
│   │   ├── reconstruct_field.py # ML prediction generation
│   │   ├── train_pinn.py        # PINN local CPU training
│   │   ├── train_unet.py        # U-Net local CPU training
│   │   ├── train_convlstm.py    # ConvLSTM local CPU training
│   │   └── schedule_forecast.sh # Daily cron script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CesiumGlobe.tsx       # 3D Cesium viewer with particle system & hologram
│   │   │   ├── TimeDepthControls.tsx # 4D timeline & vertical depth dock
│   │   │   ├── VariableSelector.tsx  # Glassmorphism UI switcher
│   │   │   ├── FloatDrawer.tsx       # Recharts vertical profile curves
│   │   │   ├── Legend.tsx            # Dynamic colormap scale
│   │   │   └── Header.tsx            # Presets & status badge
│   │   ├── services/api.ts          # Backend API client
│   │   ├── utils/colormaps.ts       # Turbo, Haline, Viridis colormaps
│   │   ├── types/ocean.ts           # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── nginx/
│   ├── Dockerfile                   # Nginx Basic Auth container
│   └── nginx.conf                   # Reverse proxy configuration
├── Dockerfile                       # Multi-stage production container
└── docker-compose.yml
```

---

## ⚡ Quickstart (Local Development)

### 1. Backend Setup & Data Precomputation

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Run ML model training (CPU Optimized)
python backend/scripts/train_pinn.py
python backend/scripts/train_unet.py
python backend/scripts/train_convlstm.py

# Run data ingestion & field reconstruction
python backend/scripts/ingest_cmems.py
python backend/scripts/reconstruct_field.py

# Start FastAPI dev server
uvicorn backend.app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Production Deployment (Local/Air-gapped)

This prototype is designed to run securely on a local machine without requiring cloud services, exposed behind an Nginx Reverse Proxy with Basic Authentication.

```bash
# Start the full stack (FastAPI Backend, Vite Frontend, and Nginx Proxy)
docker-compose up --build -d
```

The application will be securely available at **http://localhost:80**.
Login with the credentials configured in your `nginx/Dockerfile`.
