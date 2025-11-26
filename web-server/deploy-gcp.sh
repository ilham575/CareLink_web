#!/bin/bash
# Quick deployment script สำหรับ GCP Cloud Run

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== CareLink Strapi GCP Deployment Script ===${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
command -v gcloud >/dev/null 2>&1 || { echo -e "${RED}gcloud CLI is not installed${NC}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is not installed${NC}"; exit 1; }

# Get GCP configuration
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: No GCP project selected${NC}"
  echo "Set project with: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo -e "${GREEN}GCP Project: $PROJECT_ID${NC}"

# Check if .env.gcp exists
if [ ! -f ".env.gcp" ]; then
  echo -e "${YELLOW}Creating .env.gcp from template...${NC}"
  cp .env.gcp.example .env.gcp
  echo -e "${RED}Please edit .env.gcp with your configuration${NC}"
  exit 1
fi

# Load environment variables
export $(cat .env.gcp | grep -v '^#' | xargs)

# Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t gcr.io/$PROJECT_ID/carelink-strapi:latest -f Dockerfile.gcp .

# Configure Docker authentication
echo -e "${YELLOW}Configuring Docker authentication...${NC}"
gcloud auth configure-docker

# Push to Container Registry
echo -e "${YELLOW}Pushing image to Container Registry...${NC}"
docker push gcr.io/$PROJECT_ID/carelink-strapi:latest

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy carelink-strapi \
  --image gcr.io/$PROJECT_ID/carelink-strapi:latest \
  --platform managed \
  --region asia-southeast1 \
  --port 1337 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --allow-unauthenticated \
  --add-cloudsql-instances carelink-web:asia-southeast1:carelink-db \
  --set-env-vars="NODE_ENV=production,DATABASE_CLIENT=$DATABASE_CLIENT,DATABASE_HOST=$DATABASE_HOST,DATABASE_PORT=$DATABASE_PORT,DATABASE_NAME=$DATABASE_NAME,DATABASE_USERNAME=$DATABASE_USERNAME,DATABASE_PASSWORD=$DATABASE_PASSWORD,ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET,JWT_SECRET=$JWT_SECRET,API_TOKEN_SALT=$API_TOKEN_SALT,TRANSFER_TOKEN_SALT=$TRANSFER_TOKEN_SALT"

# Get service URL
echo -e "${YELLOW}Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe carelink-strapi --platform managed --region asia-southeast1 --format='value(status.url)')

echo -e "${GREEN}=== Deployment Successful ===${NC}"
echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"
echo -e "${GREEN}Admin URL: $SERVICE_URL/admin${NC}"

# Display logs command
echo ""
echo -e "${YELLOW}To view logs, run:${NC}"
echo "gcloud run services logs read carelink-strapi --limit 50 --follow --platform managed --region asia-southeast1"
