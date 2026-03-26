import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import DrugNotificationSettingsModal from '../../components/DrugNotificationSettingsModal';
import { API } from '../../../utils/apiConfig';

/* eslint-disable no-undef */

// ==================== Drug Unit Options ====================
const DRUG_UNIT_OPTIONS = [
  { value: 'tablet',     label: 'เม็ด',           icon: '💊' },
  { value: 'capsule',    label: 'แคปซูล',         icon: '💊' },
  { value: 'blister',    label: 'แผง',            icon: '📋' },
  { value: 'box',        label: 'กล่อง',          icon: '📦' },
  { value: 'sachet',     label: 'ซอง',            icon: '📦' },
  { value: 'bottle',     label: 'ขวด',            icon: '🍶' },
  { value: 'jar',        label: 'กระปุก',         icon: '🫙' },
  { value: 'tube',       label: 'หลอด',           icon: '🧴' },
  { value: 'patch',      label: 'แผ่น',           icon: '🩹' },
  { value: 'ml',         label: 'มิลลิลิตร (ml)', icon: '💧' },
  { value: 'cc',         label: 'ซีซี (cc)',       icon: '💉' },
  { value: 'drop',       label: 'หยด',            icon: '💧' },
  { value: 'teaspoon',   label: 'ช้อนชา',         icon: '🥄' },
  { value: 'tablespoon', label: 'ช้อนโต๊ะ',       icon: '🥄' },
  { value: 'puff',       label: 'พ่น',            icon: '🌬️' },
  { value: 'gram',       label: 'กรัม (g)',        icon: '⚖️' },
  { value: 'mg',         label: 'มิลลิกรัม (mg)', icon: '⚖️' },
  { value: 'piece',      label: 'ชิ้น',           icon: '🧩' },
  { value: 'other',      label: 'อื่นๆ',          icon: '📝' },
];

const getDrugUnitLabel = (unit, customUnit) => {
  if (unit === 'other' && customUnit) return customUnit;
  const found = DRUG_UNIT_OPTIONS.find(o => o.value === unit);
  return found ? found.label : 'เม็ด';
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch (e) {
    return dateStr;
  }
}

// Return empty string when no date (for input fields)
function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch (e) {
    return '';
  }
}

// Parse user-entered date string. Accepts YYYY-MM-DD or DD/MM/YYYY (prefer latter for inputs).
function parseDateInput(str) {
  if (!str) return null;
  const s = String(str).trim();
  // ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  // DD/MM/YYYY
  const m = /^([0-3]\d)\/([0-1]\d)\/(\d{4})$/.exec(s);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const d = new Date(year, month - 1, day);
    return isNaN(d) ? null : d;
  }
  // Last resort: let Date parse it
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Format user input into dd/mm/yyyy while typing (auto-insert '/').
function formatDateInputValue(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // keep only digits and limit to 8 (DDMMYYYY)
  const digits = s.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
  return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
}

// Centralized, idempotent toast helpers to avoid duplicate/stacking toasts
// Disable ALL user interactions (closeOnClick, closeButton, draggable) to avoid 'removalReason' error
const TOAST_DEFAULT_OPTIONS = { 
  autoClose: 3000, 
  closeOnClick: false, 
  closeButton: false,  // ปิดปุ่ม X เพื่อป้องกัน error
  pauseOnHover: true, 
  draggable: false     // ปิด drag เพื่อป้องกัน click event
};
// Internal numeric id generator and key→id map to avoid React-Toastify internal mismatch bugs
let TOAST_COUNTER = 1;
const TOAST_KEY_MAP = new Map();

// Remove stale entries from the map whose toast ids are no longer active
function cleanupToastMap() {
  try {
    for (const [k, v] of Array.from(TOAST_KEY_MAP.entries())) {
      if (!toast.isActive(v)) TOAST_KEY_MAP.delete(k);
    }
  } catch (e) {
    // ignore
    console.error('cleanupToastMap error', e);
  }
}

const showToast = (type, message, opts = {}) => {
  // Ensure message is a readable string (avoid [object Object] or undefined)
  const messageStr = typeof message === 'string' ? message : (message && message.message ? String(message.message) : JSON.stringify(message || ''));

  // Use a stable key for deduplication if provided (opts.toastKey) or fallback to type+message
  const baseKey = opts.toastKey || opts.toastId || `${type}:${messageStr}`;

  // Determine id to use (always numeric)
  cleanupToastMap();
  let id;
  if (opts.allowMultiple) {
    id = TOAST_COUNTER++;
  } else {
    // reuse existing id for the same logical message if still active
    const existing = TOAST_KEY_MAP.get(baseKey);
    if (existing && toast.isActive(existing)) return; // already shown
    // if existing is stale, remove it and continue
    if (existing && !toast.isActive(existing)) TOAST_KEY_MAP.delete(baseKey);
    id = TOAST_COUNTER++;
    TOAST_KEY_MAP.set(baseKey, id);
  }

  // onClose callback to clean up the map entry when toast truly closes
  const handleClose = () => {
    try {
      if (!opts.allowMultiple) {
        // only delete if the map still points to this toast id
        const current = TOAST_KEY_MAP.get(baseKey);
        if (current === id) TOAST_KEY_MAP.delete(baseKey);
      }
      if (opts.onClose) opts.onClose();
    } catch (e) {
      // Prevent onClose errors from breaking toast system
      console.error('Toast onClose error:', e);
    }
  };

  const finalOpts = { ...TOAST_DEFAULT_OPTIONS, ...opts, toastId: id, onClose: handleClose };

  try {
    if (type === 'success') return toast.success(messageStr, finalOpts);
    if (type === 'error') return toast.error(messageStr, finalOpts);
    if (type === 'info') return toast.info(messageStr, finalOpts);
    if (type === 'warn' || type === 'warning') return toast.warn(messageStr, finalOpts);
    return toast(messageStr, finalOpts);
  } catch (e) {
    // Guard against toast internal errors (avoid app crash from toast clicks)
    console.error('Toast error:', e);
    return null;
  }
};
const showError = (msg, opts) => showToast('error', msg, opts);
const showSuccess = (msg, opts) => showToast('success', msg, opts);
const showInfo = (msg, opts) => showToast('info', msg, opts);
const showWarn = (msg, opts) => showToast('warn', msg, opts);

function matchesStore(item, storeDocumentId) {
  // Strapi relation for this content-type is `drug_store`
  if (!item) return false;
  // Try multiple locations/shapes where the relation may appear
  // 1) item.drug_store
  // 2) item.attributes?.drug_store
  // 3) nested { data: { id, attributes: { documentId } } }
  // We'll attempt to extract an object with { id, documentId } when possible
  const candidates = [];

  // direct
  if (item.drug_store !== undefined) candidates.push(item.drug_store);
  // attributes.drug_store (in case item is not flattened)
  if (item.attributes && item.attributes.drug_store !== undefined) candidates.push(item.attributes.drug_store);

  // sometimes relation is nested as { data: {...} }
  if (item.drug_store && item.drug_store.data) candidates.push(item.drug_store.data);
  if (item.attributes && item.attributes.drug_store && item.attributes.drug_store.data) candidates.push(item.attributes.drug_store.data);

  console.log('DEBUG: Checking drug', item.id, 'candidates for drug_store:', candidates, 'against storeDocumentId:', storeDocumentId);

  for (const rel of candidates) {
    if (!rel) continue;

    // plain value could already be documentId
    if (typeof rel === 'string' || typeof rel === 'number') {
      const match = `${rel}` === `${storeDocumentId}`;
      console.log('DEBUG: candidate plain match result:', match, rel);
      if (match) return true;
    }

    // object with attributes.documentId
    if (rel.attributes && rel.attributes.documentId && `${rel.attributes.documentId}` === `${storeDocumentId}`) {
      console.log('DEBUG: candidate attributes.documentId match', rel.attributes.documentId);
      return true;
    }

    // object with documentId directly
    if (rel.documentId && `${rel.documentId}` === `${storeDocumentId}`) {
      console.log('DEBUG: candidate documentId match', rel.documentId);
      return true;
    }
  }

  console.log('DEBUG: No match found for drug', item.id, 'after checking candidates');
  return false;
}

export default function DrugList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [drugs, setDrugs] = useState([]);
  const [store, setStore] = useState(null);
  // prefer using documentId for matching relations; fall back to route id if not available
  const storeDocumentId = (store && store.attributes && store.attributes.documentId) ? store.attributes.documentId : id;
  // helper to extract the canonical key for a drug (prefer documentId)
  const getDrugKey = (d) => {
    if (!d) return null;
    if (d.documentId) return d.documentId;
    if (d.attributes && d.attributes.documentId) return d.attributes.documentId;
    if (d.id) return d.id;
    return null;
  };
  const [loading, setLoading] = useState(true);
  const [expiryFilterMonths, setExpiryFilterMonths] = useState(null);
  const [activeTab, setActiveTab] = useState('expiry');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  // Highlight drug from navigation state (when coming from out-of-stock warning)
  const [highlightDrugId, setHighlightDrugId] = useState(null);
  const highlightRef = useRef(null);
  // Batch management
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchFormData, setBatchFormData] = useState({
    lot_number: '',
    quantity: '',
    date_produced: '',
    expiry_date: ''
  });
  const [expandedDrugId, setExpandedDrugId] = useState(null);
  // Batch details modal state
  const [batchDetailsModalOpen, setBatchDetailsModalOpen] = useState(false);
  const [batchDetailsModalDrug, setBatchDetailsModalDrug] = useState(null);
  // removed unused importFile state
  // separate CSV and XLSX states
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [xlsxRecords, setXlsxRecords] = useState(null);
  const [xlsxFileName, setXlsxFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: [] });
  const [importErrorModal, setImportErrorModal] = useState({ open: false, errors: [], total: 0 });
  // Drug mode selection: 'existing' or 'new'
  const [drugMode, setDrugMode] = useState('new');
  const [selectedExistingDrugId, setSelectedExistingDrugId] = useState(null);
  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    description: '',
    manufacturer: '',
    price: '',
    drug_unit: 'tablet',
    drug_unit_custom: '',
    suggested_time: '',
    take_morning: false,
    take_lunch: false,
    take_evening: false,
    take_bedtime: false,
    meal_relation: 'after',
    dosage_per_time: '',
    frequency_hours: 0
  });
  // Import Tour modal state
  const [importTourOpen, setImportTourOpen] = useState(false);
  const [importTourStep, setImportTourStep] = useState(0);
  const [importTourClosing, setImportTourClosing] = useState(false);

  const token = localStorage.getItem('jwt');

  // Helper to refetch the drugs list (used after bulk operations)
  const refetchDrugsList = async () => {
    try {
      const listRes = await fetch(API.drugs.listWithBatches(), {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) }
      });
      const listJson = await listRes.json();
      const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
      const normalized = items.map(i => i && i.attributes ? { id: i.id, ...i.attributes } : i);
      const storeDocIdLocal = (store && store.attributes && store.attributes.documentId) ? store.attributes.documentId : id;
      const filtered = normalized.filter(d => matchesStore(d, storeDocIdLocal));
      setDrugs(filtered);
      setSelectedIds([]);
    } catch (e) {
      console.error('Failed to refetch drugs list', e);
    }
  };

  // Strapi v5: ใช้ documentId (UUID) เท่านั้น ห้าม numeric id
  // documentId เป็นตัวระบุที่เสถียรสำหรับ CRUD operations
  const getBatchDocumentId = (batch) => batch?.documentId || batch?.id;

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!mounted) return;
      setLoading(true);
      try {
        console.log('DEBUG: fetchData starting for store ID:', id);
        // fetch store info for header (keep full data so we have numeric id)
        const storeRes = await fetch(API.drugStores.getById(id), {
          headers: { ...(token && { Authorization: `Bearer ${token}` }) }
        });
        const storeJson = await storeRes.json().catch(() => null);
        const fetchedStore = storeJson && storeJson.data ? storeJson.data : null;
        if (mounted) setStore(fetchedStore);

        const storeDocIdLocal = (fetchedStore && fetchedStore.attributes && fetchedStore.attributes.documentId) ? fetchedStore.attributes.documentId : id;

        // fetch drugs list
        const listRes = await fetch(API.drugs.listWithBatches(), {
          headers: { ...(token && { Authorization: `Bearer ${token}` }) }
        });
        const listJson = await listRes.json();
        console.log('DEBUG: Raw API response for drugs:', listJson);
        const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
        const normalized = items.map(i => (i && i.attributes) ? { id: i.id, ...i.attributes } : i);
        console.log('DEBUG: Normalized drugs (fetchData):', normalized.slice(0, 5));
        const filtered = normalized.filter(d => matchesStore(d, storeDocIdLocal));
        if (mounted) setDrugs(filtered);
        console.log('DEBUG: Drugs state updated by fetchData:', filtered);
      } catch (err) {
        console.error('Error fetching drugs/store', err);
        if (mounted) {
          showError('ไม่สามารถโหลดรายการยาได้');
          setDrugs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // initial fetch
    fetchData();

    // refetch when window/tab regains focus (covers navigating back from edit page)
    const handleFocus = () => fetchData();
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchData(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [id, token]);

  // Handle highlight drug from navigation state (when coming from out-of-stock warning)
  useEffect(() => {
    if (location.state?.highlightDrugId && location.state?.fromOutOfStock) {
      const drugId = location.state.highlightDrugId;
      const drugName = location.state.highlightDrugName;
      
      // Set highlight state
      setHighlightDrugId(drugId);
      
      // Switch to stock tab to show all drugs
      setActiveTab('stock');
      
      // Set search term to filter to this drug only (คัดเหลือยาเดียวในตาราง)
      setSearchTerm(drugName);
      
      // Show toast notification
      toast.warning(`กรุณาเพิ่มสต๊อกยา "${drugName}" ที่หมดแล้ว`, {
        autoClose: 5000,
        position: 'top-center'
      });
      
      // Scroll to the highlighted drug after a short delay (wait for render)
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 500);
      
      // Clear the highlight after 5 seconds
      setTimeout(() => {
        setHighlightDrugId(null);
      }, 5000);
      
      // Clear the location state to prevent re-triggering on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Clear toast key map on unmount (toasts will auto-dismiss after 3s)
  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        TOAST_KEY_MAP.clear();
        toast.dismiss();
      } catch (e) { /* ignore */ }
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      TOAST_KEY_MAP.clear();
    };
  }, []);

  // --- CSV import helpers ---
  // downloadTemplate removed (use downloadTemplateAs directly)

  // Unified template downloader supporting 'csv' and 'xlsx'
  const downloadTemplateAs = async (type = 'csv') => {
    const header = [
      'ชื่อยา (ไทย)',
      'ชื่อยา (อังกฤษ)',
      'ข้อบ่งใช้',
      'ชื่อยี่ห้อ',
      'ราคา',
      'หน่วยยา'
    ];
    const sample1 = ['พาราเซตามอล','Paracetamol','แก้ปวด ลดไข้','ยา ดี','150.50','tablet'];
    const sample2 = ['พาราเซตามอล','Paracetamol','แก้ปวด ลดไข้','ยา สุข','145.00','capsule'];

    if (type === 'csv') {
      const csv = [header.join(','), sample1.map(s => `"${String(s).replace(/"/g,'""')}"`).join(','), sample2.map(s => `"${String(s).replace(/"/g,'""')}"`).join(',')].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drug_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    // XLSX
    try {
      const mod = await import('xlsx');
      const XLSX = mod.default || mod;
      const aoa = [header, sample1, sample2];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'template');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drug_template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to generate xlsx template', e);
      showError('ไม่สามารถสร้างไฟล์ Excel ได้ — ตรวจสอบว่าได้ติดตั้งไลบรารี xlsx');
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    setCsvFile(f || null);
    setCsvFileName(f ? f.name : '');
    if (f) showInfo(`เลือกไฟล์: ${f.name}`);
  };

  // handle .xlsx files using SheetJS if selected
  const handleFileChangeAdvanced = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) { setCsvFile(null); return; }
    const name = f.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      try {
        const ArrayBuffer = await f.arrayBuffer();
        // dynamic import to avoid bundling if not used
        const mod = await import('xlsx');
        const XLSX = mod.default || mod;
        const wb = XLSX.read(ArrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        console.log('DEBUG: Parsed XLSX -> CSV length', csv.length, 'rows approx', csv.split('\n').length);
        // show a preview to help debugging differences vs. CSV uploads
        console.log('DEBUG: XLSX->CSV preview (first 500 chars):', csv.slice(0, 500));
        // parse CSV into records immediately (separate XLSX flow)
        const rows = parseCSV(csv);
        if (rows.length < 2) {
          showError('ไฟล์ Excel ไม่มีข้อมูลที่อ่านได้');
          setXlsxRecords(null);
          return;
        }
        const header = rows[0].map(h => h.trim());
        const records = rows.slice(1).map(r => {
          const obj = {};
          for (let j = 0; j < header.length; j++) {
            obj[header[j]] = r[j] !== undefined ? r[j].trim() : '';
          }
          return obj;
        }).filter(rec => Object.values(rec).some(v => v !== ''));
        setXlsxRecords(records);
        setXlsxFileName(f.name);
        showInfo(`อ่านไฟล์ Excel เรียบร้อย พบ ${records.length} แถว`);
      } catch (err) {
        console.error('Failed to parse xlsx', err);
        showError('ไม่สามารถอ่านไฟล์ Excel ได้ — ดู Console สำหรับรายละเอียด');
        setXlsxRecords(null);
        setXlsxFileName('');
      }
    } else {
      // when a non-xlsx file is selected here, fall back to csvFile
      setCsvFile(f || null);
      setCsvFileName(f ? f.name : '');
      if (f) showInfo(`เลือกไฟล์: ${f.name}`);
    }
  };

  // Basic CSV parser that handles quoted fields and commas inside quotes
  function parseCSV(content) {
    const rows = [];
    let i = 0;
    const len = content.length;
    let cur = '';
    let row = [];
    let inQuotes = false;

    while (i < len) {
      const ch = content[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && content[i + 1] === '"') { // escaped quote
            cur += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        cur += ch;
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (ch === ',') {
        row.push(cur);
        cur = '';
        i++;
        continue;
      }

      if (ch === '\r') { i++; continue; }
      if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
        i++;
        continue;
      }

      cur += ch;
      i++;
    }
    // last
    if (cur !== '' || row.length > 0) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  // Generic import: accepts array of record objects (already mapped by header)
  const importRecords = async (records) => {
    if (!records || records.length === 0) return showInfo('ไม่มีข้อมูลที่จะนำเข้า');
    setImporting(true);
    setImportProgress({ done: 0, total: records.length, errors: [] });
    const storeRelationId = (store && store.attributes && store.attributes.documentId) ? store.attributes.documentId : id;
    const errors = [];
    let done = 0;
    
    // ดีบัก: แสดง header ของแรกสุด เพื่อเช็คการ parse
    if (records.length > 0) {
      console.log('DEBUG importRecords: First record keys:', Object.keys(records[0]));
      console.log('DEBUG importRecords: First record keys (JSON):', JSON.stringify(Object.keys(records[0])));
      console.log('DEBUG importRecords: First record data:', records[0]);
      console.log('DEBUG importRecords: ชื่อยี่ห้อ value:', records[0]['ชื่อยี่ห้อ']);
      console.log('DEBUG importRecords: ราคา value:', records[0]['ราคา']);
    }
    
    for (const rec of records) {
      // รองรับทุก header variants (ชื่อยี่ห้อ, ชื่อยี่ห้อ, ราคา, ราคา (บาท), ฯลฯ)
      const getFieldValue = (r, ...keys) => {
        for (const k of keys) {
          if (r[k] !== undefined && r[k] !== '' && r[k] !== null) return r[k];
        }
        return '';
      };
      
      const payload = {
        name_th: getFieldValue(rec, 'name_th', 'ชื่อยา (ไทย)'),
        name_en: getFieldValue(rec, 'name_en', 'ชื่อยา (อังกฤษ)'),
        description: getFieldValue(rec, 'description', 'ข้อบ่งใช้'),
        manufacturer: getFieldValue(rec, 'manufacturer', 'ชื่อยี่ห้อ'),
        price: (() => {
          const p = getFieldValue(rec, 'price', 'ราคา', 'ราคา (บาท)');
          return p ? (isNaN(parseFloat(p)) ? null : parseFloat(p)) : null;
        })(),
        drug_unit: (() => {
          const raw = (getFieldValue(rec, 'drug_unit', 'หน่วยยา', 'หน่วย') || '').trim();
          if (!raw) return 'tablet';
          // 1) ตรงกับ value (English) เลย
          const byValue = DRUG_UNIT_OPTIONS.find(o => o.value === raw);
          if (byValue) return byValue.value;
          // 2) ตรงกับ label (ภาษาไทย) ไม่ case-sensitive
          const byLabel = DRUG_UNIT_OPTIONS.find(o => o.label.toLowerCase() === raw.toLowerCase());
          if (byLabel) return byLabel.value;
          // 3) ตรงบางส่วน เช่น "มล" → ml
          const partial = DRUG_UNIT_OPTIONS.find(o =>
            o.label.replace(/\s*\(.*\)/, '').trim().toLowerCase() === raw.toLowerCase()
          );
          if (partial) return partial.value;
          return 'tablet';
        })(),
        drug_store: storeRelationId
      };
      
      // ดีบัก: แสดง payload ว่าจริง ๆ มีค่า manufacturer กับ price ไหม
      if (done === 0) {
        console.log('DEBUG importRecords: First payload to send:', payload);
      }
      try {
        const res = await fetch(API.drugs.create(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({ data: payload })
        });
        if (!res.ok) {
          let errBody = null;
          try { errBody = await res.json(); } catch (e) { try { errBody = await res.text(); } catch (e2) { errBody = String(e2); } }
          errors.push({ rec, error: errBody });
        } else {
          const result = await res.json().catch(() => null);
          console.log('DEBUG: Import POST success result:', result);
          const created = result && result.data ? { id: result.data.id, ...result.data.attributes } : result;
          try {
            if (created && matchesStore(created, storeDocumentId)) {
              setDrugs(prev => {
                const next = [...prev, created];
                console.log('DEBUG: Drugs appended after import:', created);
                return next;
              });
            }
          } catch (e) { console.error('Error appending created item', e); }
        }
      } catch (e) {
        errors.push({ rec, error: e.message || String(e) });
      }
      done += 1;
      // avoid declaring a function inside the loop (eslint:no-loop-func)
      setImportProgress({ done, total: records.length, errors });
    }

    setImportProgress(prev => ({ ...prev, errors }));
    if (errors.length === 0) {
      showSuccess(`นำเข้าเรียบร้อย ${done} รายการ`);
    } else {
      showWarn(`นำเข้าเสร็จ แต่มีข้อผิดพลาด ${errors.length} รายการ`);
      console.error('Import errors:', errors);
      setImportErrorModal({ open: true, errors, total: done });
    }

      // refetch list after import to ensure we have server's canonical state
    try {
      const listRes = await fetch(API.drugs.listWithBatches(), {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) }
      });
      const listJson = await listRes.json();
      const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
      console.log('DEBUG: Raw list after import:', listJson);
      const normalized = items.map(i => i && i.attributes ? { id: i.id, ...i.attributes } : i);
      console.log('DEBUG: Normalized after import sample:', normalized.slice(0,3));
      const filtered = normalized.filter(d => matchesStore(d, storeDocumentId));
      setDrugs(filtered);
    } catch (e) {
      console.error('Failed to refetch after import', e);
    } finally {
      setImporting(false);
    }
  };  // triggers CSV import from selected csvFile
  const handleImportCSV = async () => {
    if (!csvFile) return showInfo('กรุณาเลือกไฟล์ CSV ก่อน');
    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);
      if (rows.length < 2) return showError('ไฟล์ว่างหรือไม่มีข้อมูล');
      const header = rows[0].map(h => h.trim());
      const records = rows.slice(1).map(r => {
        const obj = {};
        for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] !== undefined ? r[j].trim() : '';
        return obj;
      }).filter(rec => Object.values(rec).some(v => v !== ''));
      await importRecords(records);
      // Clear selected file and input so future selects always fire change
      try { setCsvFile(null); const el = document.getElementById('csvFileInput'); if (el) el.value = ''; } catch (e) { /* ignore */ }
      try { setCsvFileName(''); } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('CSV import failed', e);
      showError('นำเข้า CSV ล้มเหลว');
      setImporting(false);
    }
  };

  // triggers import for previously parsed xlsxRecords
  const handleImportXLSX = async () => {
    if (!xlsxRecords || xlsxRecords.length === 0) return showInfo('กรุณาเลือกไฟล์ Excel ก่อนและตรวจสอบข้อมูล');
    try {
      await importRecords(xlsxRecords);
    } finally {
      // Clear parsed xlsx records and reset file input so new selection always triggers
      try { setXlsxRecords(null); setXlsxFileName(''); const el = document.getElementById('xlsxFileInput'); if (el) el.value = ''; } catch (e) { /* ignore */ }
    }
  };

  const filteredDrugs = drugs.filter(d => {
    // Search filter: by thai/english name or manufacturer (case-insensitive)
    const q = (searchTerm || '').trim().toLowerCase();
    if (q) {
      const name = ((d.name_th || d.name_en) || '').toString().toLowerCase();
      const manu = (d.manufacturer || '').toString().toLowerCase();
      if (!(name.includes(q) || manu.includes(q))) return false;
    }
    if (!expiryFilterMonths) return true;

    // Filter based on batch (lot) expiry dates, not drug expiry date
    const batches = d.drug_batches || [];
    if (batches.length === 0) return false; // Hide drugs with no batches when filter is active

    const now = new Date();
    const limit3 = new Date(now);
    limit3.setMonth(limit3.getMonth() + 3);
    const limit6 = new Date(now);
    limit6.setMonth(limit6.getMonth() + 6);

    let hasExpiringBatch = false;

    if (expiryFilterMonths === 3) {
      // 0 .. 3 months (inclusive)
      hasExpiringBatch = batches.some(b => {
        const batchData = b.attributes ? { id: b.id, ...b.attributes } : b;
        const expiry = batchData.expiry_date;
        if (!expiry) return false;
        const expireDate = new Date(expiry);
        const inRange = expireDate <= limit3 && expireDate >= now;
        console.log('DEBUG(3m): Batch', batchData.lot_number, 'expiry check:', { expiry, expireDate, now, limit3, inRange });
        return inRange;
      });
    } else if (expiryFilterMonths === 6) {
      // 3 .. 6 months (exclude 0..3 so those appear under 3-month bucket)
      hasExpiringBatch = batches.some(b => {
        const batchData = b.attributes ? { id: b.id, ...b.attributes } : b;
        const expiry = batchData.expiry_date;
        if (!expiry) return false;
        const expireDate = new Date(expiry);
        const inRange = expireDate <= limit6 && expireDate > limit3;
        console.log('DEBUG(6m): Batch', batchData.lot_number, 'expiry check:', { expiry, expireDate, limit3, limit6, inRange });
        return inRange;
      });
    } else {
      // fallback: same behaviour as before (0 .. expiryFilterMonths)
      const limit = new Date(now);
      limit.setMonth(limit.getMonth() + expiryFilterMonths);
      hasExpiringBatch = batches.some(b => {
        const batchData = b.attributes ? { id: b.id, ...b.attributes } : b;
        const expiry = batchData.expiry_date;
        if (!expiry) return false;
        const expireDate = new Date(expiry);
        const inRange = expireDate <= limit && expireDate >= now;
        console.log('DEBUG(fallback): Batch', batchData.lot_number, 'expiry check:', { expiry, expireDate, now, limit, inRange });
        return inRange;
      });
    }

    return hasExpiringBatch;
  });

  console.log('DEBUG: Final filtered drugs (after expiry filter):', filteredDrugs);

  const handleOpenModal = (drug = null) => {
    if (drug) {
      // เมื่อแก้ไขยาเดิม ให้ตั้ง drugMode เป็น 'edit'
      setEditingDrug(drug);
      setFormData({
        name_th: drug.name_th || '',
        name_en: drug.name_en || '',
        description: drug.description || '',
        manufacturer: drug.manufacturer || '',
        price: drug.price ? String(drug.price) : '',
        drug_unit: drug.drug_unit || 'tablet',
        drug_unit_custom: drug.drug_unit_custom || '',
        suggested_time: drug.suggested_time ? drug.suggested_time.slice(0, 5) : '',
        take_morning: !!drug.take_morning,
        take_lunch: !!drug.take_lunch,
        take_evening: !!drug.take_evening,
        take_bedtime: !!drug.take_bedtime,
        meal_relation: drug.meal_relation || 'after',
        dosage_per_time: drug.dosage_per_time || '',
        frequency_hours: drug.frequency_hours || 0
      });
      setDrugMode('edit');
      setSelectedExistingDrugId(null);
    } else {
      // เมื่อเพิ่มยาใหม่ ให้ตั้ง drugMode เป็น 'new' (default)
      setEditingDrug(null);
      setFormData({
        name_th: '',
        name_en: '',
        description: '',
        manufacturer: '',
        price: '',
        drug_unit: 'tablet',
        drug_unit_custom: '',
        suggested_time: '',
        take_morning: false,
        take_lunch: false,
        take_evening: false,
        take_bedtime: false,
        meal_relation: 'after',
        dosage_per_time: '',
        frequency_hours: 0
      });
      setDrugMode('new');
      setSelectedExistingDrugId(null);
    }
    setShowModalClosing(false);
    setShowModal(true);
  };

  // Selection helpers for bulk actions
  const toggleSelection = (key) => {
    if (!key) return;
    setSelectedIds(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]));
  };

  const toggleSelectAll = () => {
    const allKeys = filteredDrugs.map(d => getDrugKey(d)).filter(Boolean);
    const allSelected = allKeys.length > 0 && allKeys.every(k => selectedIds.includes(k));
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(allKeys);
  };

  const handleDeleteSelected = () => {
    if (!selectedIds || selectedIds.length === 0) return showInfo('กรุณาเลือกอย่างน้อย 1 รายการเพื่อจะลบ');
    openConfirm('ยืนยันการลบหลายรายการ', `คุณต้องการลบ ${selectedIds.length} รายการที่เลือกหรือไม่?`, async () => {
      const results = { ok: 0, failed: 0, errors: [] };
      for (const key of selectedIds) {
        try {
          const res = await fetch(API.drugs.delete(key), {
            method: 'DELETE',
            headers: { ...(token && { Authorization: `Bearer ${token}` }) }
          });
          if (res.ok) results.ok += 1; else {
            results.failed += 1;
            let body = null;
            try { body = await res.json(); } catch (_) { body = await res.text().catch(() => null); }
            results.errors.push({ key, body });
          }
        } catch (e) {
          results.failed += 1;
          results.errors.push({ key, error: e.message || String(e) });
        }
      }

      // Refresh list and show summary toast
      await refetchDrugsList();
      if (results.failed === 0) showSuccess(`ลบสำเร็จ ${results.ok} รายการ`);
      else showWarn(`ลบสำเร็จ ${results.ok} รายการ แต่ล้มเหลว ${results.failed} รายการ`);
    });
  };

  const handleCloseModal = () => {
    setShowModalClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setShowModalClosing(false);
      setEditingDrug(null);
    }, 200);
  };
  

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // ✅ Validation: ตรวจสอบเงื่อนไข drugMode
      if (drugMode === 'existing' && !selectedExistingDrugId) {
        return showError('กรุณาเลือกรายการยา');
      }
      if (drugMode === 'new' && !formData.name_th.trim()) {
        return showError('กรุณากรอกชื่อยา (ไทย)');
      }
      if (!formData.manufacturer.trim()) {
        return showError('กรุณากรอกชื่อยี่ห้อ');
      }
      if (!formData.price || parseFloat(formData.price) <= 0) {
        return showError('กรุณากรอกราคา (ต้องมากกว่า 0)');
      }

      // prefer documentId for relation (use documentId only)
      const storeRelationId = (store && store.attributes && store.attributes.documentId) ? store.attributes.documentId : id;
      
      const drugData = {
        ...formData,
        price: parseFloat(formData.price),  // ✅ ต้องแปลงเป็น number
        drug_store: storeRelationId,  // ✅ ต้องส่ง drug_store ในทุก mode!
        suggested_time: formData.suggested_time ? (formData.suggested_time.split(':').length === 2 ? formData.suggested_time + ':00' : formData.suggested_time) : null
      };

      if (editingDrug) {
        // Update existing drug
        const editingKey = getDrugKey(editingDrug);
        const response = await fetch(API.drugs.update(editingKey), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({ data: drugData })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('DEBUG: Update drug response:', result);
          showSuccess('แก้ไขรายการยาสำเร็จ');
          
          // 🔄 refetch รายการยาทั้งหมดใหม่เพื่อให้แน่ใจว่าเห็นรายการยาที่แก้ไขแล้ว
          try {
            const listRes = await fetch(API.drugs.listWithBatches(), {
              headers: { ...(token && { Authorization: `Bearer ${token}` }) }
            });
            const listJson = await listRes.json();
            const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
            console.log('DEBUG: Raw list after update drug:', listJson);
            const normalized = items.map(i => i && i.attributes ? { id: i.id, ...i.attributes } : i);
            console.log('DEBUG: Normalized after update sample:', normalized.slice(0, 3));
            const filtered = normalized.filter(d => matchesStore(d, storeDocumentId));
            console.log('DEBUG: Filtered drugs after update:', filtered);
            setDrugs(filtered);
          } catch (refetchErr) {
            console.error('Failed to refetch after updating drug', refetchErr);
            // ถ้า refetch ล้มเหลว ให้อัปเดต state ตามปกติ
            const keyBefore = editingKey;
            const updated = result && result.data ? { id: result.data.id, ...result.data.attributes } : result;
            setDrugs(current => {
              const next = current.map(d => (getDrugKey(d) === keyBefore ? updated : d));
              console.log('DEBUG: Drugs state after update (fallback):', next);
              return next;
            });
          }
        } else {
          throw new Error('Failed to update drug');
        }
      } else {
        // Add new drug (both 'new' and 'existing' mode)
        const response = await fetch(API.drugs.create(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({ data: drugData })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('DEBUG: Add drug response:', result);
          console.log('DEBUG: drugMode:', drugMode, 'selectedExistingDrugId:', selectedExistingDrugId);
          showSuccess(drugMode === 'existing' ? 'เพิ่มยี่ห้อใหม่สำเร็จ' : 'เพิ่มรายการยาสำเร็จ');
          
            // 🔄 refetch รายการยาทั้งหมดใหม่เพื่อให้แน่ใจว่าเห็นรายการยาที่เพิ่มใหม่
          try {
            const listRes = await fetch(API.drugs.listWithBatches(), {
              headers: { ...(token && { Authorization: `Bearer ${token}` }) }
            });
            const listJson = await listRes.json();
            const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
            console.log('DEBUG: Raw list after add drug:', listJson);
            const normalized = items.map(i => i && i.attributes ? { id: i.id, ...i.attributes } : i);
            console.log('DEBUG: Normalized after add sample:', normalized.slice(0, 3));
            const filtered = normalized.filter(d => matchesStore(d, storeDocumentId));
            console.log('DEBUG: Filtered drugs after add:', filtered);
            setDrugs(filtered);
            } catch (refetchErr) {
            console.error('Failed to refetch after adding drug', refetchErr);
            // ถ้า refetch ล้มเหลว ให้เพิ่มเข้า state ตามปกติ
            const created = { id: result.data.id, ...result.data.attributes };
            setDrugs(current => [...current, created]);
          }
        } else {
          throw new Error('Failed to add drug');
        }
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving drug:', error);
      showError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDelete = async (drugId) => {
    // replaced by confirm modal flow; this function now opens the modal
    openConfirm('ยืนยันการลบ', 'คุณต้องการลบรายการยานี้หรือไม่?', async () => {
      try {
        const response = await fetch(API.drugs.delete(drugId), {
          method: 'DELETE',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });

        if (response.ok) {
          console.log('DEBUG: Delete drug', drugId, 'successful');
          setDrugs(current => {
            const next = current.filter(d => getDrugKey(d) !== drugId);
            console.log('DEBUG: Drugs state after delete:', next);
            return next;
          });
          showSuccess('ลบรายการยาสำเร็จ');
        } else {
          throw new Error('Failed to delete drug');
        }
        } catch (error) {
        console.error('Error deleting drug:', error);
        showError('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    });
  };

  // confirmation modal state and helpers (with closing animation)
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', message: '', onConfirm: null, closing: false });
  const openConfirm = (title, message, onConfirm) => setConfirmDialog({ visible: true, title, message, onConfirm, closing: false });
  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, closing: true }));
    // wait for animation then hide
    setTimeout(() => setConfirmDialog({ visible: false, title: '', message: '', onConfirm: null, closing: false }), 200);
  };

  // modal open/close animation for main add/edit modal
  const [showModalClosing, setShowModalClosing] = useState(false);
  // Notification settings sub-modal state
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const [notifEditDrug, setNotifEditDrug] = useState(null); // drug being edited via notification modal
  const [notifFormData, setNotifFormData] = useState({ take_morning: false, take_lunch: false, take_evening: false, take_bedtime: false, meal_relation: 'after', suggested_time: '', dosage_per_time: '', frequency_hours: 0 });
  const [notifSaving, setNotifSaving] = useState(false);

  const handleOpenNotifModal = (drug) => {
    setNotifEditDrug(drug);
    setNotifFormData({
      take_morning: !!drug.take_morning,
      take_lunch: !!drug.take_lunch,
      take_evening: !!drug.take_evening,
      take_bedtime: !!drug.take_bedtime,
      meal_relation: drug.meal_relation || 'after',
      suggested_time: drug.suggested_time ? drug.suggested_time.slice(0, 5) : '',
      dosage_per_time: drug.dosage_per_time || '',
      frequency_hours: drug.frequency_hours || 0
    });
    setNotifSettingsOpen(true);
  };

  const handleNotifInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNotifFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSaveNotifSettings = async () => {
    if (!notifEditDrug) return;
    setNotifSaving(true);
    try {
      const drugKey = getDrugKey(notifEditDrug);
      const payload = {
        take_morning: notifFormData.take_morning,
        take_lunch: notifFormData.take_lunch,
        take_evening: notifFormData.take_evening,
        take_bedtime: notifFormData.take_bedtime,
        meal_relation: notifFormData.meal_relation,
        suggested_time: notifFormData.suggested_time
          ? (notifFormData.suggested_time.split(':').length === 2 ? notifFormData.suggested_time + ':00' : notifFormData.suggested_time)
          : null,
        dosage_per_time: notifFormData.dosage_per_time || '',
        frequency_hours: parseInt(notifFormData.frequency_hours) || 0
      };
      const res = await fetch(API.drugs.update(drugKey), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ data: payload })
      });
      if (!res.ok) throw new Error('save failed');
      // patch local state
      setDrugs(prev => prev.map(d => getDrugKey(d) === drugKey ? { ...d, ...payload } : d));
      showSuccess('บันทึกการแจ้งเตือนสำเร็จ');
      setNotifSettingsOpen(false);
    } catch {
      showError('เกิดข้อผิดพลาดในการบันทึกการแจ้งเตือน');
    } finally {
      setNotifSaving(false);
    }
  };

  // Batch handlers
  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!editingDrug) return showError('ไม่พบข้อมูลยา');
    try {
      // Validate dates: if both provided, date_produced must be <= expiry_date
      const prodStr = (batchFormData.date_produced || '').trim();
      const expStr = (batchFormData.expiry_date || '').trim();
      const prodDate = prodStr ? parseDateInput(prodStr) : null;
      const expDate = expStr ? parseDateInput(expStr) : null;
      if (prodDate && expDate) {
        if (isNaN(prodDate.valueOf()) || isNaN(expDate.valueOf())) {
          return showError('วันที่ไม่ถูกต้อง กรุณาตรวจสอบ');
        }
        if (prodDate > expDate) {
          return showError('วันที่ผลิตต้องอยู่ก่อนหรือเท่ากับวันหมดอายุ');
        }
      }

      const batchPayload = {
        lot_number: batchFormData.lot_number,
        quantity: parseInt(batchFormData.quantity, 10) || 0,
        date_produced: prodDate ? prodDate.toISOString() : null,
        expiry_date: expDate ? expDate.toISOString() : null,
        drug: getDrugKey(editingDrug)
      };

      let response;
      if (editingBatch) {
        // Update batch — ใช้ documentId เท่านั้น
        const docId = getBatchDocumentId(editingBatch);
        if (!docId) throw new Error('ไม่พบ documentId ของ Lot');
        response = await fetch(API.drugBatches.update(docId), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({ data: batchPayload })
        });
      } else {
        // Create batch
        response = await fetch(API.drugBatches.create(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({ data: batchPayload })
        });
      }

      if (!response.ok) throw new Error('ไม่สามารถบันทึก Batch ได้');
      
      showSuccess(editingBatch ? 'แก้ไข Lot สำเร็จ' : 'เพิ่ม Lot สำเร็จ');
      setBatchModalOpen(false);
      
      // Refetch drugs to get updated batches
      const listRes = await fetch(API.drugs.listWithBatches(), {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) }
      });
      const listJson = await listRes.json();
      const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
      const normalized = items.map(i => i && i.attributes ? { id: i.id, ...i.attributes } : i);
      const filtered = normalized.filter(d => matchesStore(d, storeDocumentId));
      setDrugs(filtered);
    } catch (error) {
      console.error('Error saving batch:', error);
      showError('เกิดข้อผิดพลาดในการบันทึก Lot');
    }
  };

  const handleDeleteBatch = (batchId, drugId) => {
    openConfirm('ยืนยันการลบ Lot', 'คุณต้องการลบ Lot นี้หรือไม่?', async () => {
      try {
        // ต้องมี documentId เท่านั้น
        if (!batchId) throw new Error('ไม่พบ documentId ของ Lot');

        const response = await fetch(API.drugBatches.delete(batchId), {
          method: 'DELETE',
          headers: { ...(token && { Authorization: `Bearer ${token}` }) }
        });

        if (!response.ok) throw new Error('ไม่สามารถลบ Lot ได้');

        // Refetch and confirm deletion before showing success to avoid "ghost" toasts
        const listRes = await fetch(API.drugs.listWithBatches(), {
          headers: { ...(token && { Authorization: `Bearer ${token}` }) }
        });
        const listJson = await listRes.json();
        const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
        const normalized = items.map(i => i && i.attributes ? { id: i.id, ...i.attributes } : i);
        const filtered = normalized.filter(d => matchesStore(d, storeDocumentId));

        // Find the drug and check if the batch still exists
        const targetDrug = filtered.find(d => getDrugKey(d) === drugId);
        const batchStillExists = targetDrug && targetDrug.drug_batches && targetDrug.drug_batches.some(b => {
          const bData = b.attributes ? { id: b.id, ...b.attributes } : b;
          return `${bData.documentId || bData.id}` === `${batchId}`;
        });

        if (batchStillExists) {
          console.warn('Batch still exists after delete:', batchId);
          showError('การลบ Lot ไม่สำเร็จ — กรุณาลองใหม่');
        } else {
          // use toastKey instead of raw toastId (showToast will map to numeric id)
          showSuccess('ลบ Lot สำเร็จ', { toastKey: `batch-delete-success:${batchId}` });
          setDrugs(filtered);
        }
      } catch (error) {
        console.error('Error deleting batch:', error);
        showError('เกิดข้อผิดพลาดในการลบ Lot');
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <HomeHeader pharmacyName={store?.attributes?.name_th || store?.name_th} onSearch={() => {}} isLoggedIn={true} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Page Header */}
        <div className="bg-white rounded-[2rem] md:rounded-3xl p-6 shadow-sm border border-slate-200 mb-6 md:mb-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="m14.7 18.8 5.8-5.9a3.5 3.5 0 0 0-4.9-5l-5.9 5.9a3.5 3.5 0 0 0 4.9 5Z"/><path d="M8.8 14.7 3 20.5"/><path d="M10.6 12.8 15.5 17.7"/><path d="m11.8 10.2 5.6 5.6"/><path d="m16.2 8.4 5.6 5.6"/><path d="M21 21v.01"/><path d="M18 18v.01"/></svg>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight text-center lg:text-left">
                {store?.attributes?.name_th || 'รายการยา'}
              </h2>
              <div className="mt-4 lg:mt-2 flex items-center justify-center lg:justify-start text-slate-500 bg-blue-50 w-full lg:w-fit px-3 py-1.5 rounded-full border border-blue-100">
                <span className="text-blue-500 mr-2">💡</span>
                <span className="text-[11px] md:text-sm font-medium italic">วิธีใช้: เพิ่มชื่อยา (ยี่ห้อ ราคา) → เพิ่ม Lot (จำนวน วันผลิต วันหมดอายุ)</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 md:gap-3">
              <button 
                className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all duration-200 text-sm md:text-base"
                onClick={() => navigate(-1)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                กลับ
              </button>
              
              <button 
                className={`flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-semibold transition-all duration-200 text-sm md:text-base ${
                  selectedIds.length > 0 
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-sm shadow-rose-100' 
                    : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
                onClick={handleDeleteSelected} 
                disabled={selectedIds.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                {selectedIds.length > 0 ? `ลบ (${selectedIds.length})` : 'ลบที่เลือก'}
              </button>
              
              <button 
                className="flex items-center gap-2 px-5 md:px-6 py-2 md:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-100 transition-all duration-200 transform hover:-translate-y-0.5 text-sm md:text-base"
                onClick={() => handleOpenModal()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                เพิ่มรายการยา
              </button>
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 mb-6 md:mb-8 overflow-visible flex flex-col lg:flex-row items-center gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-fit overflow-x-auto no-scrollbar">
            <button
              className={`flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                activeTab === 'expiry' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setActiveTab('expiry')}
            >
              📅 หมดอายุ
            </button>
            <button
              className={`flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                activeTab === 'import' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setActiveTab('import')}
            >
              📤 นำเข้า
            </button>
            <button
              className={`flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                activeTab === 'search' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setActiveTab('search')}
            >
              🔍 ค้นหา
            </button>
          </div>

          <div className="flex-1 w-full relative overflow-hidden">
            {activeTab === 'search' && (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="relative flex-1 group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </div>
                  <input
                    type="search"
                    placeholder="ค้นหาชื่อยา หรือ ยี่ห้อ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSearchTerm('');
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                  />
                </div>
              </div>
            )}

            {activeTab === 'expiry' && (
              <div className="flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">ตัวกรอง:</span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all duration-200 ${
                      expiryFilterMonths === 3 
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => setExpiryFilterMonths(expiryFilterMonths === 3 ? null : 3)}
                  >
                    3 เดือน
                  </button>
                  <button 
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all duration-200 ${
                      expiryFilterMonths === 6 
                        ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-100' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => setExpiryFilterMonths(expiryFilterMonths === 6 ? null : 6)}
                  >
                    6 เดือน
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'import' && (
              <div className="flex flex-wrap items-center gap-2 md:gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
                <button 
                  className="px-3 md:px-4 py-2 md:py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs md:text-sm font-bold hover:bg-emerald-100 transition-all flex items-center gap-2"
                  onClick={() => { setImportTourStep(0); setImportTourClosing(false); setImportTourOpen(true); }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8h.01"/><path d="M11 12h1v4h1"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
                  วิธีใช้งาน
                </button>
                
                <div className="hidden sm:block h-8 w-px bg-slate-100 mx-1"></div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <input id="csvFileInput" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    <label 
                      htmlFor="csvFileInput" 
                      className="px-3 md:px-4 py-2 md:py-2.5 bg-slate-800 text-white rounded-xl text-xs md:text-sm font-bold cursor-pointer hover:bg-slate-900 transition-all shadow-sm whitespace-nowrap"
                    >
                      {csvFileName ? 'เปลี่ยน CSV' : 'เลือก CSV'}
                    </label>
                    <button 
                      className="p-2 md:p-2.5 bg-indigo-600 disabled:bg-slate-200 text-white rounded-xl transition-all shadow-sm"
                      onClick={handleImportCSV} 
                      disabled={!csvFile || importing}
                      title="นำเข้า CSV"
                    >
                      {importing ? (
                        <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input id="xlsxFileInput" type="file" accept=".xlsx,.xls" onChange={handleFileChangeAdvanced} className="hidden" />
                    <label 
                      htmlFor="xlsxFileInput" 
                      className="px-3 md:px-4 py-2 md:py-2.5 bg-emerald-600 text-white rounded-xl text-xs md:text-sm font-bold cursor-pointer hover:bg-emerald-700 transition-all shadow-sm whitespace-nowrap"
                    >
                      {xlsxFileName ? 'เปลี่ยน Excel' : 'เลือก Excel'}
                    </label>
                    <button 
                      className="p-2 md:p-2.5 bg-emerald-600 disabled:bg-slate-200 text-white rounded-xl transition-all shadow-sm"
                      onClick={handleImportXLSX} 
                      disabled={!xlsxRecords || importing}
                      title="นำเข้า Excel"
                    >
                      {importing ? (
                        <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    className="px-2 md:px-3 py-1.5 md:py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5"
                    onClick={() => downloadTemplateAs('csv')}
                  >
                    เทมเพลต (CSV)
                  </button>
                  <button 
                    className="px-2 md:px-3 py-1.5 md:py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5"
                    onClick={() => downloadTemplateAs('xlsx')}
                  >
                    เทมเพลต (Excel)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-medium tracking-tight">กำลังโหลดรายการยา...</p>
            </div>
          ) : filteredDrugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ไม่พบรายการยา</h3>
              <p className="text-slate-500 max-w-xs mx-auto">ลองเปลี่ยนคำค้นหา หรือกรองข้อมูลใหม่เพื่อให้พบรายการที่ต้องการ</p>
              <button 
                className="mt-6 text-indigo-600 font-bold hover:text-indigo-700 underline underline-offset-8 transition-all"
                onClick={() => { setSearchTerm(''); setExpiryFilterMonths(null); }}
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-5 w-[60px]">
                        <div className="flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                            onChange={toggleSelectAll} 
                            checked={filteredDrugs.length > 0 && selectedIds.length === filteredDrugs.map(d => getDrugKey(d)).filter(Boolean).length} 
                          />
                        </div>
                      </th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">ผู้ผลิต/ยี่ห้อ</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">รายการยา</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">ข้อบ่งใช้</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none text-right">ราคา</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none text-center">คงเหลือ (LOT)</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredDrugs.map((drug, idx) => {
                      const drugKey = getDrugKey(drug);
                      const isHighlighted = highlightDrugId && drugKey === highlightDrugId;
                      const stockCount = drug.drug_batches?.reduce((acc, b) => acc + (b.attributes?.quantity || b.quantity || 0), 0) || 0;
                      
                      return (
                        <tr 
                          key={drugKey || idx}
                          ref={isHighlighted ? highlightRef : null}
                          className={`group transition-all duration-200 hover:bg-slate-50/80 ${
                            isHighlighted ? 'bg-amber-50 ring-2 ring-amber-200 ring-inset' : ''
                          }`}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center">
                              <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                checked={selectedIds.includes(drugKey)} 
                                onChange={() => toggleSelection(drugKey)} 
                              />
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase ring-1 ring-slate-200 group-hover:bg-white group-hover:ring-slate-300 transition-all">
                              {drug.manufacturer || '(ไม่ระบุผู้ผลิต)'}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-800 text-[15px] leading-tight group-hover:text-indigo-600 transition-colors">
                                {drug.name_th || drug.name_en || '-'}
                              </span>
                              {drug.name_en && drug.name_th && (
                                <span className="text-[10px] text-slate-400 font-bold uppercase leading-none tracking-wider">{drug.name_en}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 leading-normal">
                            <p className="text-[13px] text-slate-500 line-clamp-2 max-w-[200px] leading-relaxed">
                              {drug.description || 'ไม่มีข้อมูลรายละเอียด'}
                            </p>
                          </td>
                          <td className="px-6 py-5 leading-none text-right">
                            <div className="flex flex-col gap-1 items-end">
                              <span className="text-lg font-black text-slate-800 tracking-tight">
                                {drug.price ? `${drug.price.toLocaleString()} ฿` : '-'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">ต่อ{getDrugUnitLabel(drug.drug_unit, drug.drug_unit_custom)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 leading-none">
                            <div className="flex justify-center">
                              <button 
                                className={`group/btn relative flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md ${
                                  stockCount === 0 
                                    ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 shadow-rose-100/50' 
                                    : stockCount < 10
                                      ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200 shadow-amber-100/50'
                                      : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 shadow-indigo-100/50'
                                }`}
                                onClick={() => { setBatchDetailsModalDrug(drug); setBatchDetailsModalOpen(true); }}
                              >
                                <div className={`p-1.5 rounded-xl ${
                                  stockCount === 0 ? 'bg-rose-500/10' : stockCount < 10 ? 'bg-amber-500/10' : 'bg-indigo-500/10'
                                }`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/></svg>
                                </div>
                                <div className="flex flex-col items-start leading-none gap-0.5">
                                  <span className="text-base font-black tracking-tight">{stockCount.toLocaleString()}</span>
                                  <span className="text-[9px] font-black uppercase opacity-70 tracking-[0.1em]">{drug.drug_batches?.length || 0} ล็อตสินค้า</span>
                                </div>
                                {stockCount < 5 && (
                                  <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white shadow-sm"></span>
                                  </div>
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-5 leading-none">
                            <div className="flex items-center justify-end gap-1.5 text-slate-400">
                              <button 
                                className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all duration-300 border border-transparent hover:border-indigo-100"
                                onClick={() => handleOpenModal(drug)}
                                title="แก้ไขข้อมูลยา"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                              </button>
                              <button 
                                className="p-2.5 bg-slate-50 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-2xl transition-all duration-300 border border-transparent hover:border-violet-100"
                                onClick={() => handleOpenNotifModal(drug)}
                                title="ตั้งค่าการแจ้งเตือน"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                              </button>
                              <button 
                                className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all duration-300 border border-transparent hover:border-rose-100"
                                onClick={() => handleDelete(drugKey)}
                                title="ลบรายการยา"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col gap-4 p-4">
                {filteredDrugs.map((drug, idx) => {
                  const drugKey = getDrugKey(drug);
                  const stockCount = drug.drug_batches?.reduce((acc, b) => acc + (b.attributes?.quantity || b.quantity || 0), 0) || 0;
                  return (
                    <div key={drugKey || idx} className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 relative overflow-hidden active:scale-[0.98] transition-all duration-200">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <input 
                            type="checkbox" 
                            className="w-6 h-6 rounded-xl border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all"
                            checked={selectedIds.includes(drugKey)} 
                            onChange={() => toggleSelection(drugKey)} 
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800 text-base leading-tight">
                              {drug.name_th || drug.name_en || '-'}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                              {drug.manufacturer || '(ไม่ระบุผู้ผลิต)'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-black text-indigo-600 tracking-tight">
                            {drug.price ? `${drug.price.toLocaleString()} ฿` : '-'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">ราคาต่อ{getDrugUnitLabel(drug.drug_unit, drug.drug_unit_custom)}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50/80 rounded-[1.5rem] p-4 mb-5 border border-slate-100/50">
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {drug.description || 'ไม่มีข้อมูลรายละเอียดข้อบ่งใช้สำหรับยาตัวนี้'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] border transition-all duration-300 ${
                            stockCount === 0 
                              ? 'bg-rose-50 border-rose-100 text-rose-600 shadow-sm shadow-rose-100/20' 
                              : stockCount < 10
                                ? 'bg-amber-50 border-amber-100 text-amber-600 shadow-sm shadow-amber-100/20'
                                : 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm shadow-indigo-100/20'
                          }`}
                          onClick={() => { setBatchDetailsModalDrug(drug); setBatchDetailsModalOpen(true); }}
                        >
                          <span className="text-xl font-black leading-none mb-1">{stockCount.toLocaleString()}</span>
                          <span className="text-[9px] font-black uppercase opacity-70 tracking-widest">สต็อก ({drug.drug_batches?.length || 0} ล็อต)</span>
                        </button>
                        
                        <div className="flex gap-2">
                          <button 
                            className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.25rem] border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all duration-300"
                            onClick={() => handleOpenModal(drug)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                          </button>
                          <button 
                            className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.25rem] border border-slate-100 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all duration-300"
                            onClick={() => handleDelete(drugKey)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {(showModal || showModalClosing) && (
          <div 
            className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
              showModalClosing ? 'opacity-0' : 'opacity-100'
            }`} 
            onClick={handleCloseModal}
          >
            <div 
              className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transition-all duration-300 ${
                showModalClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
              }`} 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative px-8 pt-8 pb-6 border-b border-slate-50">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {editingDrug ? 'แก้ไขรายการยา' : 'เพิ่มรายการยาใหม่'}
                </h3>
                <p className="text-sm text-slate-400 font-medium">ระบุข้อมูลพื้นฐานของยาและยี่ห้อ</p>
                <button 
                  className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-200"
                  onClick={handleCloseModal}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                <div className="flex items-start gap-4 p-4 bg-indigo-50/50 rounded-3xl border border-indigo-100/50">
                  <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-wider leading-none">💡 หมายเหตุสำคัญ</span>
                    <p className="text-xs text-indigo-900/70 font-medium leading-relaxed">
                      ยาที่มีชื่อเดียวกันแต่ยี่ห้อต่างกันจะถูกบันทึกเป็นรายการแยกต่างหาก เพื่อให้คุณจัดการราคาและสต็อกแต่ละยี่ห้อได้แม่นยำ
                    </p>
                  </div>
                </div>

                {!editingDrug && (
                  <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-4">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      ประเภทการบันทึก
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDrugMode('existing');
                          setFormData({ name_th: '', name_en: '', description: '', manufacturer: '', price: '' });
                          setSelectedExistingDrugId(null);
                        }}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                          drugMode === 'existing' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-md shadow-indigo-100' 
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span className="text-xs font-bold leading-none">เลือกจากที่มีอยู่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDrugMode('new');
                          setFormData({ name_th: '', name_en: '', description: '', manufacturer: '', price: '' });
                          setSelectedExistingDrugId(null);
                        }}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                          drugMode === 'new' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-md shadow-indigo-100' 
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        <span className="text-xs font-bold leading-none">เพิ่มข้อมูลใหม่</span>
                      </button>
                    </div>
                  </div>
                )}

                {drugMode === 'existing' && !editingDrug && (
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">
                      เลือกรายการยา <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group">
                      <select
                        value={selectedExistingDrugId || ''}
                        onChange={(e) => {
                          const drugKey = e.target.value;
                          setSelectedExistingDrugId(drugKey);
                          if (drugKey) {
                            const selected = drugs.find(d => getDrugKey(d) === drugKey);
                            if (selected) {
                              setFormData({
                                name_th: selected.name_th || '',
                                name_en: selected.name_en || '',
                                description: selected.description || '',
                                manufacturer: '',
                                price: '',
                                drug_unit: selected.drug_unit || 'tablet',
                                drug_unit_custom: selected.drug_unit_custom || '',
                                suggested_time: selected.suggested_time ? selected.suggested_time.slice(0, 5) : '',
                                take_morning: !!selected.take_morning,
                                take_lunch: !!selected.take_lunch,
                                take_evening: !!selected.take_evening,
                                take_bedtime: !!selected.take_bedtime,
                                meal_relation: selected.meal_relation || 'after',
                                dosage_per_time: selected.dosage_per_time || '',
                                frequency_hours: selected.frequency_hours || 0
                              });
                            }
                          }
                        }}
                        required
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none appearance-none"
                      >
                        <option value="">-- ค้นหาหรือเลือกยา --</option>
                        {drugs
                          .sort((a, b) => (a.name_th || '').localeCompare(b.name_th || '', 'th'))
                          .map(drug => (
                            <option key={getDrugKey(drug)} value={getDrugKey(drug)}>
                              {drug.name_th} {drug.name_en ? `(${drug.name_en})` : ''}
                            </option>
                          ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                  </div>
                )}

                {(drugMode === 'new' || editingDrug) && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">ชื่อยา (ไทย) <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          name="name_th"
                          value={formData.name_th}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                          placeholder="เช่น พาราเซตามอล"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">ชื่อยา (อังกฤษ)</label>
                        <input
                          type="text"
                          name="name_en"
                          value={formData.name_en}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                          placeholder="เช่น Paracetamol"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">ข้อบ่งใช้</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none"
                        placeholder="คำอธิบายสั้นๆ เช่น แก้ปวด ลดไข้..."
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">ยี่ห้อ <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-black focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="เช่น ยา ดี, ตรา งู"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">ราคา (฿) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-10 text-slate-800 font-black focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        placeholder="0.00"
                        required
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                    </div>
                  </div>
                </div>

                {/* Drug Unit Selector */}
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">
                    📦 หน่วยยา
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {DRUG_UNIT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, drug_unit: opt.value, ...(opt.value !== 'other' && { drug_unit_custom: '' }) }))}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 cursor-pointer transition-all text-center ${
                          formData.drug_unit === opt.value
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'
                        }`}
                      >
                        <span className="text-lg">{opt.icon}</span>
                        <span className="text-[10px] font-black uppercase leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  {formData.drug_unit === 'other' && (
                    <input
                      type="text"
                      name="drug_unit_custom"
                      value={formData.drug_unit_custom}
                      onChange={handleInputChange}
                      placeholder="ระบุหน่วยยา เช่น ขวด, หลอด..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                    />
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all duration-200 active:scale-95" 
                    onClick={handleCloseModal}
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all duration-200 active:scale-95"
                  >
                    {editingDrug ? 'บันทึกการแก้ไข' : 'เพิ่มรายการยา'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <DrugNotificationSettingsModal
          open={notifSettingsOpen}
          onClose={() => setNotifSettingsOpen(false)}
          onSave={handleSaveNotifSettings}
          formData={notifFormData}
          handleInputChange={handleNotifInputChange}
          drugName={notifEditDrug ? (notifEditDrug.name_th || notifEditDrug.name_en) : undefined}
          saving={notifSaving}
          drugUnit={getDrugUnitLabel(notifEditDrug?.drug_unit, notifEditDrug?.drug_unit_custom)}
        />

        {/* Import Error Modal */}
        {importErrorModal.open && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
            onClick={() => setImportErrorModal(prev => ({ ...prev, open: false }))}
          >
            <div
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-5 border-b border-slate-100 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight">นำเข้าไม่สำเร็จทั้งหมด</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                      สำเร็จ {importErrorModal.total - importErrorModal.errors.length} รายการ
                      &nbsp;•&nbsp;
                      <span className="text-rose-500 font-black">ผิดพลาด {importErrorModal.errors.length} รายการ</span>
                    </p>
                  </div>
                </div>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex-shrink-0"
                  onClick={() => setImportErrorModal(prev => ({ ...prev, open: false }))}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              {/* Table */}
              <div className="overflow-auto max-h-[55vh] px-8 py-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-100">
                      <th className="pb-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-8">#</th>
                      <th className="pb-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อยา (ไทย)</th>
                      <th className="pb-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ยี่ห้อ</th>
                      <th className="pb-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ราคา</th>
                      <th className="pb-3 text-left text-[10px] font-black text-rose-400 uppercase tracking-widest">สาเหตุข้อผิดพลาด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {importErrorModal.errors.map((eItem, idx) => {
                      const errMsg = (() => {
                        if (!eItem.error) return 'ไม่ทราบ';
                        if (typeof eItem.error === 'string') return eItem.error;
                        if (eItem.error?.error?.message) return eItem.error.error.message;
                        if (eItem.error?.message) return eItem.error.message;
                        const details = eItem.error?.error?.details?.errors;
                        if (Array.isArray(details) && details.length > 0) {
                          return details.map(d => `${d.path?.join('.')}: ${d.message}`).join('; ');
                        }
                        return JSON.stringify(eItem.error).slice(0, 150);
                      })();
                      return (
                        <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                          <td className="py-3 pr-3 text-xs font-black text-slate-300">{idx + 1}</td>
                          <td className="py-3 pr-3 font-bold text-slate-700 max-w-[150px]">
                            <span className="block truncate">{eItem.rec?.['ชื่อยา (ไทย)'] || eItem.rec?.name_th || <span className="text-slate-300 italic">ไม่ระบุ</span>}</span>
                          </td>
                          <td className="py-3 pr-3 text-slate-500 max-w-[120px]">
                            <span className="block truncate">{eItem.rec?.['ชื่อยี่ห้อ'] || eItem.rec?.manufacturer || '-'}</span>
                          </td>
                          <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">
                            {eItem.rec?.['ราคา'] || eItem.rec?.price || '-'}
                          </td>
                          <td className="py-3 text-rose-600 font-bold text-xs">
                            <span className="block leading-relaxed">{errMsg}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-8 pb-8 pt-3 flex gap-3">
                <button
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                  onClick={() => setImportErrorModal(prev => ({ ...prev, open: false }))}
                >
                  ปิด
                </button>
                <button
                  className="flex-1 py-3.5 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                  onClick={() => {
                    const header = 'ชื่อยา (ไทย),ชื่อยา (อังกฤษ),ยี่ห้อ,ราคา,สาเหตุข้อผิดพลาด';
                    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
                    const rows = importErrorModal.errors.map(eItem => {
                      const errMsg = (() => {
                        if (!eItem.error) return 'ไม่ทราบ';
                        if (typeof eItem.error === 'string') return eItem.error;
                        if (eItem.error?.error?.message) return eItem.error.error.message;
                        if (eItem.error?.message) return eItem.error.message;
                        const details = eItem.error?.error?.details?.errors;
                        if (Array.isArray(details) && details.length > 0) {
                          return details.map(d => `${d.path?.join('.')}: ${d.message}`).join('; ');
                        }
                        return JSON.stringify(eItem.error).slice(0, 150);
                      })();
                      return [
                        esc(eItem.rec?.['ชื่อยา (ไทย)'] || eItem.rec?.name_th || ''),
                        esc(eItem.rec?.['ชื่อยา (อังกฤษ)'] || eItem.rec?.name_en || ''),
                        esc(eItem.rec?.['ชื่อยี่ห้อ'] || eItem.rec?.manufacturer || ''),
                        esc(eItem.rec?.['ราคา'] || eItem.rec?.price || ''),
                        esc(errMsg),
                      ].join(',');
                    });
                    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'drug_import_errors.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  ⬇️ ดาวน์โหลด CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {(confirmDialog.visible || confirmDialog.closing) && (
          <div 
            className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 transition-all duration-300 ${
              confirmDialog.closing ? 'opacity-0' : 'opacity-100'
            }`} 
            onClick={closeConfirm}
          >
            <div 
              className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 transition-all duration-300 ${
                confirmDialog.closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
              }`} 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center text-rose-500 mb-6 shadow-sm ring-1 ring-rose-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">{confirmDialog.title || 'ยืนยันการดำเนินการ'}</h3>
                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                  {confirmDialog.message || 'คุณแน่ใจหรือไม่ว่าต้องการดำเนินการนี้? ข้อมูลอาจไม่สามารถกู้คืนได้'}
                </p>
                <div className="flex flex-col w-full gap-3">
                  <button 
                    className="w-full py-4 bg-rose-500 text-white font-black rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all active:scale-95" 
                    onClick={() => { closeConfirm(); if (confirmDialog.onConfirm) confirmDialog.onConfirm(); }}
                  >
                    ยืนยันการลบ
                  </button>
                  <button 
                    className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95" 
                    onClick={closeConfirm}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(batchDetailsModalOpen && batchDetailsModalDrug) && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-all duration-300" 
            onClick={() => setBatchDetailsModalOpen(false)}
          >
            <div 
              className="bg-slate-50 rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative px-10 pt-10 pb-6 bg-white border-b border-slate-100">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Drug Stock Lots</span>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-2">📦 รายละเอียด Lot</h2>
                  <p className="text-lg font-bold text-slate-400 leading-tight">
                    {batchDetailsModalDrug.name_th || batchDetailsModalDrug.name_en}
                  </p>
                </div>
                <button 
                  className="absolute top-10 right-10 w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-200"
                  onClick={() => setBatchDetailsModalOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-hide">
                {batchDetailsModalDrug.drug_batches && batchDetailsModalDrug.drug_batches.length > 0 ? (
                  <div className="grid gap-4">
                    {batchDetailsModalDrug.drug_batches.map((batch, idx) => {
                      const batchData = batch.attributes ? { id: batch.id, ...batch.attributes } : batch;
                      const isExpired = batchData.expiry_date && new Date(batchData.expiry_date) < new Date();
                      const isExpiringSoon = !isExpired && batchData.expiry_date && new Date(batchData.expiry_date) < new Date(Date.now() + 90*24*60*60*1000);
                      
                      return (
                        <div 
                          key={batchData.id || batchData.documentId || idx} 
                          className={`relative p-6 rounded-[2rem] border transition-all duration-300 hover:shadow-lg ${
                            isExpired ? 'bg-rose-50/50 border-rose-100' : isExpiringSoon ? 'bg-amber-50/50 border-amber-100' : 'bg-white border-slate-100'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 leading-none">Lot Number</span>
                              <span className="text-xl font-black text-slate-800 tracking-tight">{batchData.lot_number}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                onClick={() => {
                                  setEditingDrug(batchDetailsModalDrug);
                                  setEditingBatch(batchData);
                                  setBatchFormData({
                                    lot_number: batchData.lot_number || '',
                                    quantity: String(batchData.quantity || ''),
                                    date_produced: formatDateForInput(batchData.date_produced),
                                    expiry_date: formatDateForInput(batchData.expiry_date)
                                  });
                                  setBatchDetailsModalOpen(false);
                                  setBatchModalOpen(true);
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                              </button>
                              <button 
                                className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                onClick={() => {
                                  setBatchDetailsModalOpen(false);
                                  handleDeleteBatch(getBatchDocumentId(batchData), getDrugKey(batchDetailsModalDrug));
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase mb-1">คงเหลือ</span>
                              <span className="text-lg font-black text-slate-800">{batchData.quantity || 0}</span>
                              <span className="text-[10px] font-bold text-slate-400">{getDrugUnitLabel(batchDetailsModalDrug?.drug_unit, batchDetailsModalDrug?.drug_unit_custom)}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase mb-1">วันที่ผลิต</span>
                              <span className="text-xs font-bold text-slate-800">{formatDate(batchData.date_produced) || '-'}</span>
                            </div>
                            <div className={`p-4 rounded-2xl flex flex-col items-center ${
                              isExpired ? 'bg-rose-100/50' : isExpiringSoon ? 'bg-amber-100/50' : 'bg-slate-50'
                            }`}>
                              <span className={`text-[10px] font-black uppercase mb-1 ${
                                isExpired ? 'text-rose-500' : isExpiringSoon ? 'text-amber-600' : 'text-slate-400'
                              }`}>หมดอายุ</span>
                              <span className={`text-xs font-black ${
                                isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-700' : 'text-slate-800'
                              }`}>{formatDate(batchData.expiry_date) || '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-300">
                    <div className="w-20 h-20 rounded-[2rem] bg-white border border-dashed border-slate-200 flex items-center justify-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                    </div>
                    <p className="font-bold">ยังไม่มีข้อมูล Lot สำหรับยานี้</p>
                    <p className="text-sm font-medium opacity-60">กดปุ่ม "เพิ่ม Lot ใหม่" เพื่อเริ่มบันทึกสต็อก</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-white border-t border-slate-100 flex gap-4">
                <button 
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95" 
                  onClick={() => {
                    setEditingBatch(null);
                    setBatchFormData({ lot_number: '', quantity: '', date_produced: '', expiry_date: '' });
                    setEditingDrug(batchDetailsModalDrug);
                    setBatchDetailsModalOpen(false);
                    setBatchModalOpen(true);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  เพิ่ม Lot ใหม่
                </button>
                <button 
                  className="w-24 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95" 
                  onClick={() => setBatchDetailsModalOpen(false)}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {batchModalOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 transition-all duration-300" 
            onClick={() => setBatchModalOpen(false)}
          >
            <div 
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative px-8 pt-8 pb-4">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {editingBatch ? 'แก้ไข Lot' : 'เพิ่ม Lot ใหม่'}
                </h3>
                <p className="text-sm text-slate-400 font-medium">จัดการสต็อกและวันหมดอายุ</p>
                <button 
                  className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-200"
                  onClick={() => setBatchModalOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <form onSubmit={handleSaveBatch} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">Lot Number <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={batchFormData.lot_number}
                    onChange={(e) => setBatchFormData({ ...batchFormData, lot_number: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                    placeholder="เช่น LOT2024-XXX"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">จำนวนคงเหลือ <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    value={batchFormData.quantity}
                    onChange={(e) => setBatchFormData({ ...batchFormData, quantity: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">วันที่ผลิต</label>
                    <input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={batchFormData.date_produced}
                      onChange={(e) => setBatchFormData({ ...batchFormData, date_produced: formatDateInputValue(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none">วันหมดอายุ <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={batchFormData.expiry_date}
                      onChange={(e) => setBatchFormData({ ...batchFormData, expiry_date: formatDateInputValue(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-black focus:bg-white focus:border-indigo-500 transition-all outline-none ring-2 ring-rose-500/10"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95" 
                    onClick={() => setBatchModalOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    {editingBatch ? 'บันทึกการแก้ไข' : 'ยืนยันเพิ่ม Lot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {importTourOpen && (
          <div 
            className={`fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 transition-all duration-500 ${
              importTourClosing ? 'opacity-0' : 'opacity-100'
            }`}
            onClick={() => { setImportTourClosing(true); setTimeout(() => { setImportTourOpen(false); setImportTourClosing(false); }, 300); }}
          >
            <div 
              className={`bg-white rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden transition-all duration-500 ${
                importTourClosing ? 'scale-95 opacity-0 translate-y-20' : 'scale-100 opacity-100 translate-y-0'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-48 bg-emerald-600 overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white"></path>
                  </svg>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md mb-4 animate-bounce">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">คู่มือการนำเข้ายา</h2>
                  <p className="text-emerald-100 font-bold opacity-80 uppercase tracking-widest text-xs mt-1">Import Wizard Guide</p>
                </div>
                <button 
                  onClick={() => { setImportTourClosing(true); setTimeout(() => { setImportTourOpen(false); setImportTourClosing(false); }, 300); }}
                  className="absolute top-6 right-6 w-10 h-10 bg-black/10 hover:bg-black/20 text-white rounded-2xl flex items-center justify-center transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <div className="p-10">
                <div className="min-h-[300px] flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {importTourStep === 0 && (
                    <div className="space-y-6">
                      <div className="text-6xl animate-pulse">🚀</div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black text-slate-800">ยินดีต้อนรับสู่ระบบนำเข้า</h3>
                        <p className="text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                          คุณสามารถนำเข้ารายการยาจากไฟล์ <span className="text-emerald-600 font-black">CSV</span> หรือ <span className="text-emerald-600 font-black">Excel</span> ได้ในครั้งเดียว
                        </p>
                      </div>
                      <div className="flex gap-4 justify-center">
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex-1">
                          <span className="text-3xl block mb-2">📄</span>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">CSV Format</span>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex-1">
                          <span className="text-3xl block mb-2">📊</span>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Excel Format</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {importTourStep === 1 && (
                    <div className="w-full space-y-6 text-left">
                      <h3 className="text-2xl font-black text-slate-800 text-center mb-8">โครงสร้างคอลัมน์ที่ต้องการ</h3>
                      <div className="grid gap-3">
                        {[
                          { icon: '🇹🇭', title: 'ชื่อยา (ไทย)', desc: 'เช่น "พาราเซตามอล"' },
                          { icon: '🇺🇸', title: 'ชื่อยา (อังกฤษ)', desc: 'เช่น "Paracetamol"' },
                          { icon: '🏢', title: 'ยี่ห้อ (manufacturer)', desc: 'จำเป็นต้องระบุ' },
                          { icon: '💰', title: 'ราคา', desc: 'ระบุเป็นตัวเลขเท่านั้น' }
                        ].map((col, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 transition-all duration-300">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">{col.icon}</div>
                            <div>
                              <div className="font-black text-slate-800">{col.title}</div>
                              <div className="text-xs font-bold text-slate-400 opacity-80">{col.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importTourStep === 2 && (
                    <div className="space-y-6">
                      <div className="text-6xl">💡</div>
                      <h3 className="text-2xl font-black text-slate-800">จำแนกยาตามยี่ห้อ</h3>
                      <p className="text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                        หากยาชื่อเดียวกันแต่ <span className="text-indigo-600 font-black underline decoration-indigo-200 underline-offset-4">ยี่ห้อต่างกัน</span> ระบบจะสร้างรายการแยกจากกันโดยอัตโนมัติ เพื่อความแม่นยำในการคุมสต็อก
                      </p>
                      <div className="p-1 px-8 py-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <div className="flex items-center justify-between text-left gap-8">
                          <div>
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">รายการ A</span>
                            <div className="font-black text-slate-800">พาราเซตามอล</div>
                            <div className="text-xs font-bold text-slate-400">ยี่ห้อ: ยา ดี</div>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md font-black text-slate-300">VS</div>
                          <div>
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">รายการ B</span>
                            <div className="font-black text-slate-800">พาราเซตามอล</div>
                            <div className="text-xs font-bold text-slate-400">ยี่ห้อ: ยา สุข</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {importTourStep === 3 && (
                    <div className="space-y-6">
                      <div className="text-6xl animate-bounce">📦</div>
                      <h3 className="text-2xl font-black text-slate-800">ขั้นตอนสุดท้าย</h3>
                      <p className="text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                        หลังนำเข้าข้อมูลพื้นฐานเสร็จแล้ว <span className="text-rose-500 font-black">อย่าลืม!</span> เข้าไปเพิ่มข้อมูล Lot/สต็อก และวันหมดอายุของแต่ละรายการที่นำเข้า
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {['ระบุจำนวน', 'ระบุวันผลิต', 'ระบุวันหมดอายุ'].map((t, i) => (
                          <div key={i} className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-[10px] font-black text-rose-500 uppercase tracking-tight">{t}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-12 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map(step => (
                      <button
                        key={step}
                        onClick={() => setImportTourStep(step)}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          importTourStep === step ? 'w-8 bg-emerald-500' : 'w-2.5 bg-slate-200 hover:bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3">
                    {importTourStep > 0 && (
                      <button
                        onClick={() => setImportTourStep(importTourStep - 1)}
                        className="px-6 py-3 text-slate-400 font-black hover:text-slate-600 transition-colors"
                      >ย้อนกลับ</button>
                    )}
                    {importTourStep < 3 ? (
                      <button
                        onClick={() => setImportTourStep(importTourStep + 1)}
                        className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all active:scale-95"
                      >ถัดไป</button>
                    ) : (
                      <button
                        onClick={() => { setImportTourClosing(true); setTimeout(() => { setImportTourOpen(false); setImportTourClosing(false); }, 300); }}
                        className="px-8 py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all active:scale-95 animate-pulse"
                      >เริ่มใช้งานเลย 🚀</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
