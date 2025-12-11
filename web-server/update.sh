#!/usr/bin/env bash
# web-server/update.sh
# Converted from update.ps1 (PowerShell) to a Debian-compatible Bash script
# Usage: ./update.sh

set -euo pipefail

# ANSI colors
COLOR_GREEN="\e[32m"
COLOR_CYAN="\e[36m"
COLOR_YELLOW="\e[33m"
COLOR_RED="\e[31m"
COLOR_RESET="\e[0m"

info(){ echo -e "${COLOR_CYAN}>> $*${COLOR_RESET}" ; }
success(){ echo -e "${COLOR_GREEN}[SUCCESS] $*${COLOR_RESET}" ; }
warn(){ echo -e "${COLOR_YELLOW}[WARN] $*${COLOR_RESET}" ; }
fail(){ echo -e "${COLOR_RED}[FAILED] $*${COLOR_RESET}" ; exit 1 ; }

info "Updating Strapi Server..."
info "Building Docker image..."

# Configuration
PROJECT_ID="carelink-web"
IMAGE_NAME="carelink-strapi"
REGION="asia-southeast1"
TAG="latest"

# Allow overrides via environment variables
PROJECT_ID="${PROJECT_ID:-$PROJECT_ID}"
IMAGE_NAME="${IMAGE_NAME:-$IMAGE_NAME}"
REGION="${REGION:-$REGION}"
TAG="${TAG:-$TAG}"

# Build locally first
# Honor DRY_RUN environment variable for safe testing
DRY_RUN=${DRY_RUN:-0}
if [ "${DRY_RUN}" = "1" ]; then
  warn "DRY_RUN=1 — skipping docker/gcloud operations. This is a dry run."
fi

info "Building Docker image (local or Cloud Build)..."

# Determine the directory of this script (the web-server folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKERFILE_PATH="${SCRIPT_DIR}/Dockerfile"

# Preflight checks
if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not installed or not in PATH"
fi
if ! command -v gcloud >/dev/null 2>&1; then
  warn "gcloud not found in PATH — ensure Cloud SDK is installed for deployment"
fi

if [ ! -f "${DOCKERFILE_PATH}" ]; then
  fail "Dockerfile not found at ${DOCKERFILE_PATH}. Please run the script from the repo root, or place this script in the web-server folder."
fi

info "Using Dockerfile: ${DOCKERFILE_PATH}"
info "Build context: ${SCRIPT_DIR}"

# Build using the script directory as build context and explicit Dockerfile
# Decide whether to use Cloud Build (default) or local Docker
USE_CLOUDBUILD=${USE_CLOUDBUILD:-1}
if [ "${USE_CLOUDBUILD}" = "1" ]; then
  # Use Cloud Build with cloudbuild.yaml (substitutions will default to those in the file)
  info "Using Google Cloud Build with 'cloudbuild.yaml'"
  # Use cloudbuild file from web-client folder
  CLOUDBUILD_CONFIG="${SCRIPT_DIR}/../web-client/cloudbuild.yaml"
  if [ ! -f "${CLOUDBUILD_CONFIG}" ]; then
    warn "Cloud Build config not found at ${CLOUDBUILD_CONFIG}, falling back to local cloudbuild.yaml"
    CLOUDBUILD_CONFIG="${SCRIPT_DIR}/cloudbuild.yaml"
  else
    info "Using Cloud Build config: ${CLOUDBUILD_CONFIG}"
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    warn "gcloud not found in PATH. Falling back to local Docker build. To force Cloud Build, install gcloud or set USE_CLOUDBUILD=0"
    USE_CLOUDBUILD=0
  fi
fi

if [ "${USE_CLOUDBUILD}" = "1" ]; then
  if [ "${DRY_RUN}" = "1" ]; then
    info "(dry) gcloud builds submit --config=cloudbuild.yaml"
  else
    # Run Cloud Build submit which will build, push and deploy as defined by cloudbuild.yaml
    if ! gcloud builds submit --config="${CLOUDBUILD_CONFIG}"; then
      fail "gcloud builds submit failed"
    fi
  fi
else
  # Fallback to local Docker build and push
  if [ "${DRY_RUN}" = "1" ]; then
    info "(dry) docker build --build-arg PUBLIC_URL=http://localhost:1337 -t \"${IMAGE_NAME}:${TAG}\" -f \"${DOCKERFILE_PATH}\" \"${SCRIPT_DIR}\""
  else
    if ! docker build --build-arg PUBLIC_URL=http://localhost:1337 -t "${IMAGE_NAME}:${TAG}" -f "${DOCKERFILE_PATH}" "${SCRIPT_DIR}"; then
      fail "Docker build failed"
    fi
  fi
fi

# If we used Cloud Build, the cloudbuild job should have handled push and deploy.
if [ "${USE_CLOUDBUILD}" = "1" ]; then
  success "Cloud Build job submitted and completed (check Cloud Build logs for details)."
  exit 0
fi

# Tag for GCR (local path)
info "Tagging image for GCR..."
if [ "${DRY_RUN}" = "1" ]; then
  info "(dry) docker tag \"${IMAGE_NAME}:${TAG}\" \"gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${TAG}\""
else
  if ! docker tag "${IMAGE_NAME}:${TAG}" "gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${TAG}"; then
    fail "Docker tag failed"
  fi
fi

# Push to GCR
info "Pushing to Google Container Registry..."
if [ "${DRY_RUN}" = "1" ]; then
  info "(dry) docker push \"gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${TAG}\""
else
  if ! docker push "gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${TAG}"; then
    fail "Docker push failed"
  fi
fi

# Deploy to Cloud Run (local path)
info "Deploying to Cloud Run..."
# Use an array for arguments so that splitting is safe
GCLOUD_ARGS=(run deploy "${IMAGE_NAME}" --image "gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${TAG}" --region "${REGION}" --allow-unauthenticated --platform managed --memory 512Mi --cpu 2 --timeout 3600)

if [ "${DRY_RUN}" = "1" ]; then
  info "(dry) gcloud ${GCLOUD_ARGS[*]}"
else
  if ! gcloud "${GCLOUD_ARGS[@]}"; then
    fail "Deployment failed"
  else
    success "Deployment successful!"
  fi
fi

# End of script
