# Automatic Migration Guide: Replace Hardcoded URLs

## 📋 Status: Partial Automation

### ✅ Completed
- `signin.js` - ✅ Already migrated manually to use `API.auth.login`
- `apiConfig.js` - ✅ Created with all endpoints

### ⚠️ Manual Migration Required
Due to complexity of different URL patterns, the remaining files need careful manual updates to maintain functionality.

---

## 🛠️ Manual Migration Steps

### Step 1: Add Import to Each File

In **every** `.js` file that uses `fetch()`, add at the top:

```javascript
import { API, fetchWithAuth } from '../../../utils/apiConfig';
// Adjust path based on file location
// For example: ../../utils/apiConfig (from pages folder)
```

### Step 2: Replace Fetch Calls

Use the patterns below for each file:

---

## 📝 File-by-File Migration Guide

### `src/js/pages/default/home.js`

**Before:**
```javascript
fetch('http://localhost:1337/api/drug-stores?' + filterParams)
fetch('http://localhost:1337/api/pharmacy-profiles?populate=users_permissions_user')
```

**After:**
```javascript
import { API } from '../../../utils/apiConfig';

// For listing drug stores
fetch(API.drugStores.list(filterParams))

// For listing pharmacies
fetch(API.pharmacyProfiles.list())
```

---

### `src/js/pages/default/DrugStoreDetail.js`

**Before:**
```javascript
fetch(`http://localhost:1337/api/drug-stores/${id}?populate=pharmacy_profiles,photo_front,photo_in,photo_staff`)
fetch('http://localhost:1337/api/pharmacy-profiles?populate=users_permissions_user')
```

**After:**
```javascript
import { API } from '../../../utils/apiConfig';

fetch(API.drugStores.getById(id))
fetch(API.pharmacyProfiles.list())

// For image URLs
<img src={API.getImageUrl(imageUrl)} />
```

---

### `src/js/pages/pharmacy/DrugList.js`

**Before:**
```javascript
fetch(`http://localhost:1337/api/drugs?populate[0]=drug_batches&populate[1]=drug_store`)
fetch('http://localhost:1337/api/drug-batches', { method: 'POST', ... })
fetch(`http://localhost:1337/api/drug-batches/${batchId}`, { method: 'PUT', ... })
```

**After:**
```javascript
import { API, fetchWithAuth } from '../../../utils/apiConfig';

// List drugs with batches
const drugs = await fetchWithAuth(API.drugs.listByStore(storeDocumentId))

// Create batch
await fetchWithAuth(API.drugBatches.create(), {
  method: 'POST',
  body: JSON.stringify(batchData)
})

// Update batch
await fetchWithAuth(API.drugBatches.update(batchId), {
  method: 'PUT',
  body: JSON.stringify(updatedData)
})
```

---

### `src/js/pages/pharmacy/detail_customer.js`

**Before:**
```javascript
fetch(`http://localhost:1337/api/customer-profiles/${customerDocumentId}?populate[0]=...&populate[1]=...`)
fetch(`http://localhost:1337/api/staff-profiles?filters[...]`)
fetch(`http://localhost:1337/api/notifications`, { method: 'POST', ... })
```

**After:**
```javascript
import { API, fetchWithAuth } from '../../../utils/apiConfig';

// Get customer
const customer = await fetchWithAuth(API.customerProfiles.getById(customerDocumentId))

// Get staff profiles
const staff = await fetchWithAuth(API.staffProfiles.getByUserAndStore(userDocumentId, storeDocumentId))

// Create notification
await fetchWithAuth(API.notifications.create(), {
  method: 'POST',
  body: JSON.stringify(notificationData)
})

// Update notification
await fetchWithAuth(API.notifications.update(notificationId), {
  method: 'PUT',
  body: JSON.stringify(updatedStatus)
})
```

---

### `src/js/pages/staff/CustomerDetail_staff.js`

**Before:**
```javascript
fetch(`http://localhost:1337/api/staff-profiles?filters[...]`)
fetch(`http://localhost:1337/api/notifications/${notifId}?populate=*`)
fetch(`http://localhost:1337/api/drug-batches/${batchId}`)
```

**After:**
```javascript
import { API, fetchWithAuth } from '../../../utils/apiConfig';

// Get staff profile
const staff = await fetchWithAuth(API.staffProfiles.getByUserAndStore(userDocumentId, storeDocumentId))

// Get notification
const notif = await fetchWithAuth(API.notifications.getById(notifId))

// Update batch quantity
await fetchWithAuth(API.drugBatches.update(batchId), {
  method: 'PUT',
  body: JSON.stringify({ data: { quantity: newQuantity } })
})
```

---

### `src/js/pages/admin/AddPharmacy_admin.js`

**Before:**
```javascript
fetch('http://localhost:1337/api/pharmacy-profiles?populate=*')
fetch(`http://localhost:1337/api/drug-stores/${storeId}`)
fetch('http://localhost:1337/api/auth/local/register', { method: 'POST', ... })
```

**After:**
```javascript
import { API, fetchWithAuth } from '../../../utils/apiConfig';

// Get pharmacies
const pharmacies = await fetchWithAuth(API.pharmacyProfiles.listAll())

// Get store
const store = await fetchWithAuth(API.drugStores.getById(storeId))

// Register user
const register = await fetch(API.auth.register, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(userData)
})
```

---

### `src/js/components/HomeHeader.js`

**Before:**
```javascript
fetch('http://localhost:1337/api/users/me', { headers: { Authorization: ... } })
fetch(`http://localhost:1337/api/admin-profiles?filters[...]`)
fetch(`http://localhost:1337/api/pharmacy-profiles?filters[...]`)

// Image URL
`${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${img}`
```

**After:**
```javascript
import { API, fetchWithAuth } from '../../../utils/apiConfig';

// Get current user
const currentUser = await fetchWithAuth(API.users.list())

// Get admin profile
const adminProfile = await fetchWithAuth(API.adminProfiles.getByDocumentId(documentId))

// Get pharmacy profile
const pharmacy = await fetchWithAuth(API.pharmacyProfiles.getByDocumentId(documentId))

// Image URL
<img src={API.getImageUrl(img)} />
```

---

## 📋 Common Patterns

### Pattern 1: Simple Fetch
```javascript
// Old
fetch('http://localhost:1337/api/endpoint')

// New
fetch(API.module.endpoint)
```

### Pattern 2: Fetch with Parameters
```javascript
// Old
fetch(`http://localhost:1337/api/endpoint/${id}`)

// New
fetch(API.module.getById(id))
```

### Pattern 3: Authenticated Fetch
```javascript
// Old
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})

// New
fetchWithAuth(url, {
  headers: { 'Content-Type': 'application/json' }
})
```

### Pattern 4: POST/PUT/DELETE
```javascript
// Old
fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})

// New
fetchWithAuth(API.module.create(), {
  method: 'POST',
  body: JSON.stringify(data)
})
```

### Pattern 5: Image URLs
```javascript
// Old
const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${path}`;

// New
const imageUrl = API.getImageUrl(path);
```

---

## 🚀 Migration Checklist

- [ ] Add `import { API, fetchWithAuth } from '@/utils/apiConfig'` to each file
- [ ] Replace all hardcoded `http://localhost:1337/api/...` URLs
- [ ] Replace `fetch()` with `fetchWithAuth()` for authenticated requests
- [ ] Replace image URL concatenation with `API.getImageUrl()`
- [ ] Test each page to verify APIs work
- [ ] Run `npm start` and verify no console errors
- [ ] Test with `.env.production` (GCP URL)

---

## 🐛 Troubleshooting

### Error: "API is not defined"
- [ ] Verify import statement is at top of file
- [ ] Check correct path to `apiConfig.js`
- [ ] Restart `npm start`

### Error: "fetchWithAuth is not a function"
- [ ] Import both `API` and `fetchWithAuth`
- [ ] Verify you're using it for authenticated requests only

### Image URLs still broken
- [ ] Use `API.getImageUrl(path)` instead of string concatenation
- [ ] Verify `.env` has correct `REACT_APP_API_URL`

---

## 📞 Support

For help:
1. Check examples above for your use case
2. Review `utils/apiConfig.js` for available methods
3. Check browser console for errors
4. Refer to `API_CONFIG_GUIDE.md`
