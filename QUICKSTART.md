# CareLink - Quick Deployment Reference

## 🚀 Quick Start (30 minutes)

### 1️⃣ One-time Setup
```powershell
# Run setup script
cd e:\web_CareLink
.\setup.ps1
```

### 2️⃣ Deploy Server (Strapi → Cloud Run)
```powershell
cd e:\web_CareLink\web-server
.\deploy.ps1
```

### 3️⃣ Deploy Client (React → Firebase Hosting)
```powershell
cd e:\web_CareLink\web-client
.\deploy.ps1 -ServerUrl "https://your-server-url.run.app"
```

---

## 📋 Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `firebase.json` | web-client/ | Firebase Hosting config |
| `.firebaserc` | web-client/ | Firebase project link |
| `.env.cloudrun` | web-server/ | Server environment variables |
| `Dockerfile.cloudrun` | web-server/ | Cloud Run container image |

---

## 💰 Cost Breakdown (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Firebase Hosting | Free tier | **$0** |
| Cloud Run | Free tier (2M requests) | **$0-2** |
| Cloud SQL (db-f1-micro) | Smallest instance | **~$15** |
| **Total** | | **~$15-17/month** |

✅ Much cheaper than Compute Engine VM ($20-50/month)

---

## 🔧 Common Commands

### Server (Cloud Run)
```powershell
cd web-server

# Deploy
.\deploy.ps1

# View logs
.\deploy.ps1 -Action logs

# Get URL
.\deploy.ps1 -Action info

# Delete
.\deploy.ps1 -Action delete
```

### Client (Firebase)
```powershell
cd web-client

# Deploy
.\deploy.ps1 -ServerUrl "https://..."

# View URL
firebase hosting:site:get

# Rollback
firebase hosting:rollback
```

### Database (Cloud SQL)
```powershell
# Connect via proxy
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432

# Or SSH directly
gcloud sql connect carelink-db --user=postgres
```

---

## 🐛 Troubleshooting

### ❌ Docker build fails
```powershell
# Clear cache and retry
docker system prune -a
.\deploy.ps1
```

### ❌ Cloud Run deployment fails
```powershell
# Check logs
gcloud run services logs read carelink-server --limit=100

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### ❌ Client can't connect to server
1. Check CORS in Strapi (config/middlewares.js)
2. Verify REACT_APP_API_URL in .env.production
3. Check SOCKET_ALLOWED_ORIGINS=* in server .env.cloudrun

### ❌ Database connection error
1. Verify Cloud SQL connection name
2. Check database credentials
3. Ensure Cloud SQL instance is running

---

## 📱 Access URLs

After deployment:
- **Client**: https://PROJECT_ID.web.app
- **Server**: https://carelink-server-xxxxx.run.app
- **Admin**: https://carelink-server-xxxxx.run.app/admin

---

## 🔐 Security Checklist

- ✅ Never commit `.env.cloudrun`
- ✅ Use strong database passwords
- ✅ Enable Cloud SQL automatic backups
- ✅ Review Cloud Run IAM permissions
- ✅ Enable HTTPS only (default)
- ✅ Setup monitoring alerts

---

## 📊 Monitoring

```powershell
# Cloud Run metrics
gcloud run services describe carelink-server --region=asia-southeast1

# Database metrics
gcloud sql operations list --instance=carelink-db

# Firebase hosting stats
firebase hosting:channel:list
```

---

## 🔄 Update Workflow

### Update Server
```powershell
cd web-server
# Make code changes
.\deploy.ps1
```

### Update Client
```powershell
cd web-client
# Make code changes
npm run build
.\deploy.ps1 -ServerUrl "https://your-server.run.app"
```

---

## 💡 Tips

1. **Use Cloud Run** instead of VM - Pay only when traffic comes in
2. **Firebase Hosting** is free for most projects
3. **db-f1-micro** is cheapest SQL instance (~$15/month)
4. **Scale to zero** on Cloud Run = $0 when no traffic
5. **Monitor costs** in GCP Console > Billing

---

Need help? See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed guide.
