#!/bin/bash
# ============================================
# CareLink Web Client - GCP Deployment Script
# ============================================
# Usage: bash deploy-gcp.sh [environment] [action]
# Example: bash deploy-gcp.sh production deploy
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Configuration
# ============================================

PROJECT_ID="${GCP_PROJECT_ID:-your-gcp-project-id}"
REGION="${GCP_REGION:-asia-southeast1}"
IMAGE_NAME="${IMAGE_NAME:-web-client}"
SERVICE_NAME="${SERVICE_NAME:-carelink-web-client}"
DOCKER_REGISTRY="gcr.io"

# Environment-specific settings
declare -A ENV_CONFIGS=(
  [development]="512Mi|1|10"
  [staging]="512Mi|1|50"
  [production]="1Gi|2|100"
)

# ============================================
# Functions
# ============================================

print_header() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}=====================================${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}! $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

check_prerequisites() {
  print_header "ตรวจสอบ Prerequisites"
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    print_error "Docker ไม่ได้ติดตั้ง"
    exit 1
  fi
  print_success "Docker ติดตั้งอยู่"
  
  # Check gcloud
  if ! command -v gcloud &> /dev/null; then
    print_error "Google Cloud SDK ไม่ได้ติดตั้ง"
    exit 1
  fi
  print_success "Google Cloud SDK ติดตั้งอยู่"
  
  # Check if logged in
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    print_error "ไม่ได้ login ไปยัง GCP"
    exit 1
  fi
  print_success "ล็อกอินไปยัง GCP แล้ว"
  
  # Verify project
  CURRENT_PROJECT=$(gcloud config get-value project)
  if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    print_warning "Project ปัจจุบัน: $CURRENT_PROJECT"
    print_info "ตั้งค่า project เป็น $PROJECT_ID"
    gcloud config set project $PROJECT_ID
  fi
  print_success "Project: $PROJECT_ID"
}

build_image() {
  local env=$1
  print_header "สร้าง Docker Image ($env)"
  
  local image_tag="$DOCKER_REGISTRY/$PROJECT_ID/$IMAGE_NAME:$env"
  local image_latest="$DOCKER_REGISTRY/$PROJECT_ID/$IMAGE_NAME:latest"
  
  print_info "Image tag: $image_tag"
  
  if docker build -f Dockerfile.gcp \
    -t "$image_tag" \
    -t "$image_latest" \
    --build-arg ENVIRONMENT=$env \
    .; then
    print_success "Image สร้างเสร็จ"
    return 0
  else
    print_error "การสร้าง image ล้มเหลว"
    return 1
  fi
}

push_image() {
  local env=$1
  print_header "Push Image ไป Container Registry"
  
  # Configure Docker
  print_info "ตั้งค่า Docker authentication..."
  gcloud auth configure-docker $DOCKER_REGISTRY
  
  local image_tag="$DOCKER_REGISTRY/$PROJECT_ID/$IMAGE_NAME:$env"
  local image_latest="$DOCKER_REGISTRY/$PROJECT_ID/$IMAGE_NAME:latest"
  
  print_info "Push $image_tag..."
  if docker push "$image_tag"; then
    print_success "Push $image_tag เสร็จ"
  else
    print_error "Push ล้มเหลว"
    return 1
  fi
  
  print_info "Push $image_latest..."
  if docker push "$image_latest"; then
    print_success "Push $image_latest เสร็จ"
  else
    print_error "Push ล้มเหลว"
    return 1
  fi
}

deploy() {
  local env=$1
  print_header "Deploy ไป Cloud Run ($env)"
  
  local image="$DOCKER_REGISTRY/$PROJECT_ID/$IMAGE_NAME:$env"
  
  # Get memory, cpu, max-instances from config
  IFS='|' read -r memory cpu max_instances <<< "${ENV_CONFIGS[$env]}"
  
  print_info "Memory: $memory, CPU: $cpu, Max instances: $max_instances"
  
  # Set API URL based on environment
  local api_url=""
  case $env in
    development)
      api_url="http://localhost:1337"
      ;;
    staging)
      api_url="https://carelink-strapi-staging.run.app"
      ;;
    production)
      api_url="https://carelink-strapi-xxxxx.run.app"
      ;;
  esac
  
  print_info "API URL: $api_url"
  
  # Deploy
  if gcloud run deploy $SERVICE_NAME-$env \
    --image $image \
    --platform managed \
    --region $REGION \
    --port 8080 \
    --memory $memory \
    --cpu $cpu \
    --timeout 3600 \
    --max-instances $max_instances \
    --min-instances 1 \
    --concurrency 80 \
    --allow-unauthenticated \
    --set-env-vars "REACT_APP_API_URL=$api_url" \
    --labels env=$env,app=carelink-web-client \
    --revision-suffix=$(date +%Y%m%d-%H%M%S); then
    print_success "Deploy เสร็จ"
    
    # Get URL
    local service_url=$(gcloud run services describe $SERVICE_NAME-$env \
      --platform managed \
      --region $REGION \
      --format 'value(status.url)')
    
    print_success "Service URL: $service_url"
    
    # Health check
    print_info "ทำการ health check..."
    sleep 5
    if curl -f $service_url/health > /dev/null 2>&1; then
      print_success "Health check ผ่าน ✓"
    else
      print_warning "Health check ยังไม่สามารถเข้าถึงได้ (อาจต้องใช้เวลา)"
    fi
    
    return 0
  else
    print_error "Deploy ล้มเหลว"
    return 1
  fi
}

rollback() {
  local env=$1
  print_header "Rollback ไป Revision ก่อนหน้า ($env)"
  
  local service_name="$SERVICE_NAME-$env"
  
  # Get previous revision
  local previous_revision=$(gcloud run revisions list \
    --service $service_name \
    --region $REGION \
    --format='value(name)' \
    --limit 2 \
    | sed -n '2p')
  
  if [ -z "$previous_revision" ]; then
    print_error "ไม่พบ revision ก่อนหน้า"
    return 1
  fi
  
  print_info "Rollback ไป: $previous_revision"
  
  if gcloud run services update-traffic $service_name \
    --to-revisions=$previous_revision=100 \
    --region $REGION; then
    print_success "Rollback เสร็จ"
    return 0
  else
    print_error "Rollback ล้มเหลว"
    return 1
  fi
}

show_logs() {
  local env=$1
  print_header "แสดง Logs ($env)"
  
  gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME-$env" \
    --limit 50 \
    --format json
}

status() {
  local env=$1
  print_header "สถานะ Service ($env)"
  
  gcloud run services describe $SERVICE_NAME-$env \
    --platform managed \
    --region $REGION
}

# ============================================
# Main
# ============================================

main() {
  local environment=${1:-production}
  local action=${2:-deploy}
  
  print_header "CareLink Web Client - GCP Deployment"
  print_info "Environment: $environment"
  print_info "Action: $action"
  
  # Validate environment
  if [[ ! " development staging production " =~ " $environment " ]]; then
    print_error "Environment ต้องเป็น: development, staging, production"
    exit 1
  fi
  
  check_prerequisites
  
  case $action in
    build)
      build_image $environment
      ;;
    push)
      push_image $environment
      ;;
    deploy)
      build_image $environment && \
      push_image $environment && \
      deploy $environment
      ;;
    build-push)
      build_image $environment && \
      push_image $environment
      ;;
    rollback)
      rollback $environment
      ;;
    logs)
      show_logs $environment
      ;;
    status)
      status $environment
      ;;
    *)
      print_error "Action ไม่ถูกต้อง: $action"
      print_info "Actions ที่ใช้ได้: build, push, deploy, build-push, rollback, logs, status"
      exit 1
      ;;
  esac
}

# Run main
main "$@"
