# Firebase Hosting Deployment Script for React Client
param([string]$ServerUrl = "")

Write-Host "`n=== CareLink Client - Firebase Hosting Deployment ===" -ForegroundColor Green

# Check if .env.production exists
if (-not (Test-Path ".env.production")) {
    Write-Host "Creating .env.production file..." -ForegroundColor Yellow
    if ($ServerUrl) {
        @"
REACT_APP_API_URL=$ServerUrl
REACT_APP_SOCKET_URL=$ServerUrl
REACT_APP_NAME=CareLink
REACT_APP_VERSION=1.0.0
"@ | Out-File ".env.production" -Encoding utf8
    } else {
        Write-Host "Error: Server URL not provided!" -ForegroundColor Red
        Write-Host "Usage: .\deploy.ps1 -ServerUrl 'https://your-server-url'" -ForegroundColor Yellow
        exit 1
    }
}

# Build React app
Write-Host "`nBuilding React application..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild successful!" -ForegroundColor Green

# Check if Firebase CLI is installed
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "`nFirebase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

# Deploy to Firebase
Write-Host "`nDeploying to Firebase Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Green
    Write-Host "Your app is now live on Firebase Hosting!" -ForegroundColor Green
    Write-Host "`nRun 'firebase hosting:channel:list' to see your hosting URL" -ForegroundColor Yellow
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
}
