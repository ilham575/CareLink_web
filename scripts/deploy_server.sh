#!/bin/bash
# Deploy server to Google Cloud Run via Cloud Build (Bash)
# Usage: ./deploy_server.sh [ProjectId]

ProjectId=${1:-}
ServerPath=$(cd "$(dirname "$0")/../web-server" && pwd)

cd "$ServerPath"

echo "[Server] Deploying (Strapi + Cloud Run)..."

if [ -z "$ProjectId" ]; then
  ProjectId=$(gcloud config get-value project --quiet 2>/dev/null)
  if [ -z "$ProjectId" ]; then
    echo "[ERROR] GCP project not set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
  fi
fi

# Resolve Cloud Run service URL for PUBLIC_URL
ServiceName="carelink-server"
Region="asia-southeast1"
PublicUrl=$(gcloud run services describe "$ServiceName" --region "$Region" --project "$ProjectId" --format "value(status.url)" 2>/dev/null)
if [ -z "$PublicUrl" ]; then
  echo "[WARN] Could not resolve Cloud Run URL. Using default."
  PublicUrl="https://${ServiceName}-j7mi5c6znq-as.a.run.app"
fi
echo "[INFO] PUBLIC_URL = $PublicUrl"

echo "[INFO] Submitting to Cloud Build (project: $ProjectId)..."
gcloud builds submit "$ServerPath" \
  --config "$ServerPath/cloudbuild.yaml" \
  --project "$ProjectId" \
  --substitutions "_PUBLIC_URL=$PublicUrl"

if [ $? -ne 0 ]; then
  echo "[ERROR] Cloud Build failed"
  exit 1
fi

echo "[SUCCESS] Server submitted to Cloud Build"
echo "View logs: https://console.cloud.google.com/cloud-build/builds?project=$ProjectId"
echo ""
echo "Cloud Build will automatically deploy to Cloud Run when build completes."
