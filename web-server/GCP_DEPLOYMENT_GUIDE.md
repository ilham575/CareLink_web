# GCP Deployment Guide - CareLink Strapi Backend

## 📋 Prerequisites

### 1. Google Cloud Project Setup
```bash
# Set project ID
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sql.googleapis.com
gcloud services enable container.googleapis.com
gcloud services enable cloudkms.googleapis.com
```

### 2. Create Cloud SQL Instance (PostgreSQL)
```bash
# Create PostgreSQL instance
gcloud sql instances create carelink-db \
  --database-version=POSTGRES_16 \
  --region=asia-southeast1 \
  --tier=db-f1-micro \
  --storage-type=SSD \
  --storage-size=20GB \
  --backup-start-time=03:00 \
  --enable-bin-log

# Create database
gcloud sql databases create carelink_db \
  --instance=carelink-db

# Create user
gcloud sql users create postgres \
  --instance=carelink-db \
  --password=YOUR_STRONG_PASSWORD

# Get instance IP
gcloud sql instances describe carelink-db --format='value(ipAddresses[0].ipAddress)'
```

### 3. Enable Cloud SQL Auth for Cloud Run
```bash
# Create Cloud SQL Proxy service account
gcloud iam service-accounts create cloudsql-proxy \
  --display-name="Cloud SQL Proxy"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:cloudsql-proxy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/cloudsql.client
```

## 🐳 Local Testing (Before Deploy)

```bash
# 1. Create .env.gcp file
cp .env.gcp.example .env.gcp

# 2. Edit environment variables
# - Update DATABASE_PASSWORD
# - Update JWT secrets (generate strong random keys)
nano .env.gcp

# 3. Build and test locally
docker-compose -f docker-compose.gcp.yml build

# 4. Start services
docker-compose -f docker-compose.gcp.yml up

# 5. Test Strapi
curl http://localhost:1337/admin

# 6. Stop services
docker-compose -f docker-compose.gcp.yml down
```

## 🚀 Deploy to GCP Cloud Run

### Option A: Using Cloud Build (Recommended)

```bash
# 1. Update cloudbuild.yaml substitutions
# Edit: _DATABASE_HOST, _STRAPI_URL, and secrets

# 2. Create secrets in Secret Manager
gcloud secrets create admin-jwt-secret \
  --data-file=- <<< "$(openssl rand -base64 32)"

gcloud secrets create jwt-secret \
  --data-file=- <<< "$(openssl rand -base64 32)"

gcloud secrets create api-token-salt \
  --data-file=- <<< "$(openssl rand -base64 32)"

gcloud secrets create transfer-token-salt \
  --data-file=- <<< "$(openssl rand -base64 32)"

# 3. Grant Cloud Build access to secrets
PROJECT_NUMBER=$(gcloud projects list --filter="project_id=$PROJECT_ID" --format='value(project_number)')

gcloud secrets add-iam-policy-binding admin-jwt-secret \
  --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Repeat for other secrets...

# 4. Submit build
gcloud builds submit --config=cloudbuild.yaml

# 5. Monitor build
gcloud builds log <BUILD_ID> --stream
```

### Option B: Manual Docker Push

```bash
# 1. Build image
docker build -t gcr.io/$PROJECT_ID/carelink-strapi:latest -f Dockerfile.gcp .

# 2. Configure Docker authentication
gcloud auth configure-docker

# 3. Push to Container Registry
docker push gcr.io/$PROJECT_ID/carelink-strapi:latest

# 4. Deploy to Cloud Run
gcloud run deploy carelink-strapi \
  --image gcr.io/$PROJECT_ID/carelink-strapi:latest \
  --platform managed \
  --region asia-southeast1 \
  --port 1337 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DATABASE_CLIENT=postgres,DATABASE_HOST=CLOUD_SQL_PROXY_IP,DATABASE_PORT=5432,DATABASE_NAME=carelink_db,DATABASE_USERNAME=postgres,DATABASE_PASSWORD=YOUR_PASSWORD" \
  --service-account=carelink-strapi@$PROJECT_ID.iam.gserviceaccount.com

# 5. Get service URL
gcloud run services describe carelink-strapi --platform managed --region asia-southeast1
```

## 🔐 Database Connection Options

### Option 1: Cloud SQL Proxy (Recommended)
```bash
# Install Cloud SQL Proxy
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud_sql_proxy

# Connect from Cloud Run (automatic through service account)
# No additional setup needed - Cloud Run handles it
```

### Option 2: Public IP with Firewall Rules
```bash
# Enable public IP on Cloud SQL instance
gcloud sql instances patch carelink-db --assign-ip

# Add Cloud Run to authorized networks
gcloud sql instances patch carelink-db \
  --authorized-networks=CLOUD_RUN_OUTBOUND_IP/32
```

## 📊 Monitoring & Logs

```bash
# View Cloud Run logs
gcloud run services describe carelink-strapi --platform managed --region asia-southeast1

# Stream logs
gcloud run services logs read carelink-strapi --limit 50 --follow --platform managed --region asia-southeast1

# View Cloud Build logs
gcloud builds log <BUILD_ID> --stream

# View Cloud SQL logs
gcloud sql operations list --instance=carelink-db
```

## 🔄 Database Migrations

```bash
# SSH into Cloud Run container (if needed)
gcloud run services update carelink-strapi \
  --update-env-vars "DEBUG=*" \
  --region asia-southeast1

# Or use Cloud SQL Studio
gcloud sql connect carelink-db --user=postgres
```

## 🛡️ Security Best Practices

1. **Use Secret Manager for sensitive data:**
```bash
gcloud secrets create db-password --data-file=- <<< "YOUR_PASSWORD"
```

2. **Restrict Cloud Run access:**
```bash
gcloud run services add-iam-policy-binding carelink-strapi \
  --region asia-southeast1 \
  --member=serviceAccount:web-client@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.invoker
```

3. **Enable Cloud SQL Auth proxy:**
```bash
# In Cloud Run environment variables
CLOUD_SQL_INSTANCES=PROJECT_ID:asia-southeast1:carelink-db
```

4. **Use custom domain with Cloud Armor:**
```bash
# Set up Cloud Armor policy for DDoS protection
# Configure custom domain in Cloud Run
```

## 📈 Scaling Configuration

```bash
# Update Cloud Run service with auto-scaling
gcloud run services update carelink-strapi \
  --min-instances=1 \
  --max-instances=10 \
  --region asia-southeast1
```

## 🧹 Cleanup

```bash
# Delete Cloud Run service
gcloud run services delete carelink-strapi --region asia-southeast1

# Delete Cloud SQL instance
gcloud sql instances delete carelink-db

# Delete container images
gcloud container images delete gcr.io/$PROJECT_ID/carelink-strapi
```

## 📝 Troubleshooting

### Connection Error: "Cannot connect to database"
- Check Cloud SQL instance is running: `gcloud sql instances list`
- Verify network connectivity: `gcloud sql operations list --instance=carelink-db`
- Check service account has Cloud SQL Client role

### Build Failures
- Check build logs: `gcloud builds log <BUILD_ID>`
- Verify Docker file exists: `ls Dockerfile.gcp`
- Check build cache: `gcloud builds log <BUILD_ID> --stream`

### Performance Issues
- Monitor Cloud Run metrics in Cloud Console
- Check database query logs
- Consider upgrading Cloud SQL tier
- Enable query caching in Strapi

## 📞 Support

For more information:
- [GCP Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GCP Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Strapi Deployment Guide](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/deployment.html)
