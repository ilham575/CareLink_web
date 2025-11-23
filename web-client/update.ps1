Write-Host "?? Updating Web Client..." -ForegroundColor Green
gcloud builds submit --tag gcr.io/carelink-web/carelink-client .
if ($LASTEXITCODE -eq 0) { 
    gcloud run deploy carelink-client --image gcr.io/carelink-web/carelink-client --region asia-southeast1 
}
