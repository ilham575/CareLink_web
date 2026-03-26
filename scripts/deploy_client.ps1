# Deploy client to Firebase Hosting (PowerShell)
# Usage: .\deploy_client.ps1 [ApiUrl]

Param(
  [string]$ApiUrl = $null
)

$ClientPath = Join-Path $PSScriptRoot "..\web-client"
Set-Location $ClientPath

Write-Host "[Client] Deploying (React + Firebase)..."

if (-not $ApiUrl) {
  $ApiUrl = "https://carelink-server-j7mi5c6znq-as.a.run.app"
  Write-Host "[WARNING] No API URL provided. Using default: $ApiUrl"
  Write-Host "[TIP] Run: .\deploy_client.ps1 YOUR_SERVER_URL"
}

Write-Host "[INFO] Installing dependencies..."
npm install

if (-not $?) {
  Write-Error "[ERROR] npm install failed"
  exit 1
}

Write-Host "[INFO] Building with API_URL: $ApiUrl"
$env:REACT_APP_API_URL = $ApiUrl
$env:REACT_APP_SOCKET_URL = $ApiUrl
$env:CI = "false"
npm run build

if (-not $?) {
  Write-Error "[ERROR] npm run build failed"
  exit 1
}

Write-Host "[INFO] Deploying to Firebase Hosting..."
Write-Host "[TIP] Uploading... this may take a few minutes"
firebase deploy --debug

if (-not $?) {
  Write-Error "[ERROR] firebase deploy failed"
  exit 1
}

Write-Host "[SUCCESS] Client deployed to Firebase Hosting"