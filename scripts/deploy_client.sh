#!/bin/bash
# Deploy client to Firebase Hosting via Cloud Build (Bash)
# Usage: ./deploy_client.sh [ProjectId] [ApiUrl]

ProjectId=${1:-}
ApiUrl=${2:-}
ClientPath=$(cd "$(dirname "$0")/../web-client" && pwd)

cd "$ClientPath"

echo "[Client] Deploying (React + Firebase)..."

if [ -z "$ProjectId" ]; then
  ProjectId=$(gcloud config get-value project --quiet 2>/dev/null)
  if [ -z "$ProjectId" ]; then
    echo "[ERROR] GCP project not set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
  fi
fi

if [ -z "$ApiUrl" ]; then
  ApiUrl="https://carelink-server-a1b2c3d4-as.a.run.app"
  echo "[WARNING] No API URL provided. Using default: $ApiUrl"
  echo "[TIP] Run: ./deploy_client.sh $ProjectId YOUR_SERVER_URL"
fi

echo "[INFO] Building with API_URL: $ApiUrl"
echo "[INFO] Submitting to Cloud Build (project: $ProjectId)..."
gcloud builds submit "$ClientPath" \
  --config "$ClientPath/cloudbuild-client.yaml" \
  --project "$ProjectId" \
  --substitutions "_API_URL=$ApiUrl"

if [ $? -ne 0 ]; then
  echo "[ERROR] Cloud Build failed"
  exit 1
fi

echo "[SUCCESS] Client submitted to Cloud Build"
echo "View logs: https://console.cloud.google.com/cloud-build/builds?project=$ProjectId"
