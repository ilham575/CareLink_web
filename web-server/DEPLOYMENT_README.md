# GCP Deployment Files - CareLink Strapi Backend

## 📁 Files Created

### 1. **Dockerfile.gcp** 
Production-optimized Dockerfile สำหรับ GCP
- Multi-stage build เพื่อลดขนาด image
- Non-root user สำหรับ security
- Health check included
- Optimized dependencies

### 2. **docker-compose.gcp.yml**
Docker Compose สำหรับ local testing ก่อน deploy
- PostgreSQL 16 (Alpine - lightweight)
- Strapi production build
- Volume management
- Network configuration

### 3. **.env.gcp.example**
Template environment variables
- Database configuration
- Strapi security keys
- GCP integration options
- Copy เป็น `.env.gcp` แล้วแก้ไข

### 4. **cloudbuild.yaml**
Google Cloud Build configuration
- Automated build & push to GCR
- Deploy to Cloud Run
- Substitutions สำหรับตัวแปร
- Image versioning

### 5. **GCP_DEPLOYMENT_GUIDE.md**
Comprehensive deployment guide
- Prerequisites setup
- Cloud SQL configuration
- Local testing steps
- Deployment options (Cloud Run / GKE)
- Monitoring & logs
- Troubleshooting

### 6. **deploy-gcp.sh**
Automated deployment script
- Checks prerequisites
- Builds Docker image
- Pushes to GCR
- Deploys to Cloud Run

### 7. **k8s-deployment.yaml**
Kubernetes manifests (สำหรับ GKE)
- Deployment configuration
- Service LoadBalancer
- PersistentVolumeClaim
- HorizontalPodAutoscaler
- ServiceAccount

### 8. **.gcloudignore**
Files to exclude from Cloud Build

---

## 🚀 Quick Start - Deploy to GCP

### Step 1: Prerequisites
```bash
# Install GCP CLI
# https://cloud.google.com/sdk/docs/install

# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com sql.googleapis.com
```

### Step 2: Configure Environment
```bash
# Create .env.gcp
cp .env.gcp.example .env.gcp

# Edit with your values
nano .env.gcp
```

### Step 3: Local Test (Optional)
```bash
# Build and test locally
docker-compose -f docker-compose.gcp.yml build
docker-compose -f docker-compose.gcp.yml up

# Test: http://localhost:1337/admin
# Stop: Ctrl+C
docker-compose -f docker-compose.gcp.yml down
```

### Step 4: Deploy to Cloud Run
```bash
# Option A: Using script (recommended)
chmod +x deploy-gcp.sh
./deploy-gcp.sh

# Option B: Manual commands
gcloud builds submit --config=cloudbuild.yaml
```

### Step 5: Access Service
```bash
# Get service URL
gcloud run services describe carelink-strapi --region asia-southeast1

# Open in browser
# https://carelink-strapi-xxxxx.run.app/admin
```

---

## 📋 Important Configuration Values

### Generate Strong Secrets
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"

# Add to .env.gcp:
ADMIN_JWT_SECRET=generated-value
JWT_SECRET=generated-value
API_TOKEN_SALT=generated-value
TRANSFER_TOKEN_SALT=generated-value
```

### Database Setup (Cloud SQL)
```bash
# Create PostgreSQL instance
gcloud sql instances create carelink-db \
  --database-version=POSTGRES_16 \
  --region=asia-southeast1 \
  --tier=db-f1-micro

# Get IP address
gcloud sql instances describe carelink-db --format='value(ipAddresses[0].ipAddress)'

# Update in .env.gcp:
DATABASE_HOST=<retrieved-ip>
DATABASE_PASSWORD=<your-strong-password>
```

---

## 🔍 Monitoring & Logs

```bash
# View real-time logs
gcloud run services logs read carelink-strapi --limit 50 --follow

# View service metrics
gcloud run services describe carelink-strapi

# SSH to Cloud Run (if needed)
gcloud run services update carelink-strapi --region asia-southeast1 --no-gen2
```

---

## 📊 Cost Estimation

### Cloud Run (asia-southeast1)
- Always Free: 2,000,000 requests/month
- Memory: $0.00001667/GB-second
- Estimated: $5-20/month

### Cloud SQL (db-f1-micro)
- Database: ~$3-5/month
- Storage: ~$1-2/month

**Total: ~$9-27/month** (minimal usage)

---

## 🛡️ Security Notes

1. ✅ Non-root Docker user
2. ✅ Health checks configured
3. ✅ Secrets in environment variables
4. ✅ Database password protected
5. ⚠️ Use Cloud SQL Auth proxy for production
6. ⚠️ Enable Cloud Armor for DDoS protection
7. ⚠️ Set up custom domain with HTTPS

---

## 📚 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Guide](https://cloud.google.com/sql/docs)
- [Strapi Deployment](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/deployment.html)
- [Cloud Build](https://cloud.google.com/build/docs)

---

## 🆘 Troubleshooting

### Issue: "Database connection failed"
```bash
# Check Cloud SQL instance is running
gcloud sql instances list

# Verify network connectivity
gcloud sql connect carelink-db --user=postgres
```

### Issue: "Build failed"
```bash
# View full build logs
gcloud builds log <BUILD_ID> --stream

# Check Dockerfile syntax
docker build -f Dockerfile.gcp --dry-run .
```

### Issue: "Service timeout"
```bash
# Increase timeout in Cloud Run
gcloud run services update carelink-strapi --timeout=3600
```

---

## 📞 Support

For issues or questions:
1. Check GCP_DEPLOYMENT_GUIDE.md
2. Review GCP Console logs
3. Run: `gcloud run services logs read carelink-strapi --limit 100`
