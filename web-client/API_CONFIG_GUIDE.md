# API Configuration Guide

## 📋 Overview

ระบบ API configuration ที่ **centralized** เพื่อให้ไม่ต้องแก้ไข hardcoded URLs ทั่วไฟล์

### Problem (เดิม)
- ❌ hardcoded `http://localhost:1337` กระจายอยู่ 30+ ที่
- ❌ เมื่อเปลี่ยน URL ต้องแก้ทั่วไฟล์
- ❌ ยากต่อ maintenance และเสี่ยง human error

### Solution (ใหม่)
- ✅ API endpoints รวมไว้ 1 ที่ (`utils/apiConfig.js`)
- ✅ เปลี่ยน URL ครั้งเดียว ใน `.env` file
- ✅ ใช้ `REACT_APP_API_URL` environment variable
- ✅ ลดความซ้ำซ้อน, เพิ่ม maintainability

---

## 🚀 Setup

### Step 1: Environment Variables

#### Development (Local)
```bash
# .env (development)
REACT_APP_API_URL=http://localhost:1337
```

#### Production (GCP)
```bash
# .env.production
REACT_APP_API_URL=https://carelink-strapi-xxxxx.run.app
```

### Step 2: Install & Run

```bash
# npm reads .env automatically
npm start

# For production build
npm run build

# Build detects .env.production automatically
```

---

## 📚 Usage Examples

### Example 1: Sign In (Authentication)
**Before:**
```javascript
const response = await fetch('http://localhost:1337/api/auth/local', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

**After:**
```javascript
import { API, fetchWithAuth } from '@/utils/apiConfig';

const response = await fetch(API.auth.login, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

### Example 2: Get Drugs by Store
**Before:**
```javascript
fetch(`http://localhost:1337/api/drugs?filters[drug_store][documentId][$eq]=${pharmacyId}&populate[0]=drug_batches&populate[1]=drug_store`)
```

**After:**
```javascript
import { API, fetchWithAuth } from '@/utils/apiConfig';

const drugs = await fetchWithAuth(API.drugs.listByStore(pharmacyId));
```

### Example 3: Get Customer Details
**Before:**
```javascript
fetch(`http://localhost:1337/api/customer-profiles/${customerId}?populate[0]=users_permissions_user&populate[1]=drug_stores&populate[2]=assigned_by_staff.users_permissions_user`, {
  headers: { Authorization: `Bearer ${token}` }
})
```

**After:**
```javascript
import { API, fetchWithAuth } from '@/utils/apiConfig';

const customer = await fetchWithAuth(API.customerProfiles.getById(customerId));
```

### Example 4: Get Image URL
**Before:**
```javascript
const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${imagePath}`;
```

**After:**
```javascript
import { API } from '@/utils/apiConfig';

const imageUrl = API.getImageUrl(imagePath);
```

### Example 5: Update Notification
**Before:**
```javascript
fetch(`http://localhost:1337/api/notifications/${notificationId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ data: updatedStatus })
})
```

**After:**
```javascript
import { API, fetchWithAuth } from '@/utils/apiConfig';

await fetchWithAuth(API.notifications.update(notificationId), {
  method: 'PUT',
  body: JSON.stringify({ data: updatedStatus })
});
```

---

## 📖 Available API Endpoints

### Authentication
- `API.auth.login`
- `API.auth.register`
- `API.auth.forgotPassword`
- `API.auth.resetPassword`

### Users
- `API.users.getById(id)`
- `API.users.list()`
- `API.users.create()`
- `API.users.update(id)`
- `API.users.delete(id)`

### Drug Stores
- `API.drugStores.list()`
- `API.drugStores.listWithPhotos()`
- `API.drugStores.getById(id)`
- `API.drugStores.getByDocumentId(documentId)`

### Drugs
- `API.drugs.list()`
- `API.drugs.listByStore(storeDocumentId)`
- `API.drugs.getById(id)`
- `API.drugs.create()`
- `API.drugs.update(id)`

### Drug Batches (Lots)
- `API.drugBatches.list()`
- `API.drugBatches.getById(id)`
- `API.drugBatches.update(id)`
- `API.drugBatches.delete(id)`

### Customer Profiles
- `API.customerProfiles.list()`
- `API.customerProfiles.getById(id)`
- `API.customerProfiles.getByDocumentId(documentId)`
- `API.customerProfiles.update(id)`

### Staff Profiles
- `API.staffProfiles.list()`
- `API.staffProfiles.getByUserAndStore(userDocumentId, storeDocumentId)`

### Notifications
- `API.notifications.list()`
- `API.notifications.getById(id)`
- `API.notifications.getStaffAssignments(staffId, customerId)`
- `API.notifications.update(id)`

### Helpers
- `API.getImageUrl(imagePath)` - Convert image path to full URL

---

## 🔧 Helper Functions

### fetchWithAuth()
Automatically adds JWT token to headers

```javascript
import { fetchWithAuth } from '@/utils/apiConfig';

const data = await fetchWithAuth(API.drugs.list());
```

### buildFilterQuery()
Build query string from filter object

```javascript
import { buildFilterQuery } from '@/utils/apiConfig';

const filters = { status: 'active', limit: 10 };
const query = buildFilterQuery(filters);
// Result: "status=active&limit=10"

const url = API.drugs.list(query);
```

### buildPopulateQuery()
Build populate query string

```javascript
import { buildPopulateQuery } from '@/utils/apiConfig';

const fields = ['drug_batches', 'drug_store'];
const query = buildPopulateQuery(fields);
// Result: "populate[0]=drug_batches&populate[1]=drug_store"
```

---

## 🔄 Switching Environments

### For Local Development
```bash
# npm automatically uses .env
npm start
# Uses: http://localhost:1337
```

### For Production Build (GCP)
```bash
# npm automatically uses .env.production
npm run build
# Uses: https://carelink-strapi-xxxxx.run.app
```

### For Staging/Custom Environment
```bash
# Create .env.staging
REACT_APP_API_URL=https://staging-api.example.com

# Build with specific env
REACT_APP_API_URL=https://staging-api.example.com npm run build
```

---

## ✅ Checklist for Deployment

- [ ] Update `.env.production` with GCP Cloud Run URL
- [ ] Verify API endpoints are accessible
- [ ] Test image URLs load correctly
- [ ] Run `npm run build` and verify no errors
- [ ] Test in production environment

---

## 📝 Migration Guide (if needed)

To migrate existing code to use apiConfig:

1. **Import API config**
   ```javascript
   import { API, fetchWithAuth } from '@/utils/apiConfig';
   ```

2. **Replace hardcoded URLs**
   ```javascript
   // Old
   fetch('http://localhost:1337/api/drugs/...')
   
   // New
   fetch(API.drugs.getById(id))
   ```

3. **Use fetchWithAuth for authenticated requests**
   ```javascript
   // Old
   fetch(url, { headers: { Authorization: `Bearer ${token}` } })
   
   // New
   fetchWithAuth(url)
   ```

---

## 🐛 Troubleshooting

### Issue: API endpoints not loading
- [ ] Check `.env` file exists
- [ ] Verify `REACT_APP_API_URL` is set correctly
- [ ] Restart `npm start` after changing .env
- [ ] Check browser console for errors

### Issue: Image URLs showing broken
- [ ] Use `API.getImageUrl(path)` instead of manual concatenation
- [ ] Verify `.env.production` has correct base URL

### Issue: Build uses wrong API URL
- [ ] Ensure correct `.env.*` file for target environment
- [ ] Check environment variables in build logs
- [ ] Verify no hardcoded URLs remain in code

---

## 📞 Support

For questions or issues:
1. Check the Examples section above
2. Review `utils/apiConfig.js` for available endpoints
3. Check browser DevTools Network tab for API responses
