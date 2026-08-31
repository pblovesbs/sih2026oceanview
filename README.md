# 🌊 OceanView 4D — Bay of Bengal Prototype

**OceanView 4D** is an interactive, browser-based 3D ocean data visualization prototype scoped specifically to the **Bay of Bengal portion of India's Exclusive Economic Zone (EEZ)** (roughly 80°E–97°E, 6°N–22°N).

It reconstructs 4D volumetric ocean fields (Time $\times$ Depth $\times$ Lat $\times$ Lon) and renders temperature, salinity, density, and geostrophic/coastal current vectors in an interactive CesiumJS digital twin with real Argo float profiles.

---

## 🚀 Key Features

- **3D Ocean Field Reconstruction**: Precomputed 4D tensor using SciPy RBF spatial interpolation across real observations from INCOIS and Argovis.
- **Interactive Depth Slicing**: Explore the ocean water column from surface (`0m`) down to the abyssal plain (`2000m`).
- **4D Temporal Playback**: Animated timeline playback with step controls across observation epochs.
- **Ocean Current Vectors**: 3D flow arrows capturing the East India Coastal Current (EICC) and Bay of Bengal anticyclonic gyre.
- **Real Argo Float Profiles**: Interactive 3D beacon markers with a slide-out drawer plotting:
  - Temperature vs. Depth $T(z)$
  - Salinity vs. Depth $S(z)$
  - Potential Density $\rho(z)$
  - Temperature-Salinity ($T$-$S$) Water Mass Diagram
- **Camera Navigation Presets**: Instant fly-to buttons for Bay of Bengal, India Subcontinent, Andaman Basin, and Coromandel Coast.
- **Single-Container Deployment**: Fully packaged with a multi-stage Dockerfile ready for Google Cloud Run.

---

## 🛠️ Architecture

```
oceanview4d-prototype/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app & static file serving
│   │   ├── api.py               # REST endpoints (/meta, /field/slice, /floats)
│   │   ├── services.py          # Data query engine & interpolation loader
│   │   └── config.py            # Region bounding box & metadata
│   ├── data/
│   │   ├── raw/                 # Ingested Argo profiles JSON
│   │   └── processed/           # Cached 4D tensor (bay_of_bengal_4d.json)
│   ├── scripts/
│   │   ├── ingest_argovis.py    # Argovis API data ingest
│   │   └── reconstruct_field.py # SciPy 3D spatial field reconstruction
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CesiumGlobe.tsx       # 3D Cesium viewer & India EEZ polygon
│   │   │   ├── TimeDepthControls.tsx # 4D timeline & vertical depth dock
│   │   │   ├── VariableSelector.tsx  # Scalar & vector layers switcher
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
├── Dockerfile                       # Multi-stage production container
└── docker-compose.yml
```

---

## ⚡ Quickstart (Local Development)

### 1. Backend Setup & Data Precomputation

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Run data ingestion & 4D field reconstruction
python backend/scripts/ingest_argovis.py
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

## 🐳 Docker & Google Cloud Run Deployment

### Local Docker Run
```bash
docker build -t oceanview4d .
docker run -p 8080:8080 oceanview4d
```

### Deploy to Google Cloud Run
```bash
# 1. Build & submit image to Google Artifact Registry / Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/oceanview4d

# 2. Deploy to Cloud Run
gcloud run deploy oceanview4d \
  --image gcr.io/YOUR_PROJECT_ID/oceanview4d \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1
```
