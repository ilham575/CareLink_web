# Cloud Run Deployment Script for Strapi Server
param(
    [string]$Action = "deploy",
    [string]$ProjectId = "",
    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "carelink-server"
)

$ErrorActionPreference = "Continue"

Write-Host "`n=== CareLink Strapi - Cloud Run Deployment ===" -ForegroundColor Green

# Get project ID
if (-not $ProjectId) {
    try {
        $ProjectId = (gcloud config list --format="value(core.project)" 2>&1 | Select-Object -First 1).Trim()
    } catch {
        Write-Host "Error: Could not get project ID" -ForegroundColor Red
        Write-Host "Please set project: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Service: $ServiceName`n" -ForegroundColor Cyan

if ($Action -eq "deploy") {
    
    # Check if .env.cloudrun exists
    if (-not (Test-Path ".env.cloudrun")) {
        Write-Host "Error: .env.cloudrun file not found!" -ForegroundColor Red
        Write-Host "Please create .env.cloudrun from .env.cloudrun.example" -ForegroundColor Yellow
        exit 1
    }
    
    # Load environment variables
    Write-Host "Loading environment variables..." -ForegroundColor Cyan
    $envVars = @()
    Get-Content ".env.cloudrun" | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
        $parts = $_ -split '=', 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            # Skip PORT - Cloud Run will set this via the --port flag or default to 8080
            # We must NOT provide it in --set-env-vars as it is a reserved name
            if ($key -ne "PORT") {
                $envVars += "$key=$value"
            }
        }
    }
    
    $envString = $envVars -join ","
    
    # Get STRAPI_URL for build-arg (Admin panel needs it at build time)
    $strapiUrl = ($envVars | Where-Object { $_ -match '^STRAPI_URL=' }).Split('=')[1]
    if (-not $strapiUrl) { $strapiUrl = "https://temp.run.app" }
    
    # Build image name
    $imageName = "gcr.io/$ProjectId/$ServiceName"
    
    Write-Host "`nBuilding Docker image with STRAPI_URL=$strapiUrl..." -ForegroundColor Cyan
    docker build -t $imageName -f Dockerfile.cloudrun --build-arg STRAPI_URL=$strapiUrl .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "`nPushing image to Google Container Registry..." -ForegroundColor Cyan
    gcloud auth configure-docker gcr.io --quiet
    docker push $imageName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker push failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "`nDeploying to Cloud Run..." -ForegroundColor Cyan
    
    # Get Cloud SQL connection name from env
    $sqlConnection = ($envVars | Where-Object { $_ -match '^DATABASE_HOST=' }).Split('=')[1] -replace '/cloudsql/', ''
    
    gcloud run deploy $ServiceName `
        --image=$imageName `
        --platform=managed `
        --region=$Region `
        --port=1337 `
        --memory=4Gi `
        --cpu=2 `
        --timeout=3600 `
        --min-instances=1 `
        --max-instances=3 `
        --concurrency=80 `
        --cpu-boost `
        --allow-unauthenticated `
        --add-cloudsql-instances=$sqlConnection `
        --set-env-vars=$envString
    
    if ($LASTEXITCODE -eq 0) {
        $serviceUrl = gcloud run services describe $ServiceName --platform=managed --region=$Region --format='value(status.url)'
        
        Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Green
        Write-Host "Service URL: $serviceUrl" -ForegroundColor Yellow
        Write-Host "Admin URL: $serviceUrl/admin" -ForegroundColor Yellow
        Write-Host "`nIMPORTANT: Update STRAPI_URL in .env.cloudrun with:" -ForegroundColor Cyan
        Write-Host "  $serviceUrl" -ForegroundColor White
        Write-Host "`nThen redeploy to rebuild admin panel with correct URL" -ForegroundColor Cyan
    } else {
        Write-Host "`nDeployment failed!" -ForegroundColor Red
    }
    
} elseif ($Action -eq "logs") {
    Write-Host "Fetching logs..." -ForegroundColor Cyan
    gcloud run services logs read $ServiceName --platform=managed --region=$Region --limit=50
    
} elseif ($Action -eq "info") {
    $serviceUrl = gcloud run services describe $ServiceName --platform=managed --region=$Region --format='value(status.url)'
    Write-Host "`nService: $ServiceName" -ForegroundColor Green
    Write-Host "URL: $serviceUrl" -ForegroundColor Yellow
    Write-Host "Admin: $serviceUrl/admin" -ForegroundColor Yellow
    
} elseif ($Action -eq "delete") {
    Write-Host "Delete service? (y/N): " -ForegroundColor Red -NoNewline
    $confirm = Read-Host
    if ($confirm -eq 'y') {
        gcloud run services delete $ServiceName --platform=managed --region=$Region --quiet
        Write-Host "Service deleted" -ForegroundColor Green
    }
    
} else {
    Write-Host "Usage: .\deploy.ps1 [-Action deploy|logs|info|delete]" -ForegroundColor Cyan
    Write-Host "       .\deploy.ps1 -Action deploy -ProjectId YOUR_PROJECT" -ForegroundColor Cyan
}
