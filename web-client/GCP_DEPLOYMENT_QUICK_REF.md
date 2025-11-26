# 🚀 GCP Deployment - Quick Reference

## ไฟล์ที่สร้าง (7 ไฟล์)

```
✅ Dockerfile.gcp              → Multi-stage production build
✅ nginx.conf                  → Nginx reverse proxy config
✅ Dockerfile                  → Development build (hot reload)
✅ .dockerignore              → Build optimization
✅ docker-compose.gcp.yml     → Local testing
✅ cloudbuild.yaml            → Cloud Build automation
✅ deploy-gcp.sh              → Deployment script
✅ GCP_DEPLOYMENT_GUIDE.md    → Full documentation
✅ DEPLOYMENT_FILES_SUMMARY.md → File summary & quick start
```

---

## 5 นาที Deploy ไป GCP

### ขั้นตอนที่ 1: ตั้งค่า GCP (5 min)
```bash
# Set environment variables
export PROJECT_ID=your-gcp-project-id
export REGION=asia-southeast1

# Login & configure
gcloud auth login
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION

# Enable APIs
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

### ขั้นตอนที่ 2: Build & Push Image (3 min)
```bash
# Navigate to web-client folder
cd web-client

# Build image
docker build -f Dockerfile.gcp -t gcr.io/$PROJECT_ID/web-client:latest .

# Configure Docker auth
gcloud auth configure-docker gcr.io

# Push image
docker push gcr.io/$PROJECT_ID/web-client:latest
```

### ขั้นตอนที่ 3: Deploy ไป Cloud Run (2 min)
```bash
gcloud run deploy carelink-web-client \
  --image gcr.io/$PROJECT_ID/web-client:latest \
  --platform managed \
  --region $REGION \
  --port 8080 \
  --memory 512Mi \
  --allow-unauthenticated
```

### ✅ เสร็จ!
```bash
# ดู Service URL
gcloud run services describe carelink-web-client \
  --region $REGION \
  --format 'value(status.url)'

# Test health endpoint
curl https://carelink-web-client-xxxxx.run.app/health
```

---

## ใช้ Deploy Script (1 command)

```bash
# Export environment variables
export GCP_PROJECT_ID=your-gcp-project-id
export GCP_REGION=asia-southeast1

# One-command deploy
bash deploy-gcp.sh production deploy

# Or step by step
bash deploy-gcp.sh production build      # Build image
bash deploy-gcp.sh production push       # Push to registry
bash deploy-gcp.sh production deploy     # Deploy to Cloud Run
```

---

## Docker Compose - ทดสอบ Local

```bash
# Production build (GCP-like)
docker-compose -f docker-compose.gcp.yml up web-client-prod

# Development build (hot reload)
docker-compose -f docker-compose.gcp.yml --profile dev up web-client-dev

# Health check
curl http://localhost:8080/health
```

---

## Configuration

### Environment Variables
```bash
# Development (.env)
REACT_APP_API_URL=http://localhost:1337

# Production (.env.production)
REACT_APP_API_URL=https://carelink-strapi-xxxxx.run.app

# Cloud Run (update dynamically)
gcloud run services update carelink-web-client \
  --set-env-vars "REACT_APP_API_URL=https://your-api.run.app" \
  --region asia-southeast1
```

### Resource Settings (Production)
```bash
# Update memory/CPU
gcloud run services update carelink-web-client \
  --memory 1Gi \
  --cpu 2 \
  --max-instances 100 \
  --region asia-southeast1
```

---

## Useful Commands

| Command | Purpose |
|---------|---------|
| `docker build -f Dockerfile.gcp .` | Build image locally |
| `docker run -p 8080:8080 IMAGE` | Test image locally |
| `docker push gcr.io/$PROJECT_ID/web-client` | Push to registry |
| `gcloud run deploy carelink-web-client --image IMAGE` | Deploy to Cloud Run |
| `gcloud run services list --platform managed` | List all services |
| `gcloud logging read "resource.type=cloud_run_revision"` | View logs |
| `gcloud run services describe carelink-web-client` | Service details |
| `gcloud run revisions list --service carelink-web-client` | View revisions |
| `bash deploy-gcp.sh production rollback` | Rollback to previous version |
| `curl https://SERVICE_URL/health` | Health check |

---

## Ports

```
Development: 3000  (React dev server)
Production: 8080   (Nginx, GCP Cloud Run)
```

---

## Security

✅ **Nginx headers**: CSP, X-Frame-Options, X-XSS-Protection  
✅ **Rate limiting**: 30 req/s per IP  
✅ **Non-root user**: app runs as appuser  
✅ **HTTPS ready**: All traffic to GCP is HTTPS  
✅ **Health check**: `/health` endpoint  

---

## Performance

✅ **Gzip compression**: Enabled  
✅ **Static asset caching**: 1 year  
✅ **HTML caching**: No cache  
✅ **Min instances**: 1 (avoid cold start)  
✅ **Concurrency**: 80 per instance  

---

## Troubleshooting

```bash
# Image build failed?
docker build -f Dockerfile.gcp --no-cache .

# Push failed?
gcloud auth configure-docker gcr.io

# Service not starting?
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Cold start slow?
gcloud run services update carelink-web-client --min-instances 1

# Health check failing?
curl -v https://SERVICE_URL/health
```

---

## Next Steps

1. ✅ ตั้งค่า `.env.production` ให้ API URL ถูกต้อง
2. ✅ ทำการ Build & Deploy ขั้นแรก
3. ✅ ทดสอบ health endpoint
4. ✅ ดู logs ใน Cloud Logging
5. ✅ ตั้งค่า CI/CD (GitHub Actions)

---

## Documentation Files

📖 **GCP_DEPLOYMENT_GUIDE.md** - Full detailed guide  
📖 **DEPLOYMENT_FILES_SUMMARY.md** - All files explanation  
📖 **GCP_DEPLOYMENT_QUICK_REF.md** - This file  

---

**Ready to deploy? Let's go! 🚀**

สำหรับช่วยเหลือเพิ่มเติม ดูไฟล์ documentation
