Write-Host ">> Running Database Migration on GCP..." -ForegroundColor Green

$serviceName = "carelink-strapi"
$region = "asia-southeast1"
$projectId = "carelink-web"
$cloudSqlInstance = "carelink-web:asia-southeast1:carelink-db"

# Database credentials from GCP Cloud SQL
$dbName = "carelink_db"
$dbUser = "postgres"
$dbPassword = "Ihsan53295"

# Create migration job with Cloud SQL configured
Write-Host ">> Creating migration job with Cloud SQL access..." -ForegroundColor Yellow

gcloud run jobs create db-migration `
  --image gcr.io/$projectId/$serviceName`:latest `
  --region $region `
  --command "/bin/sh" `
  --args "-c,node ./migrate-direct.js" `
  --max-retries 1 `
  --parallelism 1 `
  --cpu 2 `
  --memory 1024Mi `
  --task-timeout 1800 `
  --set-cloudsql-instances $cloudSqlInstance `
  --set-env-vars NODE_ENV=production,DATABASE_NAME=$dbName,DATABASE_USERNAME=$dbUser,DATABASE_PASSWORD=$dbPassword

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
    Write-Host ">> Checking logs..." -ForegroundColor Yellow
    gcloud run jobs executions list `
      --job db-migration `
      --region $region `
      --limit 1 `
      --format="value(name)"
    exit 1
}

Write-Host "[SUCCESS] Database migration completed!" -ForegroundColor Green

# Clean up the job
Write-Host ">> Cleaning up migration job..." -ForegroundColor Yellow
gcloud run jobs delete db-migration `
  --region $region `
  --quiet

Write-Host "[SUCCESS] Migration job cleaned up." -ForegroundColor Green