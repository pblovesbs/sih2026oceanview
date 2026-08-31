#!/bin/bash
# deploy.sh - Script to build and deploy OceanView 4D to Google Cloud Run

set -e

echo "🌊 Starting OceanView 4D Deployment to Google Cloud Run..."

# 1. Get GCP Project ID
if [ -z "$GCP_PROJECT_ID" ]; then
    # Try to get the default project ID from gcloud config
    DEFAULT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
    if [ -n "$DEFAULT_PROJECT" ]; then
        echo "Using default GCP Project: $DEFAULT_PROJECT"
        GCP_PROJECT_ID="$DEFAULT_PROJECT"
    else
        read -p "Enter your GCP Project ID: " GCP_PROJECT_ID
        if [ -z "$GCP_PROJECT_ID" ]; then
            echo "Error: GCP Project ID is required."
            exit 1
        fi
    fi
fi

IMAGE_TAG="gcr.io/$GCP_PROJECT_ID/oceanview4d"
REGION="asia-south1"

echo "📦 Building and submitting Docker image to Google Container Registry ($IMAGE_TAG)..."
gcloud builds submit --tag "$IMAGE_TAG"

echo "🚀 Deploying to Google Cloud Run..."
gcloud run deploy oceanview4d \
  --image "$IMAGE_TAG" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --port 8080

echo "✅ Deployment complete!"
echo "Your OceanView 4D prototype is now live."
