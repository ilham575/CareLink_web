# ====================================================================
# CareLink — GCP Setup Script (PowerShell)
# Project ID : carelink-web-489111
# Region      : asia-southeast1 (Singapore)
# ====================================================================
# ใช้งาน: เปิด PowerShell แล้วรัน .\setup-gcp.ps1
# สิ่งที่ต้องมีก่อน:
#   1. gcloud CLI  → https://cloud.google.com/sdk/docs/install
#   2. firebase CLI → npm install -g firebase-tools
#   3. docker (ถ้าต้องการ build local)
# ====================================================================

param(
    [string]$Step = "all"   # "all" | "apis" | "sql" | "gcs" | "sa" | "secrets" | "registry" | "build" | "client"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Variables ───────────────────────────────────────────────────────
$PROJECT_ID       = "carelink-web-489111"
$REGION           = "asia-southeast1"
$SERVICE_NAME     = "carelink-server"
$SA_NAME          = "carelink-sa"
$SA_EMAIL         = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
$SQL_INSTANCE     = "carelink-db"
$SQL_DATABASE     = "carelink_db"
$SQL_USER         = "carelink_user"
$GCS_BUCKET       = "carelink-uploads-489111"
$REPO_NAME        = "carelink-repo"
$IMAGE            = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/carelink-server"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CareLink GCP Deployment Setup" -ForegroundColor Cyan
Write-Host "  Project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host "  Region : $REGION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ─── Helper ──────────────────────────────────────────────────────────
function Run-Step([string]$Title, [scriptblock]$Block) {
    Write-Host "`n▶  $Title" -ForegroundColor Yellow
    & $Block
    Write-Host "✅  $Title — Done" -ForegroundColor Green
}

function Confirm-Continue([string]$Msg) {
    $r = Read-Host "$Msg [Y/n]"
    if ($r -eq "n" -or $r -eq "N") { exit 0 }
}

# ====================================================================
# 0. ตั้งค่า Project ปัจจุบัน
# ====================================================================
Run-Step "Set active project" {
    gcloud config set project $PROJECT_ID
    # เปิด Billing จำเป็นต้องทำก่อนผ่าน Console ถ้ายังไม่ได้เปิด
    Write-Host "  ⚠️  ตรวจสอบว่าเปิด Billing Account ใน Console แล้ว" -ForegroundColor Magenta
    Write-Host "     https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID" -ForegroundColor DarkGray
}

# ====================================================================
# 1. Enable APIs
# ====================================================================
if ($Step -eq "all" -or $Step -eq "apis") {
    Run-Step "Enable required APIs" {
        $apis = @(
            "run.googleapis.com",
            "sqladmin.googleapis.com",
            "storage.googleapis.com",
            "artifactregistry.googleapis.com",
            "cloudbuild.googleapis.com",
            "secretmanager.googleapis.com",
            "cloudresourcemanager.googleapis.com",
            "iam.googleapis.com",
            "firebase.googleapis.com",
            "firebasehosting.googleapis.com"
        )
        foreach ($api in $apis) {
            Write-Host "  Enabling $api ..." -ForegroundColor DarkGray
            gcloud services enable $api --project=$PROJECT_ID
        }
    }
}

# ====================================================================
# 2. Artifact Registry — เก็บ Docker Image
# ====================================================================
if ($Step -eq "all" -or $Step -eq "registry") {
    Run-Step "Create Artifact Registry repository" {
        $exists = gcloud artifacts repositories describe $REPO_NAME `
            --location=$REGION --project=$PROJECT_ID 2>$null
        if (-not $exists) {
            gcloud artifacts repositories create $REPO_NAME `
                --repository-format=docker `
                --location=$REGION `
                --description="CareLink Docker images" `
                --project=$PROJECT_ID
        } else {
            Write-Host "  Repository already exists, skipping."
        }
        # ตั้งค่า Docker auth
        gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
    }
}

# ====================================================================
# 3. Service Account + IAM Roles
# ====================================================================
if ($Step -eq "all" -or $Step -eq "sa") {
    Run-Step "Create Service Account" {
        $exists = gcloud iam service-accounts describe $SA_EMAIL `
            --project=$PROJECT_ID 2>$null
        if (-not $exists) {
            gcloud iam service-accounts create $SA_NAME `
                --display-name="CareLink Runtime SA" `
                --project=$PROJECT_ID
        } else {
            Write-Host "  Service Account already exists, skipping."
        }

        $roles = @(
            "roles/cloudsql.client",
            "roles/storage.objectAdmin",
            "roles/secretmanager.secretAccessor",
            "roles/run.invoker"
        )
        foreach ($role in $roles) {
            Write-Host "  Binding $role ..." -ForegroundColor DarkGray
            gcloud projects add-iam-policy-binding $PROJECT_ID `
                --member="serviceAccount:$SA_EMAIL" `
                --role=$role `
                --quiet
        }
        # ให้ Cloud Build SA deploy Cloud Run ได้
        $PROJECT_NUMBER = (gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
        $CB_SA = "$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"
        gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL `
            --member="serviceAccount:$CB_SA" `
            --role="roles/iam.serviceAccountUser" `
            --project=$PROJECT_ID

        gcloud projects add-iam-policy-binding $PROJECT_ID `
            --member="serviceAccount:$CB_SA" `
            --role="roles/run.admin" `
            --quiet

        gcloud projects add-iam-policy-binding $PROJECT_ID `
            --member="serviceAccount:$CB_SA" `
            --role="roles/secretmanager.secretAccessor" `
            --quiet
    }
}

# ====================================================================
# 4. Cloud SQL — PostgreSQL (ประหยัดแต่ไม่ช้า)
# ====================================================================
if ($Step -eq "all" -or $Step -eq "sql") {
    Run-Step "Create Cloud SQL instance (PostgreSQL 15)" {
        $exists = gcloud sql instances describe $SQL_INSTANCE `
            --project=$PROJECT_ID 2>$null
        if (-not $exists) {
            Write-Host "  สร้าง Cloud SQL instance (ใช้เวลา ~5 นาที)..." -ForegroundColor DarkGray
            # db-g1-small: 1 shared vCPU, 1.7 GB RAM — ราคา ~$25/เดือน
            # ถ้าต้องการประหยัดสุดใช้ db-f1-micro (~$10/เดือน แต่ช้ากว่า)
            gcloud sql instances create $SQL_INSTANCE `
                --database-version=POSTGRES_15 `
                --tier=db-g1-small `
                --region=$REGION `
                --storage-type=SSD `
                --storage-size=10GB `
                --storage-auto-increase `
                --no-backup `
                --deletion-protection `
                --project=$PROJECT_ID
        } else {
            Write-Host "  SQL instance already exists, skipping."
        }

        # สร้าง Database
        Write-Host "  สร้าง database '$SQL_DATABASE' ..." -ForegroundColor DarkGray
        gcloud sql databases create $SQL_DATABASE `
            --instance=$SQL_INSTANCE `
            --project=$PROJECT_ID 2>$null

        # สร้าง User
        $SQL_PASSWORD = [System.Web.Security.Membership]::GeneratePassword(32, 4)
        # fallback ถ้า GeneratePassword ไม่มี
        if (-not $SQL_PASSWORD) {
            $SQL_PASSWORD = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
        }

        gcloud sql users create $SQL_USER `
            --instance=$SQL_INSTANCE `
            --password=$SQL_PASSWORD `
            --project=$PROJECT_ID 2>$null

        Write-Host "`n  ⚠️  บันทึก Password นี้ไว้ก่อนจะถูกเขียนทับใน Secret Manager:" -ForegroundColor Magenta
        Write-Host "  SQL Password: $SQL_PASSWORD" -ForegroundColor White

        # เขียนลง Secret Manager (แก้ไขแก้ไข Syntax error สำหรับ PowerShell)
        try {
            gcloud secrets describe carelink-db-password --project=$PROJECT_ID 2>$null
            Write-Host "  Secret 'carelink-db-password' exists, adding new version..." -ForegroundColor DarkGray
            $SQL_PASSWORD | gcloud secrets versions add carelink-db-password --data-file=- --project=$PROJECT_ID
        } catch {
            Write-Host "  Creating secret 'carelink-db-password'..." -ForegroundColor DarkGray
            $SQL_PASSWORD | gcloud secrets create carelink-db-password --data-file=- --project=$PROJECT_ID
        }
    }
}

# ====================================================================
# 5. GCS Bucket — File Uploads
# ====================================================================
if ($Step -eq "all" -or $Step -eq "gcs") {
    Run-Step "Create GCS bucket for uploads" {
        $bucketExists = gsutil ls -b "gs://$GCS_BUCKET" 2>$null
        if (-not $bucketExists) {
            gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION "gs://$GCS_BUCKET"
            # ตั้ง Public Access (ไม่ให้ Public ก็ได้ถ้า serve ผ่าน signed URL)
            gsutil iam ch allUsers:objectViewer "gs://$GCS_BUCKET"
            # ให้ SA access
            gsutil iam ch "serviceAccount:${SA_EMAIL}:objectAdmin" "gs://$GCS_BUCKET"
        } else {
            Write-Host "  Bucket already exists, skipping."
        }
    }
}

# ====================================================================
# 6. Secret Manager — App Secrets (สร้างค่าแบบ Random)
# ====================================================================
if ($Step -eq "all" -or $Step -eq "secrets") {
    Run-Step "Create application secrets in Secret Manager" {
        function New-Secret($Name, $Value) {
            $existing = gcloud secrets describe $Name --project=$PROJECT_ID 2>$null
            if ($existing) {
                Write-Host "  Secret '$Name' exists, adding new version..." -ForegroundColor DarkGray
                $Value | gcloud secrets versions add $Name --data-file=- --project=$PROJECT_ID
            } else {
                Write-Host "  Creating secret '$Name'..." -ForegroundColor DarkGray
                $Value | gcloud secrets create $Name --data-file=- --project=$PROJECT_ID
            }
        }

        function New-RandomBase64($Bytes = 32) {
            $rng  = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            $data = [byte[]]::new($Bytes)
            $rng.GetBytes($data)
            return [Convert]::ToBase64String($data)
        }

        # APP_KEYS: ต้องการ 4 keys คั่นด้วยจุลภาค
        $APP_KEYS = "$(New-RandomBase64),$(New-RandomBase64),$(New-RandomBase64),$(New-RandomBase64)"
        New-Secret "carelink-app-keys"           $APP_KEYS
        New-Secret "carelink-api-token-salt"      (New-RandomBase64)
        New-Secret "carelink-admin-jwt-secret"    (New-RandomBase64)
        New-Secret "carelink-transfer-token-salt" (New-RandomBase64)
        New-Secret "carelink-jwt-secret"          (New-RandomBase64)

        Write-Host "  ✅ Secrets created. ดูได้ที่:" -ForegroundColor DarkGray
        Write-Host "     https://console.cloud.google.com/security/secret-manager?project=$PROJECT_ID" -ForegroundColor DarkGray
    }
}

# ====================================================================
# 7. Build & Deploy Server (Cloud Build + Cloud Run)
# ====================================================================
if ($Step -eq "all" -or $Step -eq "build") {
    Run-Step "Build and deploy server via Cloud Build" {
        Write-Host "  กำลัง submit build (อาจใช้เวลา 10-15 นาที)..." -ForegroundColor DarkGray
        Write-Host "  ⚠️  PUBLIC_URL จะถูก set หลัง deploy ครั้งแรก (ใส่ placeholder ก่อน)" -ForegroundColor Magenta

        Push-Location "$PSScriptRoot\..\"
        gcloud builds submit `
            --config=web-server/cloudbuild.yaml `
            --substitutions="_PUBLIC_URL=https://placeholder.run.app" `
            --project=$PROJECT_ID `
            .
        Pop-Location

        # ดึง URL จริงหลัง deploy
        Write-Host "`n  กำลังดึง Cloud Run URL ..." -ForegroundColor DarkGray
        $script:SERVER_URL = gcloud run services describe $SERVICE_NAME `
            --region=$REGION `
            --project=$PROJECT_ID `
            --format="value(status.url)"

        Write-Host ""
        Write-Host "  🚀 Server URL: $script:SERVER_URL" -ForegroundColor Green

        # Update PUBLIC_URL env var บน Cloud Run
        Write-Host "  กำลัง update PUBLIC_URL บน Cloud Run ..." -ForegroundColor DarkGray
        gcloud run services update $SERVICE_NAME `
            --region=$REGION `
            --project=$PROJECT_ID `
            --update-env-vars="PUBLIC_URL=$script:SERVER_URL"
    }
}

# ====================================================================
# 8. Deploy Client to Firebase Hosting
# ====================================================================
if ($Step -eq "all" -or $Step -eq "client") {
    # ดึง SERVER_URL ถ้า step ไม่ได้มาจาก build step
    if (-not (Get-Variable -Name SERVER_URL -ErrorAction SilentlyContinue)) {
        $SERVER_URL = gcloud run services describe $SERVICE_NAME `
            --region=$REGION --project=$PROJECT_ID `
            --format="value(status.url)" 2>$null
        if (-not $SERVER_URL) {
            $SERVER_URL = Read-Host "  ป้อน Cloud Run URL (เช่น https://carelink-server-xxxxx-as.a.run.app)"
        }
    }

    Run-Step "Build React client and deploy to Firebase Hosting" {
        Push-Location "$PSScriptRoot\..\web-client"

        Write-Host "  Building React app with API_URL=$SERVER_URL ..." -ForegroundColor DarkGray
        $env:REACT_APP_API_URL    = $SERVER_URL
        $env:REACT_APP_SOCKET_URL = $SERVER_URL
        $env:REACT_APP_NAME       = "CareLink"
        $env:CI                   = "false"

        npm ci
        npm run build

        Write-Host "  Deploying to Firebase Hosting ..." -ForegroundColor DarkGray
        firebase deploy --only hosting --project $PROJECT_ID

        Pop-Location
    }
}

# ====================================================================
# DONE
# ====================================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
if (Get-Variable -Name SERVER_URL -ErrorAction SilentlyContinue) {
    Write-Host "  🖥️  Server  : $SERVER_URL" -ForegroundColor Green
}
Write-Host "  🌐 Client  : https://$PROJECT_ID.web.app" -ForegroundColor Green
Write-Host ""
Write-Host "  📋 Admin Panel: $SERVER_URL/admin" -ForegroundColor DarkGray
Write-Host ""
