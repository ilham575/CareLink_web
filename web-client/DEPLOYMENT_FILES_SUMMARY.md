# 📦 GCP Deployment Files Summary

## ไฟล์ที่สร้างขึ้นสำหรับ GCP Deployment

### 1. **Dockerfile.gcp** (Multi-stage Production Build)
   - **วัตถุประสงค์**: สร้าง optimized Docker image สำหรับ GCP Cloud Run
   - **ลักษณะพิเศษ**:
     - ✅ Multi-stage build (dependencies → builder → runtime)
     - ✅ Nginx as reverse proxy
     - ✅ Non-root user execution (security)
     - ✅ Health check endpoint
     - ✅ Minimal image size
   - **ใช้สำหรับ**: Production deployment

### 2. **nginx.conf** (Nginx Configuration)
   - **วัตถุประสงค์**: ตั้งค่า Nginx เพื่อให้บริการ React SPA
   - **ลักษณะพิเศษ**:
     - ✅ SPA routing (try_files for React Router)
     - ✅ Security headers (CSP, X-Frame-Options, etc.)
     - ✅ Gzip compression
     - ✅ Rate limiting
     - ✅ Caching strategy (static assets 1 year, HTML no cache)
     - ✅ Health check endpoint (`/health`)

### 3. **Dockerfile** (Development - Hot Reload)
   - **วัตถุประสงค์**: สำหรับ development ด้วย hot reload
   - **ใช้**: `npm start` สำหรับ development server

### 4. **.dockerignore** (Build Optimization)
   - **วัตถุประสงค์**: ลดขนาด build context
   - **รายการ**: node_modules, build, .git, logs, etc.

### 5. **docker-compose.gcp.yml** (Local Testing)
   - **วัตถุประสงค์**: ทดสอบ GCP-like environment locally
   - **Services**:
     - `web-client-prod`: Production build (port 8080)
     - `web-client-dev`: Development build (port 3000, profiles: dev)

### 6. **GCP_DEPLOYMENT_GUIDE.md** (Comprehensive Guide)
   - **เนื้อหา**:
     - การตั้งค่า GCP Project
     - Build & Push Docker image
     - Deploy ไป Cloud Run
     - Environment variables management
     - Monitoring และ Debugging
     - CI/CD Pipeline with GitHub Actions
     - Troubleshooting

### 7. **cloudbuild.yaml** (Cloud Build Configuration)
   - **วัตถุประสงค์**: Automated build & deploy โดย GCP Cloud Build
   - **Steps**:
     1. Build Docker image
     2. Push to Container Registry
     3. Deploy to Cloud Run
   - **ใช้**: `gcloud builds submit --config=cloudbuild.yaml`

### 8. **deploy-gcp.sh** (Bash Deployment Script)
   - **วัตถุประสงค์**: Automated deployment script
   - **Commands**:
     - `bash deploy-gcp.sh production build` - สร้าง image
     - `bash deploy-gcp.sh production push` - Push ไป registry
     - `bash deploy-gcp.sh production deploy` - Deploy ทั้งหมด
     - `bash deploy-gcp.sh production rollback` - Rollback
     - `bash deploy-gcp.sh production logs` - ดู logs
     - `bash deploy-gcp.sh production status` - ตรวจสอบสถานะ

---

## 🚀 Quick Start

### 1. ตั้งค่า GCP Project
```bash
export PROJECT_ID=your-gcp-project-id
export REGION=asia-southeast1

gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION

gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

### 2. Build & Deploy (ใช้ script)
```bash
# แต่ก่อนอื่น ให้ export environment variables
export GCP_PROJECT_ID=$PROJECT_ID
export GCP_REGION=$REGION

# Build, push, และ deploy
bash deploy-gcp.sh production deploy

# หรือใช้ step-by-step
bash deploy-gcp.sh production build
bash deploy-gcp.sh production push
bash deploy-gcp.sh production deploy
```

### 3. Build & Deploy (ใช้ Docker เอง)
```bash
# Build
docker build -f Dockerfile.gcp -t gcr.io/$PROJECT_ID/web-client:latest .

# Test locally
docker run -p 8080:8080 gcr.io/$PROJECT_ID/web-client:latest

# Push
docker push gcr.io/$PROJECT_ID/web-client:latest

# Deploy
gcloud run deploy carelink-web-client \
  --image gcr.io/$PROJECT_ID/web-client:latest \
  --platform managed \
  --region asia-southeast1 \
  --port 8080 \
  --memory 512Mi \
  --allow-unauthenticated
```

### 4. ทดสอบ Local (Docker Compose)
```bash
# Production build
docker-compose -f docker-compose.gcp.yml up web-client-prod

# Development build (hot reload)
docker-compose -f docker-compose.gcp.yml --profile dev up web-client-dev

# Health check
curl http://localhost:8080/health
```

---

## 📊 Port Mapping

| Service | Port | Purpose |
|---------|------|---------|
| Production (GCP) | 8080 | Cloud Run exposed port |
| Development | 3000 | React dev server |
| Docker local test | 8080 | Nginx (production-like) |

---

## 🔒 Security Features

✅ **ในไฟล์ Docker/Nginx:**
- Non-root user execution
- Security headers (CSP, X-Frame-Options, X-XSS-Protection)
- HTTPS ready
- Rate limiting (30 req/s general, 10 req/s for API)
- Disabled server tokens
- Blocked access to hidden files (.git, .env)

✅ **Environment-based:**
- `.env` สำหรับ development
- `.env.production` สำหรับ production
- Environment variables ต่างกันสำหรับแต่ละ environment

---

## 📈 Performance Optimizations

✅ **Gzip Compression**: เปิดใช้ (comp_level: 6)
✅ **Static Asset Caching**: 1 year cache for versioned files
✅ **HTML Caching**: No cache (always fresh)
✅ **Nginx Worker**: auto (สอดคล้องกับ CPU cores)
✅ **Keep-alive**: 65 seconds
✅ **Min instances**: 1 (avoid cold start)
✅ **Concurrency**: 80 requests per instance

---

## 🛠️ Resource Configuration

### Development
- Memory: 512Mi
- CPU: 1
- Max instances: 10

### Staging
- Memory: 512Mi
- CPU: 1
- Max instances: 50

### Production
- Memory: 1Gi
- CPU: 2
- Max instances: 100

---

## 📝 Environment Variables

```env
# Development (.env)
REACT_APP_API_URL=http://localhost:1337

# Production (.env.production)
REACT_APP_API_URL=https://carelink-strapi-xxxxx.run.app

# Cloud Run (set via gcloud)
gcloud run services update carelink-web-client \
  --set-env-vars REACT_APP_API_URL=https://carelink-strapi-xxxxx.run.app
```

---

## 🔍 Monitoring

```bash
# ดู logs แบบ real-time
gcloud logging read "resource.type=cloud_run_revision" --limit 50 --format json

# ดู recent revisions
gcloud run revisions list --service carelink-web-client

# Health check
curl https://carelink-web-client-xxxxx.run.app/health
```

---

## 🔄 CI/CD Integration

สำหรับ GitHub Actions (อ้างอิง GCP_DEPLOYMENT_GUIDE.md):
1. สร้าง Service Account key
2. เพิ่ม Secrets ใน GitHub
3. สร้าง workflow file
4. Push ไป main/develop branch → auto deploy

---

## ✅ Checklist ก่อน Deploy

- [ ] `.env.production` ถูกตั้งค่า API URL
- [ ] GCP Project ID ถูกตั้งค่า
- [ ] Cloud Run API เปิดใช้งาน
- [ ] Docker ทำงาน
- [ ] gcloud CLI ล็อกอินแล้ว
- [ ] Service Account สร้างเสร็จ
- [ ] Health endpoint ตรวจสอบได้
- [ ] Nginx config ถูกต้อง

---

## 📚 References

| ไฟล์/ส่วน | ลำดับการใช้ |
|---------|----------|
| `Dockerfile.gcp` | ① สร้าง image |
| `nginx.conf` | ① ต้อง copy ในระหว่าง build |
| `docker-compose.gcp.yml` | ② ทดสอบ local |
| `deploy-gcp.sh` | ③ Deploy ไป GCP |
| `cloudbuild.yaml` | ③ Alternative: Cloud Build |
| `GCP_DEPLOYMENT_GUIDE.md` | 📖 อ้างอิง/คู่มือ |

---

## 🆘 Troubleshooting

### Image push failed
```bash
gcloud auth configure-docker gcr.io
docker push gcr.io/$PROJECT_ID/web-client:latest
```

### Service ไม่ start
```bash
# ตรวจสอบ logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# ตรวจสอบ health endpoint
curl https://carelink-web-client-xxxxx.run.app/health
```

### Cold start ช้า
```bash
# Set min instances
gcloud run services update carelink-web-client \
  --min-instances 1 \
  --region asia-southeast1
```

---

**สร้างโดย**: CareLink Team  
**วันที่**: November 22, 2025  
**เวอร์ชัน**: 1.0.0  
