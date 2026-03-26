# Deploy Scripts - GCP Focused (Firebase + Cloud Run)

## Goal: Keep your local machine FAST
- **Cloud Build** compiles React / builds Docker images on GCP (not your machine)
- **Firebase Hosting** serves static client
- **Cloud Run** runs Strapi backend
- Local machine: just submits code and waits

---

## Setup (One-time)

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

firebase login
firebase use YOUR_GCP_PROJECT_ID

# Enable APIs (required)
gcloud services enable cloudbuild.googleapis.com run.googleapis.com firebasehosting.googleapis.com
```

---

## Quick Start

### PowerShell (Windows)

```powershell
# Deploy client to Firebase
powershell -File scripts\deploy_client.ps1

# Deploy server to Cloud Run
powershell -File scripts\deploy_server.ps1

# With specific project
powershell -File scripts\deploy_server.ps1 -ProjectId my-project -ServiceName api -Region us-central1
```

### Bash (Linux/macOS)

```bash
# Deploy client
./scripts/deploy_client.sh

# Deploy server
./scripts/deploy_server.sh

# With specific project and service name
./scripts/deploy_server.sh my-project api us-central1
```

---

## What Happens

### Client Deploy
1. Script sends code to `gcloud builds submit`
2. Cloud Build reads `web-client/cloudbuild-client.yaml`
3. GCP compiles React (`npm run build`) → stored in Cloud Storage
4. Firebase deploys built files to hosting
5. ✅ Your machine: idle, just waiting for logs

### Server Deploy
1. Script sends code to `gcloud builds submit`
2. Cloud Build reads `web-server/cloudbuild.yaml`
3. GCP builds Docker image → pushes to GCR
4. Cloud Run deploys image
5. ✅ Your machine: idle, just waiting for logs

---

## Configuration Files

### `web-client/cloudbuild-client.yaml` (must exist)
```yaml
steps:
  - name: 'gcr.io/cloud-builders/npm'
    args: ['ci']
  - name: 'gcr.io/cloud-builders/npm'
    args: ['run', 'build']
  # Firebase deploys via separate step
```

### `web-server/cloudbuild.yaml` (must exist)
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/carelink-server', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/carelink-server']
```

### `web-client/firebase.json`
```json
{
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  }
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `gcloud: command not found` | Install Google Cloud SDK |
| `Authentication required` | Run `gcloud auth login` |
| `Project not set` | Run `gcloud config set project YOUR_PROJECT_ID` |
| `Cloud Build fails` | Check `cloudbuild.yaml` syntax, APIs enabled |
| `Firebase permission denied` | Run `firebase use YOUR_PROJECT_ID` |
| `Cloud Run deployment timeout` | Increase Cloud Build timeout in `cloudbuild.yaml` |

---

## Monitoring

```bash
# View Cloud Build history
gcloud builds list --limit=10 --project=YOUR_PROJECT_ID

# View specific build logs
gcloud builds log BUILD_ID --project=YOUR_PROJECT_ID

# View Cloud Run service status
gcloud run services describe carelink-server --platform managed --region asia-southeast1

# Stream Cloud Run logs (live)
gcloud run logs read carelink-server --platform managed --region asia-southeast1 --limit 50 --follow

# Check Firebase deployment status
firebase hosting:channel:list
```

---

---

## Why Cloud Build?

| Factor | Cloud Build |
|--------|------------|
| Speed | 100s of builds/month |
| CPU Load | 0% on your machine |
| Network | Optimal GCP infrastructure |
| Free Tier | 120 min/day (usually enough) |
| Cost | Minimal for small teams |

Cloud Build keeps your machine free for other work.
