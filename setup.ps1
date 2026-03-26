# Quick Setup Script for CareLink Deployment

Write-Host "`n=== CareLink Cloud Deployment Setup ===" -ForegroundColor Green
Write-Host "This script will help you set up Cloud SQL and initial configuration`n" -ForegroundColor Cyan

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "โ Google Cloud SDK not installed" -ForegroundColor Red
    Write-Host "Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Google Cloud SDK found" -ForegroundColor Green

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "โ Firebase CLI not installed" -ForegroundColor Red
    Write-Host "Installing Firebase CLI..." -ForegroundColor Yellow
    npm install -g firebase-tools
}
Write-Host "✓ Firebase CLI found" -ForegroundColor Green

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "โ Docker not installed" -ForegroundColor Red
    Write-Host "Install from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Docker found" -ForegroundColor Green

# Get project info
Write-Host "`n--- Project Configuration ---" -ForegroundColor Cyan
$PROJECT_ID = (gcloud config list --format="value(core.project)").Trim()

if (-not $PROJECT_ID) {
    Write-Host "No project selected. Please set:" -ForegroundColor Yellow
    Write-Host "  gcloud config set project YOUR_PROJECT_ID" -ForegroundColor White
    exit 1
}

Write-Host "Project ID: $PROJECT_ID" -ForegroundColor Green

# Generate secrets
Write-Host "`n--- Generating Secrets ---" -ForegroundColor Cyan
Write-Host "Generating secure keys..." -ForegroundColor Yellow

$APP_KEYS = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
$API_TOKEN_SALT = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
$ADMIN_JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
$TRANSFER_TOKEN_SALT = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
$JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Write-Host "✓ Secrets generated" -ForegroundColor Green

# Database setup
Write-Host "`n--- Cloud SQL Database Setup ---" -ForegroundColor Cyan
Write-Host "Create Cloud SQL instance? (y/N): " -ForegroundColor Yellow -NoNewline
$createDb = Read-Host

if ($createDb -eq 'y' -or $createDb -eq 'Y') {
    Write-Host "`nDatabase password (press Enter for auto-generated): " -ForegroundColor Yellow -NoNewline
    $dbPassword = Read-Host
    
    if (-not $dbPassword) {
        $dbPassword = node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
        Write-Host "Generated password: $dbPassword" -ForegroundColor Cyan
    }
    
    Write-Host "`nCreating Cloud SQL instance (this takes 5-10 minutes)..." -ForegroundColor Yellow
    
    gcloud sql instances create carelink-db `
        --database-version=POSTGRES_14 `
        --tier=db-f1-micro `
        --region=asia-southeast1 `
        --root-password=$dbPassword `
        --backup-start-time=03:00
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Cloud SQL instance created" -ForegroundColor Green
        
        Write-Host "`nCreating database..." -ForegroundColor Yellow
        gcloud sql databases create carelink --instance=carelink-db
        
        $connectionName = (gcloud sql instances describe carelink-db --format="value(connectionName)")
        Write-Host "✓ Database created" -ForegroundColor Green
        Write-Host "Connection name: $connectionName" -ForegroundColor Cyan
    } else {
        Write-Host "Failed to create Cloud SQL instance" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Skipping database creation" -ForegroundColor Yellow
    Write-Host "Enter Cloud SQL connection name: " -ForegroundColor Yellow -NoNewline
    $connectionName = Read-Host
    Write-Host "Enter database password: " -ForegroundColor Yellow -NoNewline
    $dbPassword = Read-Host -AsSecureString
    $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))
}

# Create .env.cloudrun
Write-Host "`n--- Creating Configuration Files ---" -ForegroundColor Cyan
Set-Location e:\web_CareLink\web-server

$envContent = @"
# Database Configuration
DATABASE_CLIENT=postgres
DATABASE_HOST=/cloudsql/$connectionName
DATABASE_PORT=5432
DATABASE_NAME=carelink
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=$dbPassword
DATABASE_SSL=false

# Strapi Secrets
APP_KEYS=$APP_KEYS
API_TOKEN_SALT=$API_TOKEN_SALT
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET
TRANSFER_TOKEN_SALT=$TRANSFER_TOKEN_SALT
JWT_SECRET=$JWT_SECRET

# Server Configuration
HOST=0.0.0.0
PORT=1337
NODE_ENV=production

# URLs (will be updated after first deployment)
STRAPI_URL=https://temp.run.app
PUBLIC_URL=https://temp.run.app
STRAPI_ADMIN_BACKEND_URL=https://temp.run.app

# Socket Config
SOCKET_ALLOWED_ORIGINS=*
"@

$envContent | Out-File ".env.cloudrun" -Encoding utf8
Write-Host "✓ Created .env.cloudrun" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Deploy server to Cloud Run:" -ForegroundColor White
Write-Host "   cd e:\web_CareLink\web-server" -ForegroundColor Gray
Write-Host "   .\deploy.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "2. After deployment, update STRAPI_URL in .env.cloudrun" -ForegroundColor White
Write-Host ""
Write-Host "3. Redeploy server with updated URL" -ForegroundColor White
Write-Host ""
Write-Host "4. Deploy client to Firebase:" -ForegroundColor White
Write-Host "   cd e:\web_CareLink\web-client" -ForegroundColor Gray
Write-Host "   .\deploy.ps1 -ServerUrl YOUR_CLOUD_RUN_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "See DEPLOYMENT.md for detailed instructions" -ForegroundColor Yellow
