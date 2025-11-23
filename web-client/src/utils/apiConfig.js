/**
 * API Configuration - Centralized Endpoints
 * 
 * สำหรับเปลี่ยน API URL เพียงแค่แก้ไขตัวแปร BASE_URL เดียว
 * ไม่ต้องแก้ไขตามไฟล์ที่กระจายอยู่
 * 
 * Usage: 
 *   import { API } from '@/utils/apiConfig';
 *   fetch(API.auth.login)
 *   fetch(API.drugs.list(pharmacyId))
 */

// ============================================
// BASE URL Configuration
// ============================================
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:1337';

console.log('🔗 API Base URL:', BASE_URL);

// ============================================
// API Endpoints Structure
// ============================================
export const API = {
  BASE_URL, // Export BASE_URL for use in direct fetch calls
  
  // ==================
  // Authentication
  // ==================
  auth: {
    login: `${BASE_URL}/api/auth/local`,
    register: `${BASE_URL}/api/auth/local/register`,
    forgotPassword: `${BASE_URL}/api/auth/forgot-password`,
    resetPassword: `${BASE_URL}/api/auth/reset-password`,
  },

  // ==================
  // Users
  // ==================
  users: {
    me: () => `${BASE_URL}/api/users/me?populate=role`,
    getMeFull: () => `${BASE_URL}/api/users/me?populate=*`,
    getById: (id) => `${BASE_URL}/api/users/${id}?populate=role`,
    getByIdFull: (id) => `${BASE_URL}/api/users/${id}?populate=*`,
    list: () => `${BASE_URL}/api/users?populate=role`,
    listAll: () => `${BASE_URL}/api/users?populate=*`,
    create: () => `${BASE_URL}/api/users`,
    update: (id) => `${BASE_URL}/api/users/${id}`,
    delete: (id) => `${BASE_URL}/api/users/${id}`,
  },

  // ==================
  // Drug Stores (Pharmacies)
  // ==================
  drugStores: {
    list: (filters = '') => `${BASE_URL}/api/drug-stores?${filters}`,
    listWithPhotos: () => `${BASE_URL}/api/drug-stores?populate=pharmacy_profiles,photo_front,photo_in,photo_staff`,
    getById: (id) => `${BASE_URL}/api/drug-stores/${id}?populate=pharmacy_profiles,photo_front,photo_in,photo_staff`,
    getByIdFull: (id) => `${BASE_URL}/api/drug-stores/${id}?populate=*`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/drug-stores?filters[documentId][$eq]=${documentId}`,
    listFiltered: (filterObj = {}) => {
      const params = new URLSearchParams();
      Object.entries(filterObj).forEach(([key, value]) => {
        if (typeof value === 'object') {
          Object.entries(value).forEach(([op, val]) => {
            params.append(`filters[${key}][${op}]`, val);
          });
        } else {
          params.append(`filters[${key}]`, value);
        }
      });
      return `${BASE_URL}/api/drug-stores?${params.toString()}`;
    },
    create: () => `${BASE_URL}/api/drug-stores`,
    update: (id) => `${BASE_URL}/api/drug-stores/${id}`,
    delete: (id) => `${BASE_URL}/api/drug-stores/${id}`,
  },

  // ==================
  // Pharmacy Profiles
  // ==================
  pharmacyProfiles: {
    list: (filters = '') => `${BASE_URL}/api/pharmacy-profiles?populate=profileimage${filters ? '&' + filters : ''}`,
    listAll: () => `${BASE_URL}/api/pharmacy-profiles?populate=*`,
    getById: (id) => `${BASE_URL}/api/pharmacy-profiles/${id}?populate=*`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/pharmacy-profiles?filters[documentId][$eq]=${documentId}`,
    getByUserDocumentId: (userDocumentId) => 
      `${BASE_URL}/api/pharmacy-profiles?filters[users_permissions_user][documentId][$eq]=${userDocumentId}&populate=*`,
    listFiltered: (filterObj = {}) => {
      const params = new URLSearchParams();
      params.append('populate', '*');
      
      const addFilters = (obj, prefix = 'filters') => {
        Object.entries(obj).forEach(([key, value]) => {
          const newPrefix = prefix ? `${prefix}[${key}]` : key;
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively handle nested objects
            addFilters(value, newPrefix);
          } else {
            params.append(newPrefix, value);
          }
        });
      };
      
      addFilters(filterObj);
      return `${BASE_URL}/api/pharmacy-profiles?${params.toString()}`;
    },
    create: () => `${BASE_URL}/api/pharmacy-profiles`,
    update: (id) => `${BASE_URL}/api/pharmacy-profiles/${id}`,
    delete: (id) => `${BASE_URL}/api/pharmacy-profiles/${id}`,
  },

  // ==================
  // Drugs
  // ==================
  drugs: {
    list: (filters = '') => `${BASE_URL}/api/drugs?${filters}`,
    listWithBatches: () => `${BASE_URL}/api/drugs?populate[0]=drug_batches&populate[1]=drug_store`,
    listByStore: (storeDocumentId) => `${BASE_URL}/api/drugs?filters[drug_store][documentId][$eq]=${storeDocumentId}&populate[0]=drug_batches&populate[1]=drug_store`,
    listByStoreWithBatches: (storeDocumentId) => `${BASE_URL}/api/drugs?filters[drug_store][documentId][$eq]=${storeDocumentId}&populate=*`,
    getById: (id) => `${BASE_URL}/api/drugs/${id}?populate=*`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/drugs?filters[documentId][$eq]=${documentId}`,
    create: () => `${BASE_URL}/api/drugs`,
    update: (id) => `${BASE_URL}/api/drugs/${id}`,
    delete: (id) => `${BASE_URL}/api/drugs/${id}`,
  },

  // ==================
  // Drug Batches (Lots)
  // ==================
  drugBatches: {
    list: (filters = '') => `${BASE_URL}/api/drug-batches?${filters}`,
    getById: (id) => `${BASE_URL}/api/drug-batches/${id}`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/drug-batches?filters[documentId][$eq]=${documentId}`,
    create: () => `${BASE_URL}/api/drug-batches`,
    update: (id) => `${BASE_URL}/api/drug-batches/${id}`,
    delete: (id) => `${BASE_URL}/api/drug-batches/${id}`,
  },

  // ==================
  // Customer Profiles
  // ==================
  customerProfiles: {
    list: (filters = '') => `${BASE_URL}/api/customer-profiles?${filters}`,
    listAll: () => `${BASE_URL}/api/customer-profiles?populate=*`,
    getById: (id, populate = '') => {
      const populateQuery = populate || '[0]=users_permissions_user&populate[1]=drug_stores&populate[2]=assigned_by_staff.users_permissions_user';
      return `${BASE_URL}/api/customer-profiles/${id}?populate${populateQuery}`;
    },
    getByIdBasic: (id) =>
      `${BASE_URL}/api/customer-profiles/${id}?populate[0]=users_permissions_user&populate[1]=drug_stores`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/customer-profiles?filters[documentId][$eq]=${documentId}`,
    create: () => `${BASE_URL}/api/customer-profiles`,
    update: (id) => `${BASE_URL}/api/customer-profiles/${id}`,
    delete: (id) => `${BASE_URL}/api/customer-profiles/${id}`,
  },

  // ==================
  // Staff Profiles
  // ==================
  staffProfiles: {
    list: (filters = '') => `${BASE_URL}/api/staff-profiles?${filters}`,
    listAll: () => `${BASE_URL}/api/staff-profiles?populate=*`,
    getById: (id) => `${BASE_URL}/api/staff-profiles/${id}?populate=*`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/staff-profiles?filters[documentId][$eq]=${documentId}`,
    getByDocumentIdWithUser: (documentId) => 
      `${BASE_URL}/api/staff-profiles?filters[documentId][$eq]=${documentId}&populate=users_permissions_user`,
    listByStore: (storeDocumentId) =>
      `${BASE_URL}/api/staff-profiles?filters[drug_store][documentId][$eq]=${storeDocumentId}&populate=*`,
    getByUserAndStore: (userDocumentId, storeDocumentId) => 
      `${BASE_URL}/api/staff-profiles?filters[users_permissions_user][documentId][$eq]=${userDocumentId}&filters[drug_store][documentId][$eq]=${storeDocumentId}`,
    create: () => `${BASE_URL}/api/staff-profiles`,
    update: (id) => `${BASE_URL}/api/staff-profiles/${id}`,
    delete: (id) => `${BASE_URL}/api/staff-profiles/${id}`,
  },

  // ==================
  // Notifications
  // ==================
  notifications: {
    list: (filters = '') => `${BASE_URL}/api/notifications?${filters}`,
    listAll: () => `${BASE_URL}/api/notifications?populate=*`,
    getById: (id) => `${BASE_URL}/api/notifications/${id}?populate=*`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/notifications?filters[documentId][$eq]=${documentId}`,
    getStaffAssignments: (staffDocumentId, customerDocumentId) => 
      `${BASE_URL}/api/notifications?filters[staff_profile][documentId][$eq]=${staffDocumentId}&filters[customer_profile][documentId][$eq]=${customerDocumentId}&filters[type][$eq]=customer_assignment&populate[]=staff_profile&populate[]=pharmacy_profile&populate[]=drug_store&populate[]=customer_profile`,
    getCustomerNotifications: (customerDocumentId) =>
      `${BASE_URL}/api/notifications?filters[$or][0][type][$eq]=customer_assignment&filters[$or][1][type][$eq]=customer_assignment_update&filters[customer_profile][documentId][$eq]=${customerDocumentId}&sort=createdAt:desc&pagination[limit]=1`,
    create: () => `${BASE_URL}/api/notifications`,
    update: (id) => `${BASE_URL}/api/notifications/${id}`,
    delete: (id) => `${BASE_URL}/api/notifications/${id}`,
  },

  // ==================
  // Admin Profiles
  // ==================
  adminProfiles: {
    list: (filters = '') => `${BASE_URL}/api/admin-profiles?populate=profileimage${filters ? '&' + filters : ''}`,
    getById: (id) => `${BASE_URL}/api/admin-profiles/${id}?populate=*`,
    getByDocumentId: (documentId) => `${BASE_URL}/api/admin-profiles?filters[documentId][$eq]=${documentId}`,
    listFiltered: (filterObj = {}) => {
      const params = new URLSearchParams();
      params.append('populate', 'profileimage');
      Object.entries(filterObj).forEach(([key, value]) => {
        if (typeof value === 'object') {
          Object.entries(value).forEach(([op, val]) => {
            params.append(`filters[${key}][${op}]`, val);
          });
        } else {
          params.append(`filters[${key}]`, value);
        }
      });
      return `${BASE_URL}/api/admin-profiles?${params.toString()}`;
    },
    create: () => `${BASE_URL}/api/admin-profiles`,
    update: (id) => `${BASE_URL}/api/admin-profiles/${id}`,
    delete: (id) => `${BASE_URL}/api/admin-profiles/${id}`,
  },

  // ==================
  // Image/Upload URLs (สำหรับแสดงรูป)
  // ==================
  upload: () => `${BASE_URL}/api/upload`,

  roles: {
    list: () => `${BASE_URL}/api/users-permissions/roles`,
  },

  getImageUrl: (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('/')) {
      return `${BASE_URL}${imagePath}`;
    }
    return imagePath;
  },
};

// ============================================
// Helper: Fetch with Bearer Token
// ============================================
export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('jwt');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// ============================================
// Helper: Build Filter Query String
// ============================================
export const buildFilterQuery = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value);
    }
  });
  return params.toString();
};

// ============================================
// Helper: Build Populate Query String
// ============================================
export const buildPopulateQuery = (populateFields = []) => {
  if (!Array.isArray(populateFields) || populateFields.length === 0) {
    return '';
  }
  return populateFields
    .map((field, index) => `populate[${index}]=${field}`)
    .join('&');
};

export default API;
