# ==========================================
# Stage 1: Build React Frontend with Cesium
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python FastAPI Runtime
# ==========================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for scipy & spatial processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code, data pipelines, and processed caches
COPY backend/ ./backend/

# Copy built frontend assets into backend/static for single-container serving
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# Expose Cloud Run default port
ENV PORT=8080
EXPOSE 8080

# Run FastAPI app with Uvicorn
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
