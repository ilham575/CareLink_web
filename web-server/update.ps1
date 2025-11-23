Write-Host "?? Updating Strapi Server..." -ForegroundColor Green
gcloud builds submit --tag gcr.io/carelink-web/carelink-strapi .
if ($LASTEXITCODE -eq 0) { 
    gcloud run deploy carelink-strapi --image gcr.io/carelink-web/carelink-strapi --region asia-southeast1 
}
