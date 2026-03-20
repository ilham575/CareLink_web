# Deploy server to Google Cloud Run via Cloud Build (PowerShell)
# Usage: .\deploy_server.ps1 [ProjectId]

Param(
  [string]$ProjectId = $null
)

$ServerPath = Join-Path $PSScriptRoot "..\web-server"
Set-Location $ServerPath

Write-Host "[Server] Deploying (Strapi + Cloud Run)..."

if (-not $ProjectId) {
  $ProjectId = gcloud config get-value project --quiet 2>$null
  if (-not $ProjectId) {
    Write-Error "[ERROR] GCP project not set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
  }
}

# Resolve Cloud Run service URL for PUBLIC_URL
$ServiceName = "carelink-server"
$Region = "asia-southeast1"
$PublicUrl = gcloud run services describe $ServiceName --region $Region --project $ProjectId --format "value(status.url)" 2>$null
if (-not $PublicUrl) {
  Write-Warning "[WARN] Could not resolve Cloud Run URL. Using default."
  $PublicUrl = "https://${ServiceName}-j7mi5c6znq-as.a.run.app"
}
Write-Host "[INFO] PUBLIC_URL = $PublicUrl"

Write-Host "[INFO] Submitting to Cloud Build (project: $ProjectId)..."
gcloud builds submit $ServerPath `
  --config "$ServerPath\cloudbuild.yaml" `
  --project $ProjectId `
  --substitutions "_PUBLIC_URL=$PublicUrl"

if ($LASTEXITCODE -ne 0) {
  Write-Error "[ERROR] Cloud Build failed"
  exit 1
}

Write-Host "[SUCCESS] Server submitted to Cloud Build"
Write-Host "View logs: https://console.cloud.google.com/cloud-build/builds?project=$ProjectId"
Write-Host ""
Write-Host "Cloud Build will automatically deploy to Cloud Run when build completes."
