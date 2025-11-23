Write-Host ">> Updating Strapi Server..." -ForegroundColor Green
Write-Host ">> Building Docker image..." -ForegroundColor Cyan

$projectId = "carelink-web"
$imageName = "carelink-strapi"
$region = "asia-southeast1"

# Build locally first
Write-Host ">> Building Docker image locally..." -ForegroundColor Yellow
docker build -t ${imageName}:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAILED] Docker build failed" -ForegroundColor Red
    exit 1
}

# Tag for GCR
Write-Host ">> Tagging image for GCR..." -ForegroundColor Yellow
docker tag ${imageName}:latest gcr.io/${projectId}/${imageName}:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAILED] Docker tag failed" -ForegroundColor Red
    exit 1
}

# Push to GCR
Write-Host ">> Pushing to Google Container Registry..." -ForegroundColor Yellow
docker push gcr.io/${projectId}/${imageName}:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAILED] Docker push failed" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run
Write-Host ">> Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy ${imageName} `
  --image gcr.io/${projectId}/${imageName}:latest `
  --region ${region} `
  --allow-unauthenticated `
  --platform managed `
  --memory 512Mi `
  --cpu 2 `
  --timeout 3600

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Deployment successful!" -ForegroundColor Green
} else {
    Write-Host "[FAILED] Deployment failed" -ForegroundColor Red
    exit 1
}
