import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { API } from '../../../utils/apiConfig';
import '../../../css/pages/default/drugsPage.css';

/* eslint-disable no-undef */

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
  const [showModal, setShowModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
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
  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    description: '',
    price: ''
  });

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
      'name_th',
      'name_en',
      'description',
      'price'
    ];
    const sample = ['ตัวอย่างชื่อไทย','sample name','คำอธิบายตัวอย่าง','100'];

    if (type === 'csv') {
      const csv = [header.join(','), sample.map(s => `"${String(s).replace(/"/g,'""')}"`).join(',')].join('\n');
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
      const aoa = [header, sample];
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
    for (const rec of records) {
      const payload = {
        name_th: rec.name_th || '',
        name_en: rec.name_en || '',
        description: rec.description || '',
        price: (rec.price !== undefined && rec.price !== null && String(rec.price).trim() !== '') ? String(rec.price) : null,
        drug_store: storeRelationId
      };
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
      try {
        const header = Object.keys(records[0] || {}).join(',');
        const lines = [header];
        for (const eItem of errors) {
          const row = header.split(',').map(h => `"${String(eItem.rec[h]||'').replace(/"/g,'""')}"`).join(',');
          lines.push(row);
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drug_import_errors.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Failed to generate error CSV', e);
      }
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
      setEditingDrug(drug);
      setFormData({
        name_th: drug.name_th || '',
        name_en: drug.name_en || '',
        description: drug.description || '',
        price: drug.price ? String(drug.price) : ''
      });
    } else {
      setEditingDrug(null);
      setFormData({
        name_th: '',
        name_en: '',
        description: '',
        price: ''
      });
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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // prefer documentId for relation (use documentId only)
      const storeRelationId = (store && store.attributes && store.attributes.documentId) ? store.attributes.documentId : id;
      const drugData = {
        ...formData,
        drug_store: storeRelationId, // set the store relation by numeric id when possible
        price: formData.price || null
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
        // Add new drug
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
          showSuccess('เพิ่มรายการยาสำเร็จ');
          
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
    <div className="app-container drugs-page">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick={false}
        closeButton={false}
        pauseOnHover
        draggable={false}
        pauseOnFocusLoss={true}
        limit={3}
      />
      <HomeHeader pharmacyName={store?.attributes?.name_th || store?.name_th} onSearch={() => {}} isLoggedIn={true} />
      <main className="main-content drugs-main">
        <div className="drugs-header">
          <h2 className="store-title">{store?.attributes?.name_th || 'รายการยา'}</h2>
          <div className="drugs-actions">
            <button className="btn small primary" onClick={() => navigate(-1)}>กลับ</button>
            <button className="btn small" onClick={handleDeleteSelected} disabled={selectedIds.length===0} style={{ marginLeft: 8 }}>{selectedIds.length>0?`ลบที่เลือก (${selectedIds.length})`:'ลบที่เลือก'}</button>
            <button className="btn small primary" onClick={() => handleOpenModal()} style={{ marginLeft: 8 }}>เพิ่มรายการยาใหม่</button>
          </div>
        </div>

        <div className="drugs-controls">
          <div className="tabs" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`pill ${activeTab === 'expiry' ? 'active' : ''}`}
              onClick={() => setActiveTab('expiry')}
            >
              ยาหมดอายุ
            </button>
            <button
              className={`pill ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              นำเข้า / เทมเพลต
            </button>
          </div>

          {activeTab === 'expiry' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
              <span className="label">กรอง</span>
              <button className={`pill ${expiryFilterMonths===3? 'active':''}`} onClick={() => setExpiryFilterMonths(expiryFilterMonths===3? null:3)}>3 เดือน</button>
              <button className={`pill ${expiryFilterMonths===6? 'active':''}`} onClick={() => setExpiryFilterMonths(expiryFilterMonths===6? null:6)}>6 เดือน</button>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="import-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="csvFileInput" type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
              <label htmlFor="csvFileInput" className="btn small">เลือกไฟล์ CSV</label>
              {csvFileName ? <span style={{ marginLeft: 8, color: '#444', fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{csvFileName}</span> : null}
              <button className="btn small" onClick={handleImportCSV} disabled={!csvFile || importing} style={{ marginLeft: 8 }}>{importing ? `กำลังนำเข้า (${importProgress.done}/${importProgress.total || '?'})` : 'นำเข้า CSV'}</button>

              <input id="xlsxFileInput" type="file" accept=".xlsx,.xls" onChange={handleFileChangeAdvanced} style={{ display: 'none' }} />
              <label htmlFor="xlsxFileInput" className="btn small">เลือกไฟล์ Excel</label>
              {xlsxFileName ? <span style={{ marginLeft: 8, color: '#444', fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{xlsxFileName}</span> : null}
              <button className="btn small" onClick={handleImportXLSX} disabled={!xlsxRecords || importing} style={{ marginLeft: 8 }}>{importing ? `กำลังนำเข้า (${importProgress.done}/${importProgress.total || '?'})` : 'นำเข้า Excel'}</button>

              <button className="btn small" onClick={() => downloadTemplateAs('csv')}>ดาวน์โหลดเทมเพลต (CSV)</button>
              <button className="btn small" onClick={() => downloadTemplateAs('xlsx')}>ดาวน์โหลดเทมเพลต (Excel)</button>
            </div>
          )}
        </div>

        <div className="drugs-table-wrap">
          {loading ? (
            <div className="empty">กำลังโหลดรายการยา...</div>
          ) : filteredDrugs.length === 0 ? (
            <div className="empty">ไม่พบรายการยา</div>
          ) : (
            <table className="drugs-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" onChange={toggleSelectAll} checked={filteredDrugs.length>0 && selectedIds.length===filteredDrugs.map(d=>getDrugKey(d)).filter(Boolean).length} />
                  </th>
                  <th>ชื่อยา</th>
                  <th>ข้อบ่งใช้</th>
                  <th>ราคา</th>
                  <th>Lot & สต็อก</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                        {filteredDrugs.map((drug, idx) => (
                          <React.Fragment key={getDrugKey(drug) || idx}>
                            <tr>
                              <td>
                                <input type="checkbox" checked={selectedIds.includes(getDrugKey(drug))} onChange={() => toggleSelection(getDrugKey(drug))} />
                              </td>
                              <td data-label="ชื่อยา" className="drug-name">{drug.name_th || drug.name_en || '-'}</td>
                              <td data-label="ข้อบ่งใช้" className="drug-use">{drug.description || '-'}</td>
                              <td data-label="ราคา">{drug.price ? `${drug.price} ฿` : '-'}</td>
                              <td data-label="Lot & สต็อก">
                                <button 
                                  className="btn-batch-details"
                                  onClick={() => { setBatchDetailsModalDrug(drug); setBatchDetailsModalOpen(true); }}
                                >
                                  📦 {drug.drug_batches?.length || 0} lot
                                </button>
                              </td>
                              <td data-label="การดำเนินการ">
                                <div className="action-buttons">
                                  <button className="btn-action edit" onClick={() => handleOpenModal(drug)}>แก้ไข</button>
                                  <button className="btn-action delete" onClick={() => handleDelete(getDrugKey(drug))}>ลบ</button>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
              </tbody>
            </table>
          )}
        </div>

        {(showModal || showModalClosing) && (
          <div className={`modal-overlay ${showModalClosing ? 'closing' : 'show'}`} onClick={handleCloseModal}>
            <div className={`modal-content ${showModalClosing ? 'closing' : 'show'}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingDrug ? 'แก้ไขรายการยา' : 'เพิ่มรายการยาใหม่'}</h3>
                <button className="modal-close" onClick={handleCloseModal}>×</button>
              </div>
              <form onSubmit={handleSubmit} className="drug-form">
                <div className="form-group">
                  <label>ชื่อยา (ไทย)</label>
                  <input
                    type="text"
                    name="name_th"
                    value={formData.name_th}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>ชื่อยา (อังกฤษ)</label>
                  <input
                    type="text"
                    name="name_en"
                    value={formData.name_en}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>ข้อบ่งใช้</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>ราคา (฿)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn secondary" onClick={handleCloseModal}>ยกเลิก</button>
                  <button type="submit" className="btn primary">{editingDrug ? 'แก้ไข' : 'เพิ่ม'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {(confirmDialog.visible || confirmDialog.closing) && (
          <div className={`modal-overlay ${confirmDialog.closing ? 'closing' : 'show'}`} onClick={closeConfirm}>
            <div className={`modal-content ${confirmDialog.closing ? 'closing' : 'show'}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{confirmDialog.title || 'ยืนยัน'}</h3>
                <button className="modal-close" onClick={closeConfirm}>×</button>
              </div>
              <div style={{ padding: '1rem' }}>
                <p>{confirmDialog.message || ''}</p>
              </div>
              <div className="form-actions" style={{ justifyContent: 'flex-end', padding: '0 1rem 1rem' }}>
                <button type="button" className="btn secondary" onClick={closeConfirm}>ยกเลิก</button>
                <button type="button" className="btn danger" onClick={() => { closeConfirm(); if (confirmDialog.onConfirm) confirmDialog.onConfirm(); }} style={{ marginLeft: 8 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Details Modal - Beautiful Display */}
        {(batchDetailsModalOpen && batchDetailsModalDrug) && (
          <div className={`modal-overlay batch-details-overlay show`} onClick={() => setBatchDetailsModalOpen(false)}>
            <div className={`batch-details-modal show`} onClick={(e) => e.stopPropagation()}>
              <div className="batch-details-header">
                <div className="batch-details-title-section">
                  <h2>📦 รายละเอียด Lot</h2>
                  <p className="batch-drug-name">{batchDetailsModalDrug.name_th || batchDetailsModalDrug.name_en}</p>
                </div>
                <button className="batch-details-close" onClick={() => setBatchDetailsModalOpen(false)}>×</button>
              </div>

              <div className="batch-details-content">
                {batchDetailsModalDrug.drug_batches && batchDetailsModalDrug.drug_batches.length > 0 ? (
                  <div className="batch-list">
                    {batchDetailsModalDrug.drug_batches.map((batch, idx) => {
                      const batchData = batch.attributes ? { id: batch.id, ...batch.attributes } : batch;
                      return (
                        <div key={batchData.id || batchData.documentId || idx} className="batch-card">
                          <div className="batch-card-header">
                            <div className="batch-lot-info">
                              <span className="batch-lot-number">{batchData.lot_number}</span>
                              <span className="batch-quantity">📦 {batchData.quantity || 0} แผง</span>
                            </div>
                            <div className="batch-card-actions">
                              <button 
                                className="batch-btn-edit"
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
                                title="แก้ไข Lot นี้"
                              >
                                ✏️
                              </button>
                              <button 
                                className="batch-btn-delete"
                                onClick={() => {
                                  setBatchDetailsModalOpen(false);
                                  handleDeleteBatch(getBatchDocumentId(batchData), getDrugKey(batchDetailsModalDrug));
                                }}
                                title="ลบ Lot นี้"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          <div className="batch-card-dates">
                            <div className="batch-date-item">
                              <label>📅 วันที่ผลิต</label>
                              <span>{formatDate(batchData.date_produced) || '-'}</span>
                            </div>
                            <div className="batch-date-item">
                              <label>⏰ วันหมดอายุ</label>
                              <span className={`expiry-date ${batchData.expiry_date && new Date(batchData.expiry_date) < new Date() ? 'expired' : batchData.expiry_date && new Date(batchData.expiry_date) < new Date(Date.now() + 90*24*60*60*1000) ? 'expiring-soon' : ''}`}>
                                {formatDate(batchData.expiry_date) || '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="batch-empty-state">
                    <p>📭 ไม่มี Lot สำหรับรายการยานี้</p>
                  </div>
                )}
              </div>

              <div className="batch-details-footer">
                <button 
                  className="btn-add-batch"
                  onClick={() => {
                    setEditingBatch(null);
                    setBatchFormData({
                      lot_number: '',
                      quantity: '',
                      date_produced: '',
                      expiry_date: ''
                    });
                    setEditingDrug(batchDetailsModalDrug);
                    setBatchDetailsModalOpen(false);
                    setBatchModalOpen(true);
                  }}
                >
                  ➕ เพิ่ม Lot ใหม่
                </button>
                <button 
                  className="btn-close-modal"
                  onClick={() => setBatchDetailsModalOpen(false)}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Add/Edit Modal */}
        {(batchModalOpen) && (
          <div className={`modal-overlay show`} onClick={() => setBatchModalOpen(false)}>
            <div className={`modal-content show`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingBatch ? 'แก้ไข Lot' : 'เพิ่ม Lot ใหม่'}</h3>
                <button className="modal-close" onClick={() => setBatchModalOpen(false)}>×</button>
              </div>
              <form onSubmit={handleSaveBatch} className="drug-form">
                <div className="form-group">
                  <label>Lot Number</label>
                  <input
                    type="text"
                    value={batchFormData.lot_number}
                    onChange={(e) => setBatchFormData({ ...batchFormData, lot_number: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>จำนวน (แผง/หลอด)</label>
                  <input
                    type="number"
                    value={batchFormData.quantity}
                    onChange={(e) => setBatchFormData({ ...batchFormData, quantity: e.target.value })}
                    min="0"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>วันที่ผลิต</label>
                    <input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={batchFormData.date_produced}
                      onChange={(e) => setBatchFormData({ ...batchFormData, date_produced: formatDateInputValue(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>วันหมดอายุ</label>
                    <input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={batchFormData.expiry_date}
                      onChange={(e) => setBatchFormData({ ...batchFormData, expiry_date: formatDateInputValue(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn secondary" onClick={() => setBatchModalOpen(false)}>ยกเลิก</button>
                  <button type="submit" className="btn primary">{editingBatch ? 'แก้ไข' : 'เพิ่ม'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
