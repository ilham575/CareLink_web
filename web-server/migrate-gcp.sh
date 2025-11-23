#!/bin/bash

echo "🚀 Running Database Migration on GCP..."

# Get the latest Cloud Run service name
SERVICE_NAME="carelink-strapi"
REGION="asia-southeast1"

# Execute migration command on Cloud Run
gcloud run jobs create db-migration \
  --image gcr.io/carelink-web/carelink-strapi:latest \
  --region $REGION \
  --command "npm" \
  --args "run,db:migrate" \
  --max-retries 1 \
  --parallelism 1 \
  --cpu 1 \
  --memory 512Mi \
  --set-env-vars NODE_ENV=production

echo "✅ Migration job created. Running migration..."

gcloud run jobs execute db-migration \
  --region $REGION \
  --wait

echo "✅ Database migration completed!"

# Clean up the job (optional)
gcloud run jobs delete db-migration \
  --region $REGION \
  --quiet

echo "✅ Migration job cleaned up."