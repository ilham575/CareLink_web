# CareLink Web Client - GCP Cloud Run Deployment Guide

## 📋 สารบัญ

1. [ข้อกำหนด](#ข้อกำหนด)
2. [การตั้งค่า GCP](#การตั้งค่า-gcp)
3. [การสร้าง Docker Image](#การสร้าง-docker-image)
4. [การ Deploy ไป Cloud Run](#การ-deploy-ไป-cloud-run)
5. [การจัดการ Environment Variables](#การจัดการ-environment-variables)
6. [Monitoring และ Debugging](#monitoring-และ-debugging)
7. [CI/CD Pipeline (GitHub Actions)](#cicd-pipeline-github-actions)

---

## ข้อกำหนด

### ที่ต้องติดตั้ง
- Google Cloud SDK (`gcloud` CLI)
- Docker
- Node.js 18+
- Git

### ได้รับอนุญาตใน GCP
- Cloud Run
- Container Registry / Artifact Registry
- Cloud Build (ถ้าใช้)
- Cloud Logging

---

## การตั้งค่า GCP

### 1. สร้าง GCP Project
```bash
# ตั้ง project ID
export PROJECT_ID=your-gcp-project-id
export REGION=asia-southeast1  # หรือ region อื่น

# เลือก project
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION
```

### 2. เปิดใช้ API ที่จำเป็น
```bash
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

### 3. สร้าง Service Account
```bash
# สร้าง service account
gcloud iam service-accounts create carelink-deployer \
  --display-name="CareLink Deployer"

# ให้สิทธิ์
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:carelink-deployer@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:carelink-deployer@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/storage.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:carelink-deployer@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/logging.logWriter
```

---

## การสร้าง Docker Image

### ตัวเลือก 1: Local Build และ Push

```bash
# ตั้งค่า environment
export PROJECT_ID=your-gcp-project-id
export IMAGE_NAME=web-client
export GCP_REGION=asia-southeast1

# สร้าง image
docker build -f Dockerfile.gcp -t gcr.io/$PROJECT_ID/$IMAGE_NAME:latest .

# ทดสอบ image locally
docker run -p 8080:8080 \
  gcr.io/$PROJECT_ID/$IMAGE_NAME:latest

# ตรวจสอบ health endpoint
curl http://localhost:8080/health

# Push ไป Container Registry
docker push gcr.io/$PROJECT_ID/$IMAGE_NAME:latest
```

### ตัวเลือก 2: ใช้ Cloud Build

```bash
# Build ผ่าน Cloud Build
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$IMAGE_NAME:latest \
  --substitutions _IMAGE_NAME=$IMAGE_NAME

# ตรวจสอบ build history
gcloud builds list
```

---

## การ Deploy ไป Cloud Run

### การ Deploy แบบพื้นฐาน

```bash
# Deploy ไป Cloud Run
gcloud run deploy $IMAGE_NAME \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME:latest \
  --platform managed \
  --region $GCP_REGION \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --max-instances 100 \
  --allow-unauthenticated
```

### การ Deploy ด้วยการตั้งค่าสมบูรณ์

```bash
gcloud run deploy $IMAGE_NAME \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME:latest \
  --platform managed \
  --region $GCP_REGION \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --max-instances 100 \
  --min-instances 1 \
  --concurrency 80 \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://carelink-strapi-xxxxx.run.app" \
  --labels env=production,app=carelink-web-client \
  --revision-suffix=$(date +%Y%m%d-%H%M%S)
```

### ตรวจสอบ Deployment

```bash
# ดู URL ของ service
gcloud run services describe $IMAGE_NAME \
  --platform managed \
  --region $GCP_REGION

# ทดสอบ health endpoint
SERVICE_URL=$(gcloud run services describe $IMAGE_NAME \
  --platform managed \
  --region $GCP_REGION \
  --format 'value(status.url)')

curl $SERVICE_URL/health
```

---

## การจัดการ Environment Variables

### ตั้งค่า Environment Variables ใน Cloud Run

```bash
# ดูค่า environment ปัจจุบัน
gcloud run services describe $IMAGE_NAME \
  --region $GCP_REGION \
  --format 'value(spec.template.spec.containers[0].env)'

# อัปเดต environment variables
gcloud run services update $IMAGE_NAME \
  --region $GCP_REGION \
  --set-env-vars "REACT_APP_API_URL=https://carelink-strapi-xxxxx.run.app"

# ตั้งค่าจากไฟล์
gcloud run services update $IMAGE_NAME \
  --region $GCP_REGION \
  --env-vars-file=.env.cloud
```

### ไฟล์ `.env.cloud` ตัวอย่าง

```env
REACT_APP_API_URL=https://carelink-strapi-xxxxx.run.app
REACT_APP_NAME=CareLink
REACT_APP_VERSION=1.0.0
```

---

## Monitoring และ Debugging

### ดูข้อมูล Logs

```bash
# ดู logs ของ Cloud Run
gcloud run services describe $IMAGE_NAME \
  --region $GCP_REGION

# Stream logs แบบ real-time
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$IMAGE_NAME" \
  --limit 50 \
  --format json \
  --freshness=1m

# ดูจาก Cloud Logging UI
gcloud logging read "resource.type=cloud_run_revision" --limit 100 --format table
```

### Debugging

```bash
# ดู recent revisions
gcloud run revisions list --service $IMAGE_NAME --region $GCP_REGION

# Rollback ไป revision ก่อนหน้า
PREVIOUS_REVISION=$(gcloud run revisions list \
  --service $IMAGE_NAME \
  --region $GCP_REGION \
  --format='value(name)' \
  | sed -n '2p')

gcloud run services update-traffic $IMAGE_NAME \
  --to-revisions=$PREVIOUS_REVISION=100 \
  --region $GCP_REGION

# ดู metrics
gcloud monitoring dashboards list
```

### Health Check

```bash
# ทำ health check
curl -v $SERVICE_URL/health

# ดู response
# ต้องได้ 200 OK และ JSON response
```

---

## CI/CD Pipeline (GitHub Actions)

### สร้าง `github/workflows/deploy-gcp.yml`

```yaml
name: Deploy to GCP Cloud Run

on:
  push:
    branches: [main, develop]
    paths:
      - 'web-client/**'
  workflow_dispatch:

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: asia-southeast1
  IMAGE_NAME: web-client

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          export_default_credentials: true

      - name: Configure Docker authentication
        run: |
          gcloud auth configure-docker gcr.io

      - name: Build and Push Docker image
        run: |
          docker build -f web-client/Dockerfile.gcp \
            -t gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:latest \
            -t gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            ./web-client
          
          docker push gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:latest
          docker push gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.IMAGE_NAME }} \
            --image gcr.io/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:latest \
            --platform managed \
            --region ${{ env.REGION }} \
            --port 8080 \
            --memory 512Mi \
            --cpu 1 \
            --max-instances 100 \
            --allow-unauthenticated \
            --set-env-vars REACT_APP_API_URL=${{ secrets.API_URL }}

      - name: Get service URL
        run: |
          echo "Service deployed at:"
          gcloud run services describe ${{ env.IMAGE_NAME }} \
            --platform managed \
            --region ${{ env.REGION }} \
            --format 'value(status.url)'

      - name: Health check
        run: |
          SERVICE_URL=$(gcloud run services describe ${{ env.IMAGE_NAME }} \
            --platform managed \
            --region ${{ env.REGION }} \
            --format 'value(status.url)')
          
          sleep 10
          curl -f $SERVICE_URL/health || exit 1
```

### ตั้งค่า GitHub Secrets

ใน GitHub Repository Settings → Secrets, เพิ่ม:
- `GCP_PROJECT_ID`: Project ID ของ GCP
- `GCP_SA_KEY`: Service Account Key (JSON)
- `API_URL`: URL ของ API backend

---

## Performance Tuning

### Resource Configuration

```bash
# Increase memory for better performance
gcloud run services update $IMAGE_NAME \
  --region $GCP_REGION \
  --memory 1Gi \
  --cpu 2

# Set concurrency
gcloud run services update $IMAGE_NAME \
  --region $GCP_REGION \
  --concurrency 100

# Set min instances for zero-cold-start
gcloud run services update $IMAGE_NAME \
  --region $GCP_REGION \
  --min-instances 1
```

### Caching Strategy

nginx configuration ได้ตั้งค่า:
- **Static assets** (.js, .css, .png, etc.): 1 ปี cache
- **HTML files**: No cache (max-age=0)
- **Gzip compression**: เปิดใช้งาน
- **Rate limiting**: 30 req/s per IP

---

## Security Best Practices

✅ **ในไฟล์นี้ที่ได้ทำ:**
- Non-root user execution
- Security headers (CSP, X-Frame-Options)
- Rate limiting
- Health check endpoint
- HTTPS ready
- Gzip compression

✅ **ที่ควรตรวจสอบ:**
- [ ] CORS configuration (ถ้าต้อง)
- [ ] API authentication/authorization
- [ ] SSL/TLS certificates
- [ ] Regular security updates

---

## Troubleshooting

### Image Push Failed
```bash
# ลองตั้งค่า Docker auth ใหม่
gcloud auth configure-docker gcr.io
docker push gcr.io/$PROJECT_ID/$IMAGE_NAME:latest
```

### Service ไม่ start
```bash
# ดู logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$IMAGE_NAME" \
  --limit 50 --format json

# ตรวจสอบ health endpoint
curl -v $SERVICE_URL/health
```

### Cold start ช้า
```bash
# ตั้ง min instances
gcloud run services update $IMAGE_NAME \
  --region $GCP_REGION \
  --min-instances 1
```

---

## References

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Dockerfile Best Practices](https://docs.docker.com/develop/dockerfile_best-practices/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [React Deployment Guide](https://create-react-app.dev/deployment/)

---

## Contact & Support

สำหรับคำถามหรือปัญหา ติดต่อ: CareLink Team
