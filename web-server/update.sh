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

info "Building Docker image locally..."

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
if [ "${DRY_RUN}" = "1" ]; then
  info "(dry) docker build -t \"${IMAGE_NAME}:${TAG}\" -f \"${DOCKERFILE_PATH}\" \"${SCRIPT_DIR}\""
else
  if ! docker build -t "${IMAGE_NAME}:${TAG}" -f "${DOCKERFILE_PATH}" "${SCRIPT_DIR}"; then
    fail "Docker build failed"
  fi
fi

# Tag for GCR
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

# Deploy to Cloud Run
# Deploy to Cloud Run
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
