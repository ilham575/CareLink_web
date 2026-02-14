# CareLink - Firebase & Cloud Run Deployment Guide

## Architecture
- **Client (React)**: Firebase Hosting (ฟรี)
- **Server (Strapi)**: Cloud Run (pay-per-use)
- **Database**: Cloud SQL PostgreSQL

---

## Prerequisites

1. **Install Google Cloud SDK**
   ```powershell
   # Already installed, verify:
   gcloud --version
   ```

2. **Install Firebase CLI**
   ```powershell
   npm install -g firebase-tools
   ```

3. **Login**
   ```powershell
   gcloud auth login
   firebase login
   ```

4. **Set Project**
   ```powershell
   gcloud config set project carelink-web-485714
   firebase use carelink-web-485714
   ```

---

## Step 1: Setup Cloud SQL Database (One-time)

### Create Cloud SQL Instance
```powershell
gcloud sql instances create carelink-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=asia-southeast1 \
  --root-password=YOUR_STRONG_PASSWORD \
  --backup-start-time=03:00 \
  --enable-bin-log=false
```

### Create Database
```powershell
gcloud sql databases create carelink \
  --instance=carelink-db
```

### Get Connection Name
```powershell
gcloud sql instances describe carelink-db --format="value(connectionName)"
# Output: carelink-web-485714:asia-southeast1:carelink-db
```

---

## Step 2: Deploy Server (Strapi) to Cloud Run

### 2.1 Setup Environment Variables
```powershell
cd e:\web_CareLink\web-server
```

Create `.env.cloudrun` file:
```env
DATABASE_CLIENT=postgres
DATABASE_HOST=/cloudsql/carelink-web-485714:asia-southeast1:carelink-db
DATABASE_PORT=5432
DATABASE_NAME=carelink
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=YOUR_STRONG_PASSWORD
DATABASE_SSL=false

# Generate these with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
APP_KEYS=<generated-key>
API_TOKEN_SALT=<generated-salt>
ADMIN_JWT_SECRET=<generated-secret>
TRANSFER_TOKEN_SALT=<generated-salt>
JWT_SECRET=<generated-secret>

HOST=0.0.0.0
PORT=1337
NODE_ENV=production
STRAPI_URL=https://temp.run.app
PUBLIC_URL=https://temp.run.app
SOCKET_ALLOWED_ORIGINS=*
```

### 2.2 Generate Secrets
```powershell
# Run this 5 times to generate all secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2.3 Deploy
```powershell
.\deploy.ps1 -Action deploy
```

### 2.4 Update STRAPI_URL and Redeploy
After first deployment, get the Cloud Run URL and update `.env.cloudrun`:
```env
STRAPI_URL=https://carelink-server-xxxxx.run.app
PUBLIC_URL=https://carelink-server-xxxxx.run.app
STRAPI_ADMIN_BACKEND_URL=https://carelink-server-xxxxx.run.app
```

Then deploy again:
```powershell
.\deploy.ps1 -Action deploy
```

---

## Step 3: Deploy Client (React) to Firebase Hosting

### 3.1 Initialize Firebase (One-time)
```powershell
cd e:\web_CareLink\web-client
firebase init hosting
# Select: Use an existing project
# Choose: carelink-web-485714
# Public directory: build
# Single-page app: Yes
# GitHub Actions: No
```

### 3.2 Deploy
```powershell
# Replace with your actual Cloud Run URL
.\deploy.ps1 -ServerUrl "https://carelink-server-xxxxx.run.app"
```

---

## Cost Estimation (per month)

### Free Tier:
- ✅ Firebase Hosting: **FREE** (10GB storage, 360MB/day transfer)
- ✅ Cloud Run: **FREE** (2M requests, 360K GB-seconds)

### Paid:
- Cloud SQL (db-f1-micro): ~$15/month
- Cloud Run (if exceed free tier): ~$0.024 per 1M requests
- Network egress: ~$0.12/GB (after 1GB free)

**Total: ~$15-20/month** (mostly database)

---

## Management Commands

### Server (Cloud Run)
```powershell
cd e:\web_CareLink\web-server

# View logs
.\deploy.ps1 -Action logs

# Get info
.\deploy.ps1 -Action info

# Delete service
.\deploy.ps1 -Action delete
```

### Client (Firebase)
```powershell
cd e:\web_CareLink\web-client

# View hosting URL
firebase hosting:channel:list

# View logs
firebase hosting:channel:logs

# Rollback
firebase hosting:rollback
```

### Database (Cloud SQL)
```powershell
# Connect via proxy
cloud_sql_proxy -instances=carelink-web-485714:asia-southeast1:carelink-db=tcp:5432

# Or direct connection
gcloud sql connect carelink-db --user=postgres --database=carelink
```

---

## Troubleshooting

### Server not connecting to database
- Check Cloud SQL connection name in `.env.cloudrun`
- Verify Cloud SQL instance is running
- Check database credentials

### Client can't connect to server
- Verify REACT_APP_API_URL in `.env.production`
- Check CORS settings in Strapi
- Enable SOCKET_ALLOWED_ORIGINS=*

### Build fails
- Clear Docker cache: `docker system prune -a`
- Check Node version: Use Node 18
- Verify all dependencies installed

---

## URLs After Deployment

- **Client**: https://carelink-web-485714.web.app
- **Server**: https://carelink-server-xxxxx.run.app
- **Admin**: https://carelink-server-xxxxx.run.app/admin
- **Database**: Via Cloud SQL Proxy

---

## Security Notes

1. **Never commit `.env.cloudrun`** - Contains sensitive credentials
2. Use **Cloud Secret Manager** for production (optional)
3. Enable **Cloud Armor** for DDoS protection (optional)
4. Setup **Cloud SQL backup** regularly
5. Use **HTTPS only** - both Firebase and Cloud Run use HTTPS by default

---

## Updating Application

### Update Server
```powershell
cd e:\web_CareLink\web-server
# Make changes
.\deploy.ps1 -Action deploy
```

### Update Client
```powershell
cd e:\web_CareLink\web-client
# Make changes
.\deploy.ps1 -ServerUrl "https://carelink-server-xxxxx.run.app"
```

---

Good luck with your deployment! 🚀
