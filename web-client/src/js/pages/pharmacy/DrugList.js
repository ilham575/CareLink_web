import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { API, fetchWithAuth } from '../../../utils/apiConfig';
import '../../../css/pages/default/drugsPage.css';

/* eslint-disable no-undef */

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  } catch (e) {
    return dateStr;
  }
}

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
  const [showModal, setShowModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState(null);
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
  const [importFile, setImportFile] = useState(null);
  // separate CSV and XLSX states
  const [csvFile, setCsvFile] = useState(null);
  const [xlsxRecords, setXlsxRecords] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: [] });
  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    description: '',
    price: ''
  });

  const token = localStorage.getItem('jwt');

  useEffect(() => {
    const timestamp = Date.now();
    console.log('DEBUG: Starting to fetch data for store ID:', id);
    // fetch store info for header (keep full data so we have numeric id)
    fetch(API.drugStores.getById(id), {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      }
    })
      .then(res => res.json())
      .then(data => {
        // store the full data object (contains .id and .attributes)
        if (data && data.data) setStore(data.data);
      })
      .catch(() => {})
      .finally(() => {});

    // fetch drugs list
    fetch(API.drugs.listWithBatches(), {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log('DEBUG: Raw API response for drugs:', data);
        const items = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
        console.log('DEBUG: Items array length:', items.length);
        items.forEach((it, idx) => {
          try { console.log(`DEBUG: item[${idx}] keys:`, Object.keys(it)); } catch(e){}
          try { console.log(`DEBUG: item[${idx}] attributes:`, it.attributes); } catch(e){}
          try { console.log(`DEBUG: item[${idx}] full:`, JSON.stringify(it)); } catch(e){}
        });
        // normalize to merge id with attributes when present.
        // Some responses already return flattened objects (no `attributes`),
        // so keep the object as-is in that case to preserve `drug_store`.
        const normalized = items.map(i => {
          if (i && i.attributes) return { id: i.id, ...i.attributes };
          // sometimes the API already returns flattened object under i (no attributes)
          // log keys for debugging
          return i;
        });
        console.log('DEBUG: After normalize - sample:', normalized.slice(0,3));
        console.log('DEBUG: Normalized drugs:', normalized);
        // filter by relation `drug_store` matching route param `id`
        const filtered = normalized.filter(d => matchesStore(d, storeDocumentId));
        console.log('DEBUG: Filtered drugs for store', id, ':', filtered);
        setDrugs(filtered);
        console.log('DEBUG: Drugs set to state:', filtered);
      })
      .catch((err) => {
        console.error('Error fetching drugs', err);
        toast.error('ไม่สามารถโหลดรายการยาได้');
        setDrugs([]);
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  // --- CSV import helpers ---
  const downloadTemplate = () => {
    // default: download CSV template
    return downloadTemplateAs('csv');
  };

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
      toast.error('ไม่สามารถสร้างไฟล์ Excel ได้ — ตรวจสอบว่าได้ติดตั้งไลบรารี xlsx');
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    setCsvFile(f || null);
  };

  // handle .xlsx files using SheetJS if selected
  const handleFileChangeAdvanced = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) { setImportFile(null); return; }
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
          toast.error('ไฟล์ Excel ไม่มีข้อมูลที่อ่านได้');
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
        toast.info(`อ่านไฟล์ Excel เรียบร้อย พบ ${records.length} แถว`);
      } catch (err) {
        console.error('Failed to parse xlsx', err);
        toast.error('ไม่สามารถอ่านไฟล์ Excel ได้ — ดู Console สำหรับรายละเอียด');
        setXlsxRecords(null);
      }
    } else {
      // when a non-xlsx file is selected here, fall back to csvFile
      setCsvFile(f || null);
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
    if (!records || records.length === 0) return toast.info('ไม่มีข้อมูลที่จะนำเข้า');
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
      setImportProgress(prev => ({ ...prev, done }));
    }

    setImportProgress(prev => ({ ...prev, errors }));
    if (errors.length === 0) {
      toast.success(`นำเข้าเรียบร้อย ${done} รายการ`);
    } else {
      toast.warn(`นำเข้าเสร็จ แต่มีข้อผิดพลาด ${errors.length} รายการ`);
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
      const timestamp = Date.now();
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
    if (!csvFile) return toast.info('กรุณาเลือกไฟล์ CSV ก่อน');
    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);
      if (rows.length < 2) return toast.error('ไฟล์ว่างหรือไม่มีข้อมูล');
      const header = rows[0].map(h => h.trim());
      const records = rows.slice(1).map(r => {
        const obj = {};
        for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] !== undefined ? r[j].trim() : '';
        return obj;
      }).filter(rec => Object.values(rec).some(v => v !== ''));
      await importRecords(records);
    } catch (e) {
      console.error('CSV import failed', e);
      toast.error('นำเข้า CSV ล้มเหลว');
      setImporting(false);
    }
  };

  // triggers import for previously parsed xlsxRecords
  const handleImportXLSX = async () => {
    if (!xlsxRecords || xlsxRecords.length === 0) return toast.info('กรุณาเลือกไฟล์ Excel ก่อนและตรวจสอบข้อมูล');
    await importRecords(xlsxRecords);
  };

  const filteredDrugs = drugs.filter(d => {
    if (!expiryFilterMonths) return true;
    const expiry = d.expiry_date;
    if (!expiry) return false;
    const expireDate = new Date(expiry);
    const now = new Date();
    const limit = new Date();
    limit.setMonth(limit.getMonth() + expiryFilterMonths);
    const inRange = expireDate <= limit && expireDate >= now;
    console.log('DEBUG: Drug', d.id, 'expiry check:', { expiry, expireDate, now, limit, inRange });
    return inRange;
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
          const keyBefore = editingKey;
          const updated = result && result.data ? { id: result.data.id, ...result.data.attributes } : result;
          setDrugs(current => {
            const next = current.map(d => (getDrugKey(d) === keyBefore ? updated : d));
            console.log('DEBUG: Drugs state after update:', next);
            return next;
          });
          toast.success('แก้ไขรายการยาสำเร็จ');
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
          const created = { id: result.data.id, ...result.data.attributes };
          setDrugs(current => {
            const next = [...current, created];
            console.log('DEBUG: Drugs state after add:', next);
            return next;
          });
          toast.success('เพิ่มรายการยาสำเร็จ');
        } else {
          throw new Error('Failed to add drug');
        }
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving drug:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
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
          toast.success('ลบรายการยาสำเร็จ');
        } else {
          throw new Error('Failed to delete drug');
        }
      } catch (error) {
        console.error('Error deleting drug:', error);
        toast.error('เกิดข้อผิดพลาดในการลบข้อมูล');
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
    if (!editingDrug) return toast.error('ไม่พบข้อมูลยา');
    try {
      const batchPayload = {
        lot_number: batchFormData.lot_number,
        quantity: parseInt(batchFormData.quantity) || 0,
        date_produced: batchFormData.date_produced || null,
        expiry_date: batchFormData.expiry_date || null,
        drug: getDrugKey(editingDrug)
      };

      let response;
      if (editingBatch) {
        // Update batch
        const batchId = editingBatch.id || editingBatch.documentId;
        response = await fetch(API.drugBatches.update(batchId), {
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
      
      toast.success(editingBatch ? 'แก้ไข Lot สำเร็จ' : 'เพิ่ม Lot สำเร็จ');
      setBatchModalOpen(false);
      
      // Refetch drugs to get updated batches
      const timestamp = Date.now();
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
      toast.error('เกิดข้อผิดพลาดในการบันทึก Lot');
    }
  };

  const handleDeleteBatch = (batchId, drugId) => {
    openConfirm('ยืนยันการลบ Lot', 'คุณต้องการลบ Lot นี้หรือไม่?', async () => {
      try {
        const response = await fetch(API.drugBatches.delete(batchId), {
          method: 'DELETE',
          headers: { ...(token && { Authorization: `Bearer ${token}` }) }
        });
        if (!response.ok) throw new Error('ไม่สามารถลบ Lot ได้');
        
        toast.success('ลบ Lot สำเร็จ');
        
        // Refetch drugs
        const timestamp = Date.now();
        const listRes = await fetch(API.drugs.listWithBatches(), {
          headers: { ...(token && { Authorization: `Bearer ${token}` }) }
        });
        const listJson = await listRes.json();
        const items = Array.isArray(listJson.data) ? listJson.data : (listJson.data ? [listJson.data] : []);
        const normalized = items.map(i => i && i.attributes ? { id: i.id, ...i.attributes } : i);
        const filtered = normalized.filter(d => matchesStore(d, storeDocumentId));
        setDrugs(filtered);
      } catch (error) {
        console.error('Error deleting batch:', error);
        toast.error('เกิดข้อผิดพลาดในการลบ Lot');
      }
    });
  };

  return (
    <div className="app-container drugs-page">
      <ToastContainer />
      <HomeHeader onSearch={() => {}} isLoggedIn={true} />
      <main className="main-content drugs-main">
        <div className="drugs-header">
          <h2 className="store-title">{store?.attributes?.name_th || 'รายการยา'}</h2>
          <div className="drugs-actions">
            <button className="btn small primary" onClick={() => navigate(-1)}>กลับ</button>
            <button className="btn small primary" onClick={() => handleOpenModal()}>เพิ่มรายการยาใหม่</button>
          </div>
        </div>

        <div className="drugs-controls">
          <span className="label">ยาหมดอายุ</span>
          <button className={`pill ${expiryFilterMonths===3? 'active':''}`} onClick={() => setExpiryFilterMonths(expiryFilterMonths===3? null:3)}>3 เดือน</button>
          <button className={`pill ${expiryFilterMonths===6? 'active':''}`} onClick={() => setExpiryFilterMonths(expiryFilterMonths===6? null:6)}>6 เดือน</button>
          <div className="import-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input id="csvFileInput" type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
            <label htmlFor="csvFileInput" className="btn small">เลือกไฟล์ CSV</label>
            <button className="btn small" onClick={handleImportCSV} disabled={!csvFile || importing}>{importing ? `กำลังนำเข้า (${importProgress.done}/${importProgress.total || '?'})` : 'นำเข้า CSV'}</button>

            <input id="xlsxFileInput" type="file" accept=".xlsx,.xls" onChange={handleFileChangeAdvanced} style={{ display: 'none' }} />
            <label htmlFor="xlsxFileInput" className="btn small">เลือกไฟล์ Excel</label>
            <button className="btn small" onClick={handleImportXLSX} disabled={!xlsxRecords || importing}>{importing ? `กำลังนำเข้า (${importProgress.done}/${importProgress.total || '?'})` : 'นำเข้า Excel'}</button>

            <button className="btn small" onClick={() => downloadTemplateAs('csv')}>ดาวน์โหลดเทมเพลต (CSV)</button>
            <button className="btn small" onClick={() => downloadTemplateAs('xlsx')}>ดาวน์โหลดเทมเพลต (Excel)</button>
          </div>
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
                              <td data-label="ชื่อยา" className="drug-name">{drug.name_th || drug.name_en || '-'}</td>
                              <td data-label="ข้อบ่งใช้" className="drug-use">{drug.description || '-'}</td>
                              <td data-label="ราคา">{drug.price ? `${drug.price} ฿` : '-'}</td>
                              <td data-label="Lot & สต็อก">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{drug.drug_batches?.length || 0} lot</span>
                                  <button 
                                    onClick={() => setExpandedDrugId(expandedDrugId === getDrugKey(drug) ? null : getDrugKey(drug))}
                                    style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}
                                  >
                                    {expandedDrugId === getDrugKey(drug) ? '▼' : '▶'}
                                  </button>
                                </div>
                              </td>
                              <td data-label="การดำเนินการ">
                                <div className="action-buttons">
                                  <button className="btn-action edit" onClick={() => handleOpenModal(drug)}>แก้ไข</button>
                                  <button className="btn-action delete" onClick={() => handleDelete(getDrugKey(drug))}>ลบ</button>
                                </div>
                              </td>
                            </tr>
                            {expandedDrugId === getDrugKey(drug) && (
                              <tr style={{ background: '#f9f9f9' }}>
                                <td colSpan="5">
                                  <div style={{ padding: '15px' }}>
                                    <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>📦 รายละเอียด Lot</div>
                                    {drug.drug_batches && drug.drug_batches.length > 0 ? (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>Lot</th>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>จำนวน</th>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>ผลิต</th>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>หมดอายุ</th>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>การดำเนินการ</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {drug.drug_batches.map(batch => {
                                            const batchData = batch.attributes ? { id: batch.id, ...batch.attributes } : batch;
                                            return (
                                              <tr key={batchData.id || batchData.documentId} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '8px' }}>{batchData.lot_number || '-'}</td>
                                                <td style={{ padding: '8px' }}>{batchData.quantity || 0} แผง</td>
                                                <td style={{ padding: '8px' }}>{formatDate(batchData.date_produced)}</td>
                                                <td style={{ padding: '8px' }}>{formatDate(batchData.expiry_date)}</td>
                                                <td style={{ padding: '8px' }}>
                                                  <button 
                                                    className="btn-action edit"
                                                    style={{ marginRight: '5px', padding: '4px 8px', fontSize: '11px' }}
                                                    onClick={() => {
                                                      setEditingBatch(batchData);
                                                      setBatchFormData({
                                                        lot_number: batchData.lot_number || '',
                                                        quantity: String(batchData.quantity || ''),
                                                        date_produced: batchData.date_produced ? batchData.date_produced.split('T')[0] : '',
                                                        expiry_date: batchData.expiry_date ? batchData.expiry_date.split('T')[0] : ''
                                                      });
                                                      setBatchModalOpen(true);
                                                    }}
                                                  >
                                                    แก้ไข
                                                  </button>
                                                  <button 
                                                    className="btn-action delete"
                                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                                    onClick={() => handleDeleteBatch(batchData.id || batchData.documentId, getDrugKey(drug))}
                                                  >
                                                    ลบ
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <p style={{ color: '#999' }}>ไม่มี Lot</p>
                                    )}
                                    <button 
                                      className="btn small primary" 
                                      style={{ marginTop: '10px' }}
                                      onClick={() => {
                                        setEditingBatch(null);
                                        setBatchFormData({
                                          lot_number: '',
                                          quantity: '',
                                          date_produced: '',
                                          expiry_date: ''
                                        });
                                        // Store which drug we're adding a batch to
                                        setEditingDrug(drug);
                                        setBatchModalOpen(true);
                                      }}
                                    >
                                      + เพิ่ม Lot ใหม่
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
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

        {/* Batch Modal */}
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
                      type="date"
                      value={batchFormData.date_produced}
                      onChange={(e) => setBatchFormData({ ...batchFormData, date_produced: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>วันหมดอายุ</label>
                    <input
                      type="date"
                      value={batchFormData.expiry_date}
                      onChange={(e) => setBatchFormData({ ...batchFormData, expiry_date: e.target.value })}
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
