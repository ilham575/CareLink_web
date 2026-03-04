# CareLink — คู่มือ Deploy บน GCP + Firebase (เริ่มต้นจาก 0)

| รายการ | ที่อยู่ |
|---|---|
| **GCP Project ID** | `carelink-web-489111` |
| **Region** | `asia-southeast1` (Singapore) |
| **Server** | Strapi → Cloud Run |
| **Database** | PostgreSQL 15 → Cloud SQL (`db-g1-small`) |
| **File Storage** | GCS Bucket |
| **Client** | React → Firebase Hosting |

## ต้นทุนโดยประมาณ (ต่อเดือน)

| บริการ | Spec | ราคา/เดือน |
|---|---|---|
| Cloud SQL | `db-g1-small`, 10GB SSD | ~$25 |
| Cloud Run | 1 vCPU, 512MB, min-1 instance | ~$5-15 |
| GCS | Standard, ไม่เกิน 5GB | <$1 |
| Artifact Registry | <1GB images | <$1 |
| Firebase Hosting | Free tier (10GB bandwidth) | $0 |
| **รวม** | | **~$30-40/เดือน** |

> 💡 ประหยัดสุด: เปลี่ยน Cloud SQL เป็น `db-f1-micro` (~$10/เดือน) และ Cloud Run min-instances=0  
> แต่จะช้าลง (cold start ~5-10 วินาที)

---

## สิ่งที่ต้องติดตั้งก่อน

```powershell
# 1. Google Cloud SDK
# ดาวน์โหลดจาก https://cloud.google.com/sdk/docs/install-sdk

# 2. Firebase CLI
npm install -g firebase-tools

# 3. Docker Desktop (ถ้า build local)
# https://www.docker.com/products/docker-desktop/

# ตรวจสอบ
gcloud version
firebase --version
```

---

## ขั้นตอนที่ 1 — เตรียม GCP Project

### 1.1 Login และตั้ง Project

```powershell
# Login ด้วย Google Account
gcloud auth login

# ตั้ง Project
gcloud config set project carelink-web-489111

# ตรวจสอบว่า Project มีอยู่แล้ว
gcloud projects describe carelink-web-489111
```

### 1.2 เปิด Billing (ต้องทำบน Console)

เปิด: https://console.cloud.google.com/billing/linkedaccount?project=carelink-web-489111

> ⚠️ **ขาดการเปิด Billing = ทุกอย่างล้มเหลว** ต้องเปิกก่อนทำขั้นตอนต่อไป

### 1.3 Enable APIs

```powershell
gcloud services enable `
  run.googleapis.com `
  sqladmin.googleapis.com `
  storage.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  secretmanager.googleapis.com `
  iam.googleapis.com `
  firebase.googleapis.com `
  firebasehosting.googleapis.com `
  --project=carelink-web-489111
```

---

## ขั้นตอนที่ 2 — Artifact Registry (เก็บ Docker Image)

```powershell
# สร้าง repository
gcloud artifacts repositories create carelink-repo `
  --repository-format=docker `
  --location=asia-southeast1 `
  --description="CareLink Docker images" `
  --project=carelink-web-489111

# ตั้งค่า Docker auth
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
```

---

## ขั้นตอนที่ 3 — Service Account + IAM

```powershell
# สร้าง Service Account
gcloud iam service-accounts create carelink-sa `
  --display-name="CareLink Runtime SA" `
  --project=carelink-web-489111

# กำหนดสิทธิ์
$SA = "serviceAccount:carelink-sa@carelink-web-489111.iam.gserviceaccount.com"
$PROJECT = "carelink-web-489111"

gcloud projects add-iam-policy-binding $PROJECT --member=$SA --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding $PROJECT --member=$SA --role="roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding $PROJECT --member=$SA --role="roles/secretmanager.secretAccessor"

# ให้ Cloud Build SA สามารถ deploy ได้
$PROJECT_NUMBER = (gcloud projects describe carelink-web-489111 --format="value(projectNumber)")
$CB_SA = "serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT --member=$CB_SA --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT --member=$CB_SA --role="roles/secretmanager.secretAccessor"
gcloud iam service-accounts add-iam-policy-binding `
  "carelink-sa@carelink-web-489111.iam.gserviceaccount.com" `
  --member=$CB_SA `
  --role="roles/iam.serviceAccountUser" `
  --project=$PROJECT
```

---

## ขั้นตอนที่ 4 — Cloud SQL (Database)

```powershell
# สร้าง instance (ใช้เวลา ~5 นาที)
gcloud sql instances create carelink-db `
  --database-version=POSTGRES_15 `
  --tier=db-g1-small `
  --region=asia-southeast1 `
  --storage-type=SSD `
  --storage-size=10GB `
  --storage-auto-increase `
  --no-backup `
  --deletion-protection `
  --project=carelink-web-489111

# สร้าง database
gcloud sql databases create carelink_db `
  --instance=carelink-db `
  --project=carelink-web-489111

# สร้าง user (เปลี่ยน YOUR_STRONG_PASSWORD เป็น password จริง)
gcloud sql users create carelink_user `
  --instance=carelink-db `
  --password=YOUR_STRONG_PASSWORD `
  --project=carelink-web-489111
```

> 📝 **บันทึก Password ไว้** จะใช้ในขั้นตอนต่อไป

---

## ขั้นตอนที่ 5 — GCS Bucket (File Storage)

```powershell
# สร้าง bucket
gsutil mb -p carelink-web-489111 -c STANDARD -l asia-southeast1 gs://carelink-uploads-489111

# อนุญาต public read (สำหรับรูปภาพ)
gsutil iam ch allUsers:objectViewer gs://carelink-uploads-489111

# ให้ Service Account จัดการไฟล์ได้
gsutil iam ch "serviceAccount:carelink-sa@carelink-web-489111.iam.gserviceaccount.com:objectAdmin" `
  gs://carelink-uploads-489111
```

---

## ขั้นตอนที่ 6 — Secret Manager (App Secrets)

```powershell
# ฟังก์ชันสร้าง random base64
function New-RandomBase64 { 
    $b = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    [Convert]::ToBase64String($b)
}

$PROJECT = "carelink-web-489111"

# Database password (ใส่ password ที่สร้างไว้ใน step 4)
echo "YOUR_STRONG_PASSWORD" | gcloud secrets create carelink-db-password --data-file=- --project=$PROJECT

# App secrets (random)
"$(New-RandomBase64),$(New-RandomBase64),$(New-RandomBase64),$(New-RandomBase64)" | `
  gcloud secrets create carelink-app-keys --data-file=- --project=$PROJECT

New-RandomBase64 | gcloud secrets create carelink-api-token-salt     --data-file=- --project=$PROJECT
New-RandomBase64 | gcloud secrets create carelink-admin-jwt-secret   --data-file=- --project=$PROJECT
New-RandomBase64 | gcloud secrets create carelink-transfer-token-salt --data-file=- --project=$PROJECT
New-RandomBase64 | gcloud secrets create carelink-jwt-secret         --data-file=- --project=$PROJECT
```

---

## ขั้นตอนที่ 7 — Deploy Server (Cloud Run) — ครั้งแรก

### 7.1 Submit Cloud Build (ใช้ placeholder URL ก่อน)

```powershell
cd e:\web_CareLink

gcloud builds submit `
  --config=web-server/cloudbuild.yaml `
  --substitutions="_PUBLIC_URL=https://placeholder.run.app" `
  --project=carelink-web-489111 `
  .
```

> ⏳ ใช้เวลาประมาณ 10-15 นาที

### 7.2 ดึง URL จริงและ Update

```powershell
# ดึง URL
$SERVER_URL = gcloud run services describe carelink-server `
  --region=asia-southeast1 `
  --project=carelink-web-489111 `
  --format="value(status.url)"

Write-Host "Server URL: $SERVER_URL"

# Update PUBLIC_URL ให้ถูกต้อง
gcloud run services update carelink-server `
  --region=asia-southeast1 `
  --project=carelink-web-489111 `
  --update-env-vars="PUBLIC_URL=$SERVER_URL"
```

### 7.3 อัปเดตไฟล์ .env และ Deploy ใหม่

แก้ไขไฟล์ต่อไปนี้ให้ใช้ URL จริง:

**`web-client/.env.production`**:
```dotenv
REACT_APP_API_URL=<SERVER_URL จาก step 7.2>
REACT_APP_SOCKET_URL=<SERVER_URL จาก step 7.2>
```

**`web-client/src/.env`** (สำหรับ dev):
```dotenv
REACT_APP_API_URL=<SERVER_URL จาก step 7.2>
```

จากนั้น rebuild server (เพื่อ embed URL ใน Strapi admin):
```powershell
gcloud builds submit `
  --config=web-server/cloudbuild.yaml `
  --substitutions="_PUBLIC_URL=$SERVER_URL" `
  --project=carelink-web-489111 `
  .
```

---

## ขั้นตอนที่ 8 — Setup Firebase Hosting

### 8.1 Login Firebase

```powershell
firebase login
```

### 8.2 ผูก Firebase กับ GCP Project

เปิด: https://console.firebase.google.com/  
→ "Add project" → เลือก **Import existing GCP project** → `carelink-web-489111`  
→ เปิด Hosting

### 8.3 Build และ Deploy Client

```powershell
cd e:\web_CareLink\web-client

# แน่ใจว่า .env.production มี URL ถูกต้อง
# ดู web-client/.env.production

# Install dependencies
npm ci

# Build
$env:CI = "false"
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting --project carelink-web-489111
```

> 🌐 Client จะอยู่ที่: **https://carelink-web-489111.web.app**

---

## ขั้นตอนที่ 9 — CORS และ Middleware

เพิ่ม Firebase Hosting URL ใน Strapi server CORS:

```powershell
gcloud run services update carelink-server `
  --region=asia-southeast1 `
  --project=carelink-web-489111 `
  --update-env-vars="APP_URL=https://carelink-web-489111.web.app"
```

ตรวจสอบ `web-server/config/middlewares.js` ว่ามี CORS config รองรับ Firebase URL แล้ว

---

## การ Deploy ซ้ำ (หลังจากแก้โค้ด)

### Deploy Server
```powershell
cd e:\web_CareLink
$SERVER_URL = gcloud run services describe carelink-server `
  --region=asia-southeast1 --project=carelink-web-489111 `
  --format="value(status.url)"

gcloud builds submit `
  --config=web-server/cloudbuild.yaml `
  --substitutions="_PUBLIC_URL=$SERVER_URL" `
  --project=carelink-web-489111 .
```

### Deploy Client
```powershell
cd e:\web_CareLink\web-client
$env:CI = "false"
npm run build
firebase deploy --only hosting --project carelink-web-489111
```

---

## ใช้ Script อัตโนมัติ

Script `setup-gcp.ps1` ที่ root ทำทุกขั้นตอนอัตโนมัติ:

```powershell
cd e:\web_CareLink

# ทำทุกขั้นตอน
.\setup-gcp.ps1

# หรือทำทีละ step
.\setup-gcp.ps1 -Step apis      # เปิด APIs
.\setup-gcp.ps1 -Step sql       # สร้าง Cloud SQL
.\setup-gcp.ps1 -Step secrets   # สร้าง Secrets
.\setup-gcp.ps1 -Step build     # Build + Deploy server
.\setup-gcp.ps1 -Step client    # Build + Deploy client
```

---

## Checklist

- [ ] เปิด Billing Account บน GCP Project
- [ ] `gcloud auth login` แล้ว
- [ ] Enable APIs ครบ
- [ ] สร้าง Artifact Registry
- [ ] สร้าง Service Account + IAM
- [ ] สร้าง Cloud SQL instance + database + user
- [ ] สร้าง GCS Bucket
- [ ] สร้าง Secrets ทั้งหมดใน Secret Manager
- [ ] Deploy server ครั้งแรก (placeholder URL)
- [ ] อัปเดต `.env.production` ด้วย URL จริง
- [ ] Deploy server อีกครั้ง (URL ถูกต้อง)
- [ ] เชื่อม Firebase กับ GCP project บน Console
- [ ] Deploy client ไป Firebase Hosting
- [ ] ทดสอบ: เข้า Admin Panel → `https://carelink-server-XXXX.run.app/admin`
- [ ] ทดสอบ: เข้า Client → `https://carelink-web-489111.web.app`

---

## แก้ปัญหาที่พบบ่อย

| ปัญหา | สาเหตุ | วิธีแก้ |
|---|---|---|
| Cold start ช้า | min-instances=0 | เพิ่ม `--min-instances=1` |
| CORS error | URL ไม่ถูกต้อง | ตรวจ `middlewares.js` + REACT_APP_API_URL |
| DB connection failed | Cloud SQL socket path ผิด | ตรวจ `DATABASE_HOST=/cloudsql/PROJECT:REGION:INSTANCE` |
| Upload ไม่ได้ | GCS permissions | ตรวจ SA มี `storage.objectAdmin` |
| Admin panel blank | PUBLIC_URL ผิด | ตรวจ `PUBLIC_URL` env var บน Cloud Run |
