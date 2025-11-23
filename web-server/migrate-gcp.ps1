Write-Host ">> Running Database Migration on GCP..." -ForegroundColor Green

$serviceName = "carelink-strapi"
$region = "asia-southeast1"
$projectId = "carelink-web"

# Create migration job
Write-Host ">> Creating migration job..." -ForegroundColor Yellow
gcloud run jobs create db-migration `
  --image gcr.io/$projectId/$serviceName`:latest `
  --region $region `
  --command "npm" `
  --args "run,db:migrate" `
  --max-retries 1 `
  --parallelism 1 `
  --cpu 1 `
  --memory 512Mi `
  --set-env-vars NODE_ENV=production

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAILED] Failed to create migration job" -ForegroundColor Red
    exit 1
}

# Execute migration
Write-Host ">> Executing migration..." -ForegroundColor Yellow
gcloud run jobs execute db-migration `
  --region $region `
  --wait

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAILED] Migration execution failed" -ForegroundColor Red
    exit 1
}

Write-Host "[SUCCESS] Database migration completed!" -ForegroundColor Green

# Clean up the job
Write-Host ">> Cleaning up migration job..." -ForegroundColor Yellow
gcloud run jobs delete db-migration `
  --region $region `
  --quiet

Write-Host "[SUCCESS] Migration job cleaned up." -ForegroundColor Green