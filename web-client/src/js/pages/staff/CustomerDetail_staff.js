import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import HomeHeader from '../../components/HomeHeader';
// Footer is rendered globally in App.js
import 'react-toastify/dist/ReactToastify.css';
import { Modal, Tabs } from 'antd';
import dayjs from 'dayjs';
import { API, fetchWithAuth } from '../../../utils/apiConfig';

// เพิ่มฟังก์ชันแปลงวันที่เป็นภาษาไทย
function formatThaiDate(dateStr) {
  if (!dateStr) return '';
  const months = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const d = dayjs(dateStr);
  if (!d.isValid()) return dateStr;
  const day = d.date();
  const month = months[d.month() + 1];
  const year = d.year() + 543;
  return `${day} ${month} ${year}`;
}

// Disable debug console.log calls in this file to keep console clean.
// If you need logs while developing, remove or comment out the following two lines.
// console._orig_log = console._orig_log || console.log;
// console.log = () => {};

function CustomerDetailStaff() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState(null);
  const [notification, setNotification] = useState(null);
  const [staffStatus, setStaffStatus] = useState({
    received: false,
    prepared: false,
    received_at: null,
    prepared_at: null,
    prepared_note: '',
    outOfStock: []
  });
  const [statusModal, setStatusModal] = useState({
    open: false,
    type: '', // 'received' | 'prepared' | 'outOfStock'
    note: '',
    selectedDrugs: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addDrugModal, setAddDrugModal] = useState({ 
    open: false, 
    availableDrugs: []
  });
  const [allergyDetailModal, setAllergyDetailModal] = useState({ 
    open: false, 
    allergies: [] 
  });
  const [activeTab, setActiveTab] = useState('1');
  // Track selected batch (lot) for each drug: { drugId: batchDocumentId }
  const [selectedBatches, setSelectedBatches] = useState({});

  const normalizeId = (value) => (value === undefined || value === null ? '' : String(value));

  const findDrugByDocumentId = (drugId) =>
    addDrugModal.availableDrugs.find((d) => normalizeId(d.documentId) === normalizeId(drugId));

  const findBatchInDrug = (drug, selectedBatchId) => {
    if (!drug || !Array.isArray(drug.drug_batches)) return null;
    return (
      drug.drug_batches.find(
        (b) => normalizeId(b.documentId) === normalizeId(selectedBatchId) || normalizeId(b.id) === normalizeId(selectedBatchId)
      ) || null
    );
  };

  const collectBatchRequirements = (batchSelection = selectedBatches) => {
    const requirementsMap = new Map();
    const missingSelections = [];
    const drugsWithBatches = [];

    for (const drugItem of customer?.prescribed_drugs || []) {
      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
      const quantity = Number(typeof drugItem === 'string' ? 1 : drugItem.quantity || 1);
      const drug = findDrugByDocumentId(drugId);

      if (!drug || !Array.isArray(drug.drug_batches) || drug.drug_batches.length === 0) continue;

      const drugName = drug.name_th || drug.name_en || drugId;
      drugsWithBatches.push({ drugId, drugName, quantity });

      const selectedBatchId = batchSelection?.[drugId];
      if (!selectedBatchId || String(selectedBatchId).trim() === '') {
        missingSelections.push({ drugId, drugName, quantity });
        continue;
      }

      const requirementKey = normalizeId(selectedBatchId);
      const prev = requirementsMap.get(requirementKey) || {
        selectedBatchId,
        requiredQuantity: 0,
        drugNames: [],
      };

      prev.requiredQuantity += quantity;
      if (!prev.drugNames.includes(drugName)) prev.drugNames.push(drugName);

      requirementsMap.set(requirementKey, prev);
    }

    return {
      drugsWithBatches,
      missingSelections,
      requirements: Array.from(requirementsMap.values()),
    };
  };

  const getLocalBatchInfo = (selectedBatchId) => {
    for (const drug of addDrugModal.availableDrugs || []) {
      const batch = findBatchInDrug(drug, selectedBatchId);
      if (batch) {
        return {
          identifier: batch.documentId || batch.id || selectedBatchId,
          lotNumber: batch.lot_number || selectedBatchId,
          availableQuantity: Number(batch.quantity || 0),
        };
      }
    }

    return null;
  };

  const fetchLatestBatchInfo = async (selectedBatchId, token) => {
    const headers = { Authorization: token ? `Bearer ${token}` : '' };

    try {
      const byIdRes = await fetch(API.drugBatches.getById(selectedBatchId), { method: 'GET', headers });
      if (byIdRes.ok) {
        const byIdData = await byIdRes.json();
        const batch = byIdData?.data;
        if (batch) {
          return {
            identifier: batch.documentId || batch.id || selectedBatchId,
            lotNumber: batch.lot_number || selectedBatchId,
            availableQuantity: Number(batch.quantity || 0),
          };
        }
      }
    } catch (_) {}

    try {
      const byDocRes = await fetch(API.drugBatches.getByDocumentId(selectedBatchId), { method: 'GET', headers });
      if (byDocRes.ok) {
        const byDocData = await byDocRes.json();
        const batch = Array.isArray(byDocData?.data) ? byDocData.data[0] : byDocData?.data;
        if (batch) {
          return {
            identifier: batch.documentId || batch.id || selectedBatchId,
            lotNumber: batch.lot_number || selectedBatchId,
            availableQuantity: Number(batch.quantity || 0),
          };
        }
      }
    } catch (_) {}

    return null;
  };

  const validateBatchStock = async (batchSelection = selectedBatches, options = {}) => {
    const { useLatest = false, token = '' } = options;
    const collected = collectBatchRequirements(batchSelection);
    const batchInfoByKey = {};
    const insufficient = [];

    if (collected.missingSelections.length > 0) {
      return {
        ...collected,
        insufficient,
        batchInfoByKey,
        ok: false,
      };
    }

    let resolvedInfos = [];
    if (useLatest) {
      resolvedInfos = await Promise.all(
        collected.requirements.map((req) => fetchLatestBatchInfo(req.selectedBatchId, token))
      );
    } else {
      resolvedInfos = collected.requirements.map((req) => getLocalBatchInfo(req.selectedBatchId));
    }

    collected.requirements.forEach((req, idx) => {
      const info = resolvedInfos[idx];
      const key = normalizeId(req.selectedBatchId);
      if (info) batchInfoByKey[key] = info;

      if (!info || info.availableQuantity < req.requiredQuantity) {
        insufficient.push({
          selectedBatchId: req.selectedBatchId,
          lotNumber: info?.lotNumber || req.selectedBatchId,
          availableQuantity: info?.availableQuantity ?? 0,
          requiredQuantity: req.requiredQuantity,
          drugNames: req.drugNames,
        });
      }
    });

    return {
      ...collected,
      insufficient,
      batchInfoByKey,
      ok: collected.drugsWithBatches.length > 0 && collected.missingSelections.length === 0 && insufficient.length === 0,
    };
  };

  const formatInsufficientStockMessage = (insufficientItems = []) => {
    if (!insufficientItems.length) return 'จำนวนยาใน LOT ไม่เพียงพอ';

    const first = insufficientItems[0];
    const firstLine = `LOT ${first.lotNumber} เหลือ ${first.availableQuantity} แต่ต้องใช้ ${first.requiredQuantity}`;

    if (insufficientItems.length === 1) {
      return `จำนวนยาไม่พอ: ${firstLine}`;
    }

    return `จำนวนยาไม่พอ: ${firstLine} และอีก ${insufficientItems.length - 1} LOT`;
  };

  // Refs to avoid stale closures in polling and event handlers
  const notificationRef = useRef(notification);
  const selectedBatchesRef = useRef(selectedBatches);
  const isSubmittingRef = useRef(false);
  
  useEffect(() => { notificationRef.current = notification; }, [notification]);
  useEffect(() => { selectedBatchesRef.current = selectedBatches; }, [selectedBatches]);
  
  // Get pharmacyId from URL params
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');
  const queryNotifId = searchParams.get('notifId');

  // Helper: get pharmacist name from pharmacy object
  const getPharmacistName = (pharmacyObj) => {
        if (!pharmacyObj) return '';

        // 1) If API populated staff_profiles, prefer staff with position 'pharmacist' (Thai/EN), else first staff
        if (Array.isArray(pharmacyObj.staff_profiles) && pharmacyObj.staff_profiles.length > 0) {
          // find pharmacist by position
          const pharmacist = pharmacyObj.staff_profiles.find(s => {
            const pos = (s.position || '').toString().toLowerCase();
            return pos.includes('เภสัช') || pos.includes('pharmac');
          }) || pharmacyObj.staff_profiles[0];

          const userName = pharmacist?.users_permissions_user?.full_name || pharmacist?.users_permissions_user?.username;
          if (userName) return userName;
        }

        // 2) If pharmacy has pharmacy_profiles that link to a user (owner/pharmacist), use it
        if (Array.isArray(pharmacyObj.pharmacy_profiles) && pharmacyObj.pharmacy_profiles.length > 0) {
          const p = pharmacyObj.pharmacy_profiles[0];
          const userName = p?.users_permissions_user?.full_name || p?.users_permissions_user?.username;
          if (userName) return userName;
        }

        // 3) Fallbacks: nested attributes or direct field
        const userFullName = pharmacyObj.users_permissions_user?.full_name || pharmacyObj.attributes?.users_permissions_user?.full_name;
        if (userFullName) return userFullName;
        return pharmacyObj.pharmacist_name || pharmacyObj.attributes?.pharmacist_name || '';
  };

  // Computed: Check if lots have been selected by user (not saved yet, just current selection)
  // Count how many drugs with batches have a valid and sufficient batch selected in the current UI
  const lotsSaved = (() => {
    const collected = collectBatchRequirements(selectedBatches);
    if (collected.drugsWithBatches.length === 0) return false;
    if (collected.missingSelections.length > 0) return false;

    return collected.requirements.every((req) => {
      const localInfo = getLocalBatchInfo(req.selectedBatchId);
      return !!localInfo && localInfo.availableQuantity >= req.requiredQuantity;
    });
  })();

  useEffect(() => {
    const loadCustomerData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const userDocumentId = localStorage.getItem('user_documentId');
        
        const isNotificationOnly = customerDocumentId.startsWith('notif_');

        if (isNotificationOnly) {
          // โหลด notification และสร้าง customer data สำหรับกรณี notification only
          const notificationId = customerDocumentId.replace('notif_', '');
          
          // โหลด staff profile
          const staffRes = await fetch(
            API.staffProfiles.getByUserAndStore(userDocumentId, pharmacyId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (!staffRes.ok) throw new Error('ไม่สามารถโหลดข้อมูล Staff ได้');

          const staffData = await staffRes.json();
          const staffProfile = staffData.data?.[0];

          if (!staffProfile) throw new Error('ไม่พบข้อมูล Staff Profile');

          // โหลด notification (use getByDocumentId — Strapi v5 expects documentId in path)
          const notifRes = await fetch(
            API.notifications.getByDocumentId(notificationId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (!notifRes.ok) throw new Error('ไม่สามารถโหลดข้อมูล Notification ได้');

          const notifData = await notifRes.json();
          const notif = notifData.data;

          // สร้าง customer data จาก notification
          const d = notif.data || {};
          const innerData = d.data || {}; // Snapshot nested data
          
          let full_name = innerData.full_name || d.full_name || d.name || d.patient_name || d.patient_full_name || 'ไม่ระบุ';
          if (full_name === 'ไม่ระบุ' && notif.message) {
            const match = notif.message.match(/ได้รับมอบหมายดูแลผู้ป่วย:\s*([^\n]+)/);
            if (match) {
              full_name = match[1].trim();
            }
          }

          const userObj = {
            full_name: full_name,
            phone: innerData.phone || d.phone || d.tel || d.mobile || '',
            email: innerData.email || d.email || ''
          };

          const tempCustomer = {
            documentId: customerDocumentId,
            users_permissions_user: userObj,
            Customers_symptoms: innerData.symptoms || d.symptoms || '',
            symptom_history: innerData.symptom_history || d.symptom_history || innerData.history || d.history || (typeof (innerData.symptoms || d.symptoms) === 'object' ? (innerData.symptoms || d.symptoms)?.history : ''),
            symptom_note: innerData.symptom_note || d.symptom_note || innerData.note || d.note || (typeof (innerData.symptoms || d.symptoms) === 'object' ? (innerData.symptoms || d.symptoms)?.note : ''),
            Allergic_drugs: (innerData.allergy || d.allergy) ? { allergy: innerData.allergy || d.allergy } : null,
            congenital_disease: innerData.disease || d.disease || '',
            Follow_up_appointment_date: innerData.follow_up_date || d.follow_up_date || innerData.appointment_date || d.appointment_date || null,
            prescribed_drugs: innerData.prescribed_drugs || d.prescribed_drugs || [],
            _fromNotificationOnly: true
          };

          setCustomer(tempCustomer);
          setNotification(notif);

          // อ่านสถานะจาก notification data

          if (notif?.staff_work_status) {
            if (notif.type === 'customer_assignment_update') {
              const preservedOOS = Array.isArray(notif.staff_work_status.outOfStock) ? notif.staff_work_status.outOfStock : [];
              const resetStatus = {
                received: false,
                prepared: false,
                received_at: null,
                prepared_at: null,
                prepared_note: '',
                outOfStock: preservedOOS,
                cancelled: false,
                cancelled_at: null,
                cancelled_note: ''
              };
              setStaffStatus(resetStatus);
              if (notif.staff_work_status.batches_selected) {
                setSelectedBatches(notif.staff_work_status.batches_selected);
              }
            } else {
              setStaffStatus(notif.staff_work_status);
              if (notif.staff_work_status.batches_selected) {
                setSelectedBatches(notif.staff_work_status.batches_selected);
              }
            }
          } else {
            // Initialize with empty status if not found
            setStaffStatus({
              received: false,
              prepared: false,
              received_at: null,
              prepared_at: null,
              prepared_note: '',
              outOfStock: [],
              cancelled: false,
              cancelled_at: null,
              cancelled_note: ''
            });
          }

        } else {
          // โหลด customer profile ตามปกติ
          const customerRes = await fetch(
            API.customerProfiles.getByIdBasic(customerDocumentId),
            {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            }
          );
          
          if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
          
          const customerData = await customerRes.json();
          setCustomer(customerData.data);
          
          // โหลดข้อมูล staff profile
          const staffRes = await fetch(
            API.staffProfiles.getByUserAndStore(userDocumentId, pharmacyId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (staffRes.ok) {
            const staffData = await staffRes.json();
            const staffProfile = staffData.data?.[0];

            if (staffProfile) {
              
              // โหลด notification ของลูกค้าคนนี้ที่ส่งมาให้ staff คนนี้
              // ค้นหาทั้งจาก customer_profile relation และจาก notification.data
              const notifRes = await fetch(
                API.notifications.list(`filters[staff_profile][documentId][$eq]=${staffProfile.documentId}&filters[type][$in][0]=customer_assignment&filters[type][$in][1]=customer_assignment_update&populate=*&sort[0]=createdAt:desc`),
                { headers: { Authorization: token ? `Bearer ${token}` : '' } }
              );

              if (notifRes.ok) {
                const notifData = await notifRes.json();
                
                // หา notification ที่ตรงกับ customer นี้
                // 1. ถ้ามี queryNotifId ให้หาที่ตรงกันก่อน (จากประวัติการเข้าพบ)
                let notif = null;
                if (queryNotifId) {
                  notif = notifData.data?.find(n => n.documentId === queryNotifId || String(n.id) === String(queryNotifId));
                }
                
                // 2. ถ้าไม่เจอ ลองหาจาก customer_profile relation
                if (!notif) {
                  notif = notifData.data?.find(n => n.customer_profile?.documentId === customerDocumentId);
                }
                
                // 3. ถ้ายังไม่เจอ ลองหาจาก customer name/phone ใน notification.data
                if (!notif && customerData?.data?.users_permissions_user) {
                  const customerName = customerData.data.users_permissions_user.full_name;
                  const customerPhone = customerData.data.users_permissions_user.phone;
                  
                  notif = notifData.data?.find(n => {
                    const d = n.data || {};
                    return (d.customer_name && d.customer_name === customerName) || (d.customer_phone && d.customer_phone === customerPhone);
                  });
                }
                
                // 4. ถ้ายังไม่เจอ ใช้ตัวล่าสุด
                if (!notif) {
                  notif = notifData.data?.[0];
                }
                
                setNotification(notif);

                // 🎉 NEW: Update customer state from notification snapshot if available
                if (notif && notif.data) {
                  const d = notif.data;
                  const innerData = d.data || {};
                  
                  setCustomer(prev => {
                    if (!prev) return prev;
                    const symptomsVal = innerData.symptoms || d.symptoms;
                    return {
                      ...prev,
                      Customers_symptoms: symptomsVal || prev.Customers_symptoms,
                      symptom_history: innerData.symptom_history || d.symptom_history || innerData.history || d.history || (typeof symptomsVal === 'object' ? symptomsVal?.history : prev.symptom_history),
                      symptom_note: innerData.symptom_note || d.symptom_note || innerData.note || d.note || (typeof symptomsVal === 'object' ? symptomsVal?.note : prev.symptom_note),
                      prescribed_drugs: innerData.prescribed_drugs || d.prescribed_drugs || prev.prescribed_drugs,
                      congenital_disease: innerData.disease || d.disease || prev.congenital_disease,
                      Allergic_drugs: (innerData.allergy || d.allergy) ? { allergy: innerData.allergy || d.allergy } : prev.Allergic_drugs,
                      Follow_up_appointment_date: innerData.follow_up_date || d.follow_up_date || innerData.appointment_date || d.appointment_date || prev.Follow_up_appointment_date
                    };
                  });
                }

                // อ่านสถานะจาก notification staff_work_status
                if (notif?.staff_work_status) {
                  // If this notification is an assignment update from the pharmacy,
                  // reset actionable status fields but preserve outOfStock.
                  // BUT: Only reset if staff hasn't acknowledged the update yet
                  if (notif.type === 'customer_assignment_update') {
                    const staffReceivedAt = notif.staff_work_status.received_at;
                    const staffPreparedAt = notif.staff_work_status.prepared_at;
                    const notifUpdatedAt = notif.updatedAt;
                    
                    // ถ้าพนักงานยืนยันรับข้อมูล หรือ จัดยาเสร็จ หลังจาก notification ถูกอัปเดต = ไม่ต้อง reset
                    // เช็คทั้ง received_at และ prepared_at เพราะถ้า prepared แล้ว แสดงว่าทำงานเสร็จแล้ว
                    const staffAcknowledgedUpdate = 
                      (staffPreparedAt && notifUpdatedAt && new Date(staffPreparedAt) >= new Date(notifUpdatedAt)) ||
                      (staffReceivedAt && notifUpdatedAt && new Date(staffReceivedAt) >= new Date(notifUpdatedAt));
                    
                    if (!staffAcknowledgedUpdate) {
                      const preservedOOS = Array.isArray(notif.staff_work_status.outOfStock) ? notif.staff_work_status.outOfStock : [];
                      const resetStatus = {
                        received: false,
                        prepared: false,
                        received_at: null,
                        prepared_at: null,
                        prepared_note: '',
                        outOfStock: preservedOOS,
                        cancelled: false,
                        cancelled_at: null,
                        cancelled_note: ''
                      };
                      setStaffStatus(resetStatus);
                    } else {
                      setStaffStatus(notif.staff_work_status);
                    }
                    if (notif.staff_work_status.batches_selected) {
                      setSelectedBatches(notif.staff_work_status.batches_selected);
                    }
                  } else {
                    setStaffStatus(notif.staff_work_status);
                    if (notif.staff_work_status.batches_selected) {
                      setSelectedBatches(notif.staff_work_status.batches_selected);
                    }
                  }
                } else {
                  // Initialize with empty status
                  setStaffStatus({
                    received: false,
                    prepared: false,
                    received_at: null,
                    prepared_at: null,
                    prepared_note: '',
                    outOfStock: [],
                    cancelled: false,
                    cancelled_at: null,
                    cancelled_note: ''
                  });
                }
              } else {
                // Initialize with empty status if no notification
                setStaffStatus({
                  received: false,
                  prepared: false,
                  received_at: null,
                  prepared_at: null,
                  prepared_note: '',
                  outOfStock: [],
                  cancelled: false,
                  cancelled_at: null,
                  cancelled_note: ''
                });
              }
            }
          }
        }
        
        // Load pharmacy data + drugs in parallel
        if (pharmacyId) {
          const authHeaders = { Authorization: token ? `Bearer ${token}` : '' };
          const [pharmacyRes, drugsRes] = await Promise.all([
            fetch(API.drugStores.getByDocumentId(pharmacyId), { headers: authHeaders }),
            fetch(API.drugs.listByStore(pharmacyId), { headers: authHeaders })
          ]);
          
          if (pharmacyRes.ok) {
            const pharmacyData = await pharmacyRes.json();
            const store = pharmacyData.data?.find(item => item.documentId === pharmacyId);
            setPharmacy(store);
          }
          if (drugsRes.ok) {
            const drugsData = await drugsRes.json();
            setAddDrugModal(prev => ({ ...prev, availableDrugs: drugsData.data }));
          }
        }
        
      } catch (error) {
        console.error('Error loading customer data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
      } finally {
        setLoading(false);
      }
    };

    if (customerDocumentId) {
      loadCustomerData();
    }
  }, [customerDocumentId, pharmacyId]);

  // ✅ NEW: Sync staffStatus whenever notification changes
  // This ensures that when notification is loaded/updated, staffStatus reflects the latest server state
  useEffect(() => {
    if (notification?.staff_work_status) {
      console.log('[EffectSync] Syncing staffStatus from notification:', notification.staff_work_status);
      setStaffStatus(notification.staff_work_status);
      
      // Also sync batches_selected if available, but NOT if user has local changes
      const serverBatches = notification.staff_work_status.batches_selected;
      if (serverBatches) {
        // Here, notification IS the source of truth we're comparing AGAINST, 
        // but this effect is triggered WHEN notification changes.
        // Usually, if this effect runs, it's either an initial load or a poll/socket update finished.
        // We still want to avoid overwriting if the user is in the middle of something.
        // However, if the notification *itself* just changed, we might have to be careful.
        
        // Let's use the same "isDirty" principle but we'll have to check against the PREVIOUS notification value?
        // Actually, just checking if the server value is different from local is enough to ATTEMPT an update,
        // but we only DO it if we are sure the user isn't mid-click.
        
        // Simplest: only auto-sync if local is currently empty OR user isn't focusing the tab? 
        // No, let's stick to the "Dirty" check against what we already have.
        setSelectedBatches(prev => {
          const isCurrentlyEmpty = Object.keys(prev || {}).length === 0;
          if (isCurrentlyEmpty) return serverBatches;
          
          // If not empty, only overwrite if we trust the new server value (not yet implemented fully)
          // For now, if notification just changed, we'll allow it if it's the first time for THIS notification
          return prev; 
        });
      }
    }
  }, [notification?.staff_work_status, notification?.documentId]);

  // Refresh notification when tab becomes visible (catch updates while tab was inactive)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && customerDocumentId && notification?.documentId) {
        console.log('[VisibilityChange] Staff tab visible, checking for updates...');
        
        try {
          const token = localStorage.getItem('jwt') || '';
          const notifRes = await fetch(
            API.notifications.getByDocumentId(notification.documentId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (notifRes.ok) {
            const notifData = await notifRes.json();
            const updatedNotif = notifData.data;
            
            if (updatedNotif?.staff_work_status) {
              setNotification(updatedNotif);
              setStaffStatus(updatedNotif.staff_work_status);
              
              // Sync batches_selected if available, only if not dirty
              if (updatedNotif.staff_work_status.batches_selected) {
                const serverBatches = updatedNotif.staff_work_status.batches_selected;
                const currentBatches = notificationRef.current?.staff_work_status?.batches_selected || {};
                const localBatches = selectedBatchesRef.current || {};
                
                const isDirty = JSON.stringify(localBatches) !== JSON.stringify(currentBatches);
                if (!isDirty) {
                  setSelectedBatches(serverBatches);
                }
              }
            }
          }
        } catch (err) {
          console.error('[VisibilityChange] Error refreshing notification:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [customerDocumentId, notification?.documentId]);

  // Socket.IO Connection for real-time notification updates
  const socketRef = useRef(null);

  // Effect: Reload notification every 5 seconds to catch updates from pharmacy
  // This ensures we subscribe to the latest notification (e.g., after update creates new one)
  // MODIFIED: Respect queryNotifId to prevent overwriting past rounds with latest
  useEffect(() => {
    if (!customerDocumentId) return;

    const reloadNotification = async () => {
      // Skip polling while a mutation (handleUpdateStatus) is in progress
      // to prevent stale data from overwriting optimistic UI updates
      if (isSubmittingRef.current) return;
      
      try {
        const token = localStorage.getItem('jwt') || '';
        const staffProfile = JSON.parse(localStorage.getItem('staff_profile') || '{}');
        
        let latestNotif = null;

        if (queryNotifId) {
           // Case 1: Specific Round - Lightweight status-only reload
           const notifRes = await fetch(
             API.notifications.getStatusOnly(queryNotifId),
             { headers: { Authorization: token ? `Bearer ${token}` : '' } }
           );
           if (notifRes.ok) {
              const resData = await notifRes.json();
              latestNotif = resData.data;
           }
        } else {
           // Case 2: Live View - Lightweight reload latest assignment status
           if (!staffProfile?.documentId) return;
           const notifRes = await fetch(
             API.notifications.getStaffAssignmentsLight(staffProfile.documentId, customerDocumentId),
             { headers: { Authorization: token ? `Bearer ${token}` : '' } }
           );
           if (notifRes.ok) {
             const notifData = await notifRes.json();
             latestNotif = notifData.data?.[0];
           }
        }
          
        if (latestNotif) {
            // Always update status from the reloaded notification data
            if (latestNotif.staff_work_status) {

              // console.log('[AutoReload] staff_work_status:', latestNotif.staff_work_status);
              
              setStaffStatus(latestNotif.staff_work_status);
              
              // 🔑 Sync batches_selected from notification, but ONLY if the user is not currently editing
              // Check if local selectedBatches matches the current notification's batches
              const currentNotifBatches = notificationRef.current?.staff_work_status?.batches_selected || {};
              const localBatches = selectedBatchesRef.current || {};
              const serverBatches = latestNotif.staff_work_status.batches_selected || {};
              
              const isDirty = JSON.stringify(localBatches) !== JSON.stringify(currentNotifBatches);
              
              if (serverBatches && !isDirty) {
                if (JSON.stringify(localBatches) !== JSON.stringify(serverBatches)) {
                   setSelectedBatches(serverBatches);
                }
              }
            }
            
            // Only update main notification state if ID changed (e.g. switch to newer notification in live mode)
            // or if we are forcing a deep reload
            if (latestNotif.documentId !== notificationRef.current?.documentId) {
              setNotification(latestNotif);
            }
        }
      } catch (err) {
        console.error('[AutoReload] Error reloading notification:', err);
      }
    };

    // Poll every 5 seconds (Socket.IO handles real-time updates)
    const interval = setInterval(reloadNotification, 5000);
    return () => clearInterval(interval);
  }, [customerDocumentId, queryNotifId]);

  useEffect(() => {
    if (!notification?.documentId) return;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:1337';
    const token = localStorage.getItem('jwt') || '';

    // Create socket connection
    socketRef.current = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 30,
      forceNew: false,
      rejectUnauthorized: false
    });

    // Handle connection
    socketRef.current.on('connect', () => {
      // Join rooms: by notification ID and by customer ID
      const notifRoom = `notification:${notification.documentId}`;
      const customerRoom = `customer:${customerDocumentId}`;
      
      socketRef.current.emit('join', notifRoom);
      socketRef.current.emit('join', customerRoom);
    });

    // Handle connection error (silent — reconnection handles recovery)
    socketRef.current.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error?.message);
    });

    // Handle disconnect
    socketRef.current.on('disconnect', (reason) => {
    });

    // Listen for notification updates
    socketRef.current.on('notification:update', (updatedNotif) => {
      if (!updatedNotif) return;

      // Always update notification state with the latest data
      setNotification(updatedNotif);

      // Sync customer state from notification data so drug list updates without page reload
      if (updatedNotif.data) {
        const d = updatedNotif.data;
        const innerData = d.data || {};
        const symptomsVal = innerData.symptoms || d.symptoms;
        setCustomer(prev => {
          if (!prev) return prev;
          const updates = {};
          const prescribed = innerData.prescribed_drugs || d.prescribed_drugs;
          if (prescribed !== undefined) updates.prescribed_drugs = prescribed;
          if (innerData.symptoms || d.symptoms) {
            updates.Customers_symptoms = typeof symptomsVal === 'object' ? symptomsVal?.main : (symptomsVal || prev.Customers_symptoms);
            updates.symptom_history = innerData.symptom_history || d.symptom_history || (typeof symptomsVal === 'object' ? symptomsVal?.history : undefined) || prev.symptom_history;
            updates.symptom_note = innerData.symptom_note || d.symptom_note || (typeof symptomsVal === 'object' ? symptomsVal?.note : undefined) || prev.symptom_note;
          }
          if (innerData.allergy || d.allergy) updates.Allergic_drugs = { allergy: innerData.allergy || d.allergy };
          if (innerData.disease || d.disease) updates.congenital_disease = innerData.disease || d.disease;
          if (innerData.appointment_date || d.appointment_date) updates.Follow_up_appointment_date = innerData.appointment_date || d.appointment_date;
          return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
        });
      }

      // Handle status reset for update notifications (preserve outOfStock)
      if (updatedNotif.type === 'customer_assignment_update') {
        // เช็คว่า staff acknowledged update นี้แล้วหรือยัง
        const staffReceivedAt = updatedNotif.staff_work_status?.received_at;
        const staffPreparedAt = updatedNotif.staff_work_status?.prepared_at;
        const notifUpdatedAt = updatedNotif.updatedAt;
        
        // ถ้าพนักงานยืนยันรับข้อมูล หรือ จัดยาเสร็จ หลังจาก notification ถูกอัปเดต = ไม่ต้อง reset
        const staffAcknowledgedUpdate = 
          (staffPreparedAt && notifUpdatedAt && new Date(staffPreparedAt) >= new Date(notifUpdatedAt) - 1000) ||
          (staffReceivedAt && notifUpdatedAt && new Date(staffReceivedAt) >= new Date(notifUpdatedAt) - 1000);
        
        if (!staffAcknowledgedUpdate) {
          const preservedOOS = Array.isArray(updatedNotif.staff_work_status?.outOfStock) 
            ? updatedNotif.staff_work_status.outOfStock 
            : [];
          const resetStatus = {
            received: false,
            prepared: false,
            received_at: null,
            prepared_at: null,
            prepared_note: '',
            outOfStock: preservedOOS,
            cancelled: false,
            cancelled_at: null,
            cancelled_note: ''
          };
          setStaffStatus(resetStatus);
          toast.success('🔄 เภสัชกรส่งข้อมูลอัพเดต - สถานะถูกรีเซ็ทแล้ว');
        } else {
          if (updatedNotif.staff_work_status) {
            setStaffStatus(updatedNotif.staff_work_status);
          }
        }
      } else {
        if (updatedNotif.staff_work_status) {
          setStaffStatus(updatedNotif.staff_work_status);
          // Only show toast if there's a real change (not initial load)
          if (notificationRef.current?.documentId === updatedNotif.documentId) {
            toast.info('🔄 ข้อมูลถูกอัพเดท');
          }
        }
      }

      if (updatedNotif.staff_work_status?.batches_selected) {
        const serverBatches = updatedNotif.staff_work_status.batches_selected;
        const currentBatches = notificationRef.current?.staff_work_status?.batches_selected || {};
        const localBatches = selectedBatchesRef.current || {};
        
        const isDirty = JSON.stringify(localBatches) !== JSON.stringify(currentBatches);
        if (!isDirty || (updatedNotif.documentId !== notificationRef.current?.documentId)) {
          // If not dirty, or if this is a completely different notification round, update it
          setSelectedBatches(serverBatches);
        }
      }
    });

    // Listen for customer data updates from pharmacy (when pharmacist updates customer info)
    socketRef.current.on('customer:update', (updatedCustomer) => {
      if (!updatedCustomer) return;

      // Refresh customer data to reflect pharmacist updates
      setCustomer(updatedCustomer);
      toast.warning('⚠️ เภสัชกรได้อัพเดตข้อมูลผู้ป่วย - กรุณาตรวจสอบข้อมูลล่าสุด');
    });

    // Listen for pharmacy notifications (if they send updates)
    socketRef.current.on('pharmacy:update', (pharmacyUpdate) => {
      if (!pharmacyUpdate) return;
      
      // Handle any pharmacy-specific updates
      toast.info('🔔 มีข้อมูลอัพเดทจากร้านขายยา');
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        const notifRoom = `notification:${notification.documentId}`;
        const customerRoom = `customer:${customerDocumentId}`;
        socketRef.current.emit('leave', notifRoom);
        socketRef.current.emit('leave', customerRoom);
        socketRef.current.disconnect();
      }
    };
  }, [notification?.documentId, customerDocumentId]);

  const handleBack = () => {
    if (pharmacyId && customerDocumentId) {
      // Navigate back to StaffVisitHistory for this customer
      navigate(`/drug_store_staff/${pharmacyId}/customer/${customerDocumentId}/history`);
    } else if (pharmacyId) {
      navigate(`/drug_store_staff/${pharmacyId}/customers`);
    } else {
      navigate(-1);
    }
  };

  // ฟังก์ชันลบแอสไซน์เมนต์ (notification) เมื่อพนักงานไม่ต้องการจัดส่งแล้ว
  const handleDeleteAssignment = async () => {
    if (!notification) {
      toast.error('ไม่พบข้อมูล notification');
      return;
    }

    Modal.confirm({
      title: '⚠️ ลบการแอสไซน์เมนต์',
      content: 'คุณต้องการลบการแอสไซน์เมนต์นี้ใช่หรือไม่? ข้อมูลลูกค้าจะหายไปจากรายการของคุณ',
      okText: 'ลบ',
      okType: 'danger',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        try {
          const token = localStorage.getItem('jwt');
          
          // ลบ notification นี้ โดยใช้ documentId
          const res = await fetch(
            API.notifications.delete(notification.documentId),
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          if (!res.ok && res.status !== 404) {
            throw new Error('ไม่สามารถลบการแอสไซน์เมนต์ได้');
          }

          toast.success('ลบการแอสไซน์เมนต์สำเร็จ');
          handleBack();
        } catch (error) {
          console.error('Error deleting assignment:', error);
          toast.error(error.message || 'เกิดข้อผิดพลาดในการลบการแอสไซน์เมนต์');
        }
      }
    });
  };

  // ฟังก์ชันบันทึก Lot ยาที่เลือก
  const handleSaveLots = async () => {
    try {
      const token = localStorage.getItem('jwt');
      
      if (!notification) {
        toast.error('ไม่พบข้อมูล notification');
        return;
      }

      // ตรวจสอบว่ายืนยันรับข้อมูลแล้ว
      if (!staffStatus.received) {
        toast.error('กรุณายืนยันรับข้อมูลก่อนบันทึก Lot ยา');
        return;
      }

      // ตรวจสอบว่าเลือก Lot ครบทุกยาที่มี batch หรือไม่
      const drugsWithBatches = customer.prescribed_drugs.filter(drugItem => {
        const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
        const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
        return drug && drug.drug_batches && drug.drug_batches.length > 0;
      });

      const missingBatches = drugsWithBatches.filter(drugItem => {
        const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
        return !(selectedBatches[drugId] && selectedBatches[drugId].trim() !== '');
      });

      if (missingBatches.length > 0) {
        toast.error(`กรุณาเลือก Lot สำหรับทุกรายการยา (ขาด ${missingBatches.length} รายการ)`);
        return;
      }

      const stockValidation = await validateBatchStock(selectedBatches, { useLatest: true, token });
      if (stockValidation.insufficient.length > 0) {
        toast.error(formatInsufficientStockMessage(stockValidation.insufficient));
        return;
      }

      // บันทึก Lot ลงใน notification
      const updatedStatus = { ...staffStatus, batches_selected: selectedBatches };

      const notifIdentifier = notification?.documentId;
      const res = await fetch(API.notifications.updateByDocumentId(notifIdentifier), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            staff_work_status: updatedStatus
          }
        })
      });

      const responseData = await res.json();

      if (res.ok) {
        const backendStaffStatus = responseData?.data?.staff_work_status || updatedStatus;
        
        setStaffStatus(backendStaffStatus);
        setNotification(prev => ({ ...prev, staff_work_status: backendStaffStatus }));
        
        if (backendStaffStatus.batches_selected) {
          setSelectedBatches(backendStaffStatus.batches_selected);
        } else {
          setSelectedBatches(prev => ({ ...prev, ...selectedBatches }));
        }
        
        // Broadcast to pharmacy page via Socket.IO
        if (socketRef.current?.connected) {
          socketRef.current.emit('notification:update', {
            documentId: notification.documentId,
            customerDocumentId,
            staff_work_status: backendStaffStatus,
            batches_selected: backendStaffStatus.batches_selected || selectedBatches,
            is_read: true,
            timestamp: new Date().toISOString()
          });
        }
        
        toast.success('บันทึก Lot ยาสำเร็จ - ตอนนี้สามารถกด "จัดยาส่งแล้ว" ได้');
      } else {
        throw new Error('ไม่สามารถบันทึก Lot ได้');
      }
    } catch (error) {
      console.error('Error saving lots:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก Lot');
    }
  };

  const handleUpdateStatus = async (type, note = '') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const token = localStorage.getItem('jwt');
      
      if (!notification) {
        toast.error('ไม่พบข้อมูล notification');
        return;
      }

      // ถ้าเป็นการกด "จัดยาส่งแล้ว" ต้องเช็คว่าบันทึก Lot แล้ว
      if (type === 'prepared') {
        if (!lotsSaved) {
          toast.error('กรุณาบันทึก Lot ยาก่อนสามารถกด "จัดยาส่งแล้ว"');
          return;
        }
      }

      let preparedBatchSelection = null;
      let stockValidation = null;
      if (type === 'prepared') {
        preparedBatchSelection =
          (staffStatus.batches_selected && Object.keys(staffStatus.batches_selected).length > 0)
            ? staffStatus.batches_selected
            : selectedBatches;

        stockValidation = await validateBatchStock(preparedBatchSelection, { useLatest: true, token });

        if (stockValidation.missingSelections.length > 0) {
          toast.error(`กรุณาเลือก Lot สำหรับทุกรายการยา (ขาด ${stockValidation.missingSelections.length} รายการ)`);
          return;
        }

        if (stockValidation.insufficient.length > 0) {
          toast.error(formatInsufficientStockMessage(stockValidation.insufficient));
          return;
        }
      }

      const updatedStatus = { ...staffStatus };
      const now = new Date().toISOString();
      
      if (type === 'received') {
        updatedStatus.received = true;
        updatedStatus.received_at = now;
      } else if (type === 'prepared') {
        updatedStatus.prepared = true;
        updatedStatus.prepared_at = now;
        updatedStatus.prepared_note = note;
        // CRITICAL: Save batches_selected when marking as prepared
        updatedStatus.batches_selected = preparedBatchSelection || selectedBatches;
        // Reset cancelled status เมื่อจัดส่งยารอบใหม่
        updatedStatus.cancelled = false;
        updatedStatus.cancelled_at = null;
        updatedStatus.cancelled_note = '';

        // ลดสต็อก batch ที่เลือกแบบรวมยอดต่อ LOT เพื่อกันตัดซ้ำ
        const batchUpdates = stockValidation?.requirements || [];

        await Promise.all(batchUpdates.map(async (req) => {
          const info = stockValidation.batchInfoByKey?.[normalizeId(req.selectedBatchId)];
          if (!info) {
            throw new Error(`ไม่พบข้อมูล LOT ล่าสุด: ${req.selectedBatchId}`);
          }

          const newQuantity = info.availableQuantity - req.requiredQuantity;
          if (newQuantity < 0) {
            throw new Error(`จำนวนยาไม่พอใน LOT ${info.lotNumber}`);
          }

          const updateRes = await fetch(API.drugBatches.getById(info.identifier), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ data: { quantity: newQuantity } })
          });

          if (!updateRes.ok) {
            throw new Error(`ไม่สามารถตัดสต็อก LOT ${info.lotNumber}`);
          }
        }));
      }

      const notifIdentifier = notification?.documentId;
      
      // Add timeout to prevent indefinite hang if server is unresponsive
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(API.notifications.updateByDocumentId(notifIdentifier), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          data: {
            staff_work_status: updatedStatus,
            is_read: true
          }
        })
      });
      clearTimeout(timeout);

      if (res.ok) {
        const responseData = await res.json();
        
        // Use response data from backend to ensure sync
        const backendStaffStatus = responseData?.data?.staff_work_status || updatedStatus;
        
        setStaffStatus(backendStaffStatus);
        setNotification(prev => ({ ...prev, staff_work_status: backendStaffStatus, is_read: true }));
        
        // Update selectedBatches from backend response to ensure sync
        if (backendStaffStatus.batches_selected) {
          setSelectedBatches(backendStaffStatus.batches_selected);
        }
        
        toast.success('อัปเดตสถานะสำเร็จ');
        setStatusModal({ open: false, type: '', note: '' });
        
        // 🚀 Broadcast real-time update via WebSocket to pharmacy page
        if (socketRef.current?.connected) {
          const notifRoom = `notification:${notification.documentId}`;
          const customerRoom = `customer:${customerDocumentId}`;
          
          socketRef.current.emit('notification:update', {
            documentId: notification.documentId,
            customerDocumentId,
            staff_work_status: backendStaffStatus,
            batches_selected: backendStaffStatus.batches_selected,
            is_read: true,
            timestamp: new Date().toISOString()
          });
        }
        
        // Fallback: Broadcast update event ให้ pharmacy detail page ทราบเพื่อให้อัพเดตแบบ real-time
        window.dispatchEvent(new CustomEvent('staffStatusUpdated', { 
          detail: { 
            customerDocumentId, 
            staffStatus: backendStaffStatus,
            notificationId: notification.documentId
          } 
        }));
        
        // Also store in localStorage for cross-tab communication
        localStorage.setItem(`staffStatus_${customerDocumentId}`, JSON.stringify({
          updatedAt: new Date().toISOString(),
          staffStatus: backendStaffStatus,
          notificationId: notification.documentId
        }));
        
        // Keep selectedBatches in state so they remain visible after prepare
        // Don't reload - just update notification to reflect the changes
      } else {
        throw new Error('ไม่สามารถอัปเดตสถานะได้');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      if (error.name === 'AbortError') {
        toast.error('เซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองอีกครั้ง');
      } else {
        toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleReportOutOfStock = async (drugIds, note) => {
    try {
      const token = localStorage.getItem('jwt');
      
      if (!notification) {
        toast.error('ไม่พบข้อมูล notification');
        return;
      }

      const updatedStatus = {
        ...staffStatus,
        outOfStock: [...new Set([...staffStatus.outOfStock, ...drugIds])]
      };

      const notifIdentifier = notification?.documentId;
      const res = await fetch(API.notifications.updateByDocumentId(notifIdentifier), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            staff_work_status: updatedStatus
          }
        })
      });

      if (res.ok) {
        setStaffStatus(updatedStatus);
        setNotification(prev => ({ ...prev, staff_work_status: updatedStatus }));
        toast.success('แจ้งยาหมดสต็อกสำเร็จ');
        setStatusModal({ open: false, type: '', note: '' });
      } else {
        throw new Error('ไม่สามารถแจ้งยาหมดสต็อกได้');
      }
    } catch (error) {
      console.error('Error reporting out of stock:', error);
      toast.error('เกิดข้อผิดพลาดในการแจ้งยาหมดสต็อก');
    }
  };

  // ฟังก์ชันยกเลิกการจัดส่ง
  const handleCancelDelivery = async (confirmNote = '') => {
    try {
      const token = localStorage.getItem('jwt');
      
      if (!notification) {
        toast.error('ไม่พบข้อมูล notification');
        return;
      }

      // กู้คืนสต็อก batch ที่ลดไป (parallel)
      const restoreTasks = (customer.prescribed_drugs || []).map(drugItem => {
        const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
        const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
        const selectedBatchId = selectedBatches[drugId];
        if (!selectedBatchId) return null;
        return { selectedBatchId, quantity };
      }).filter(Boolean);

      await Promise.all(restoreTasks.map(async ({ selectedBatchId, quantity }) => {
        try {
          const batchRes = await fetch(API.drugBatches.getById(selectedBatchId), {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (batchRes.ok) {
            const batchData = await batchRes.json();
            const newQuantity = (batchData.data?.quantity || 0) + quantity;
            await fetch(API.drugBatches.getById(selectedBatchId), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ data: { quantity: newQuantity } })
            });
          }
        } catch (err) {
          console.error(`Error restoring batch ${selectedBatchId}:`, err);
        }
      }));

      // รีเซ็ตสถานะการจัดส่ง พร้อมบันทึกข้อมูลการยกเลิก
      const resetStatus = {
        received: true, // ยังคงรับข้อมูล
        prepared: false, // ยกเลิกสถานะจัดส่ง
        received_at: staffStatus.received_at, // เก็บวันรับไว้
        prepared_at: null,
        prepared_note: staffStatus.prepared_note || '',
        outOfStock: staffStatus.outOfStock || [], // เก็บข้อมูลยาหมดสต็อก
        batches_selected: selectedBatches, // เก็บ batch ที่เลือก
        // บันทึกข้อมูลการยกเลิกให้เภสัชกรรับทราบ
        cancelled: true,
        cancelled_at: new Date().toISOString(),
        cancelled_note: confirmNote || 'พนักงานยกเลิกการจัดส่ง'
      };

      const notifIdentifier = notification?.documentId;
      const res = await fetch(API.notifications.updateByDocumentId(notifIdentifier), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            staff_work_status: resetStatus
          }
        })
      });

      if (res.ok) {
        setStaffStatus(resetStatus);
        setNotification(prev => ({ ...prev, staff_work_status: resetStatus }));
        toast.success('ยกเลิกการจัดส่งสำเร็จ - บันทึก Lot ใหม่เพื่อดำเนินการต่อ');
        setStatusModal({ open: false, type: '', note: '' });
      } else {
        throw new Error('ไม่สามารถยกเลิกการจัดส่งได้');
      }
    } catch (error) {
      console.error('Error canceling delivery:', error);
      toast.error('เกิดข้อผิดพลาดในการยกเลิกการจัดส่ง');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="text-center animate-in fade-in duration-500">
            <div className="inline-block w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">ไม่พบข้อมูลลูกค้า</h2>
            <p className="text-slate-500 mb-6">ขออภัย ไม่พบรายละเอียดของลูกค้ารายนี้ในระบบ</p>
            <button 
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
              onClick={handleBack}
            >
              กลับ
            </button>
          </div>
        </main>
      </div>
    );
  }

  const user = customer.users_permissions_user;
  const notifData = notification?.data || {};



  // Parse allergies to support both single and multiple allergies
  const parseAllergies = (val) => {
    if (!val) return [];
    try {
      if (Array.isArray(val)) {
        return val;
      }
      if (typeof val === 'string') {
        const s = val.trim();
        if (s.startsWith('[')) {
          return JSON.parse(s);
        } else if (s.startsWith('{')) {
          const parsed = JSON.parse(s);
          return [parsed];
        } else {
          return [{ drug: s, symptoms: '', date: '' }];
        }
      }
      if (typeof val === 'object') {
        return [val];
      }
      return [{ drug: String(val), symptoms: '', date: '' }];
    } catch (err) {
      return [{ drug: String(val), symptoms: '', date: '' }];
    }
  };

  const formatAllergy = (val) => {
    const allergies = parseAllergies(val);
    if (allergies.length === 0) return 'ไม่มีข้อมูล';
    return allergies.map(a => a.drug || a.allergy || 'ไม่ระบุชื่อยา').join(', ');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
      
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Header summary: patient info only */}
        <div className="relative overflow-hidden bg-white/80 backdrop-blur-md border border-white/40 shadow-xl rounded-3xl p-6 mb-8 transition-all hover:shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <span className="text-9xl">👤</span>
          </div>
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex-grow">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 flex items-center gap-3">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">👤</span>
                {user?.full_name || 'ไม่พบชื่อ'}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-slate-500">
                <span className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1 rounded-full text-sm font-medium">
                  📱 {user?.phone || '-'}
                </span>
                <span className="hidden sm:inline w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                <span className="flex items-center gap-1.5 bg-indigo-50/50 text-indigo-600 px-3 py-1 rounded-full text-sm font-semibold border border-indigo-100/50">
                  📅 {customer.Follow_up_appointment_date ? formatThaiDate(customer.Follow_up_appointment_date) : 'ไม่มีวันนัด'}
                </span>
              </div>
            </div>
            
            <div className="shrink-0">
              <div className="flex items-center gap-2 bg-white/50 backdrop-blur px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm">
                <span className="text-xl">💊</span>
                <span className="text-slate-700 font-bold">
                  {customer.prescribed_drugs ? customer.prescribed_drugs.length : 0}
                </span>
                <span className="text-slate-500 text-sm font-medium">รายการยา</span>
              </div>
            </div>
          </div>
        </div>

        {/* สถานะการทำงานของ Staff */}
        <div className="bg-white shadow-lg rounded-[2.5rem] p-6 sm:p-8 mb-8 border border-slate-100/50">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
              <span className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-2xl">📊</span>
              สถานะการดำเนินการ
            </h3>
            {staffStatus.prepared && (
              <span className="animate-pulse flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-100">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                กำลังจัดส่ง
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setStatusModal({ open: true, type: 'received', note: '' })}
              disabled={staffStatus.received}
              className={`group relative overflow-hidden flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-300 transform border-2 ${
                staffStatus.received 
                ? 'bg-slate-50 border-emerald-500/20 text-slate-500' 
                : 'bg-white border-indigo-100 hover:border-indigo-400 text-slate-600 hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              {staffStatus.received ? (
                <>
                  <div className="text-3xl mb-3 text-emerald-500">✅</div>
                  <div className="font-bold text-slate-800">ได้รับข้อมูลแล้ว</div>
                  {staffStatus.received_at && (
                    <div className="mt-2 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-lg italic">
                      {formatThaiDate(staffStatus.received_at)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📥</div>
                  <div className="font-bold">ยืนยันรับข้อมูล</div>
                  <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">Step 1</div>
                </>
              )}
            </button>
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'prepared', note: '' })}
              disabled={staffStatus.prepared || !staffStatus.received || !lotsSaved}
              className={`group relative overflow-hidden flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-300 transform border-2 ${
                staffStatus.prepared 
                ? 'bg-slate-50 border-indigo-500/20 text-slate-500 font-medium' 
                : !staffStatus.received || !lotsSaved
                ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-60 cursor-not-allowed'
                : 'bg-white border-indigo-100 hover:border-[var(--color-primary)] text-slate-600 hover:shadow-xl hover:-translate-y-1'
              }`}
              title={!lotsSaved ? 'กรุณาบันทึก Lot ยาก่อน' : staffStatus.prepared ? 'จัดยาส่งแล้ว' : ''}
            >
              {staffStatus.prepared ? (
                <>
                  <div className="text-3xl mb-3 text-indigo-500 animate-bounce">✅</div>
                  <div className="font-bold text-slate-800">จัดยาสำเร็จ</div>
                  {staffStatus.prepared_at && (
                    <div className="mt-2 text-xs font-medium text-indigo-400 bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1">
                      🚚 {formatThaiDate(staffStatus.prepared_at)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📦</div>
                  <div className="font-bold">จัดยาส่งไปแล้ว</div>
                  <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">Step 2</div>
                  {!lotsSaved && staffStatus.received && (
                    <div className="absolute inset-x-0 bottom-0 bg-amber-500/10 text-amber-600 text-[10px] py-1 text-center font-bold">
                      ⚠️ เลือก LOT ก่อน
                    </div>
                  )}
                </>
              )}
            </button>
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'outOfStock', note: '', selectedDrugs: [] })}
              disabled={staffStatus.prepared}
              className={`group flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-300 transform border-2 ${
                staffStatus.prepared
                ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-40 cursor-not-allowed'
                : 'bg-white border-rose-100 hover:border-rose-400 text-slate-600 hover:bg-rose-50 hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              <div className="text-3xl mb-3 group-hover:animate-pulse">🚨</div>
              <div className="font-bold">แจ้งยาหมดสต็อก</div>
            </button>

            {staffStatus.prepared ? (
              <button
                onClick={() => setStatusModal({ open: true, type: 'cancelDelivery', note: '' })}
                className="group flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-300 transform border-2 bg-orange-50 border-orange-100 hover:border-orange-400 text-orange-600 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="text-3xl mb-3 group-hover:-rotate-45 transition-transform">⏮️</div>
                <div className="font-bold">ยกเลิกการส่ง</div>
              </button>
            ) : (
              <div className="p-6 rounded-3xl border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-300 italic text-sm">
                (การทำงานเพิ่มเติม...)
              </div>
            )}
          </div>
          
          {(notifData.staff_note || notifData.note) && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {notifData.staff_note && (
                <div className="bg-slate-50 p-4 rounded-2xl border-l-4 border-slate-300 text-slate-600">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1">📝 หมายเหตุ:</div>
                  <p className="text-sm font-medium leading-relaxed">{notifData.staff_note}</p>
                </div>
              )}
              {notifData.note && (
                <div className="bg-indigo-50/50 p-4 rounded-2xl border-l-4 border-indigo-400 text-slate-700">
                  <div className="text-xs font-bold text-indigo-400 uppercase mb-1">💬 หมายเหตุจากเภสัชกร:</div>
                  <p className="text-sm font-semibold italic leading-relaxed">{notifData.note}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={key => setActiveTab(key)} 
          defaultActiveKey="1" 
          type="card" 
          size="large"
          className="staff-custom-tabs"
          items={[
            {
              label: <span className="flex items-center gap-2">📋 ข้อมูลพื้นฐาน</span>,
              key: '1',
              children: (
                <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Contact Info */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl text-lg">👤</span>
                        <h3 className="text-lg font-bold text-slate-800">ข้อมูลติดต่อ</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                          <label className="text-sm font-medium text-slate-400">ชื่อ-นามสกุล:</label>
                          <span className="text-slate-700 font-bold">{user?.full_name || 'ไม่มีข้อมูล'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                          <label className="text-sm font-medium text-slate-400">เบอร์โทรศัพท์:</label>
                          <span className="text-indigo-600 font-extrabold">{user?.phone || 'ไม่มีข้อมูล'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Critical Info */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl text-lg">⚠️</span>
                        <h3 className="text-lg font-bold text-slate-800">ข้อมูลสำคัญ</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-bold text-rose-600 flex items-center gap-1.5">
                              <span className="animate-pulse">🚫</span> ยาที่แพ้
                            </label>
                            {customer.Allergic_drugs ? (
                              (() => {
                                const allergies = parseAllergies(customer.Allergic_drugs);
                                return (
                                  <button
                                    onClick={() => setAllergyDetailModal({ open: true, allergies })}
                                    className={`text-xs font-bold py-1 px-3 rounded-full transition-all ${
                                      allergies.length > 0 
                                      ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm' 
                                      : 'bg-emerald-100 text-emerald-600 cursor-default'
                                    }`}
                                  >
                                    {allergies.length > 0 
                                      ? `👀 ดูรายละเอียด (${allergies.length})` 
                                      : '✓ ไม่มีประวัติแพ้ยา'
                                    }
                                  </button>
                                );
                              })()
                            ) : (
                              <span className="text-xs font-bold py-1 px-3 rounded-full bg-emerald-100 text-emerald-600">
                                ✓ ไม่มีประวัติแพ้ยา
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                          <label className="text-sm font-medium text-slate-400">โรคประจำตัว:</label>
                          <span className="text-slate-700 font-bold">{customer.congenital_disease || 'ไม่มีข้อมูล'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            },
            {
              label: <span className="flex items-center gap-2">🩺 อาการและการติดตาม</span>,
              key: '2',
              children: (
                <div className="py-6 space-y-8 animate-in mt-2 fade-in slide-in-from-bottom-4 duration-500">
                  {/* อาการปัจจุบัน */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-xl font-bold">🩺</span>
                      <h3 className="text-xl font-extrabold text-slate-800">อาการปัจจุบัน</h3>
                    </div>
                    
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 overflow-hidden relative">
                      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
                      
                      {(customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) ? (
                        <div className="space-y-6">
                          <div className="relative group">
                            <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">อาการหลัก</label>
                            <div className="text-lg font-bold text-slate-800 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-50">
                              {(() => {
                                const sym = customer.Customers_symptoms;
                                if (!sym) return '-';
                                if (typeof sym === 'object') return sym.main || sym.symptom || 'ไม่ระบุอาการ';
                                return sym;
                              })()}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {(customer.symptom_history || (typeof customer.Customers_symptoms === 'object' && customer.Customers_symptoms?.history)) && (
                              <div className="relative">
                                <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">ประวัติการเจ็บป่วย</label>
                                <div className="text-slate-600 font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[80px]">
                                  {customer.symptom_history || customer.Customers_symptoms?.history}
                                </div>
                              </div>
                            )}
                            {(customer.symptom_note || (typeof customer.Customers_symptoms === 'object' && customer.Customers_symptoms?.note)) && (
                              <div className="relative">
                                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">หมายเหตุ</label>
                                <div className="text-slate-600 font-medium bg-amber-50/20 p-4 rounded-2xl border border-amber-50 min-h-[80px]">
                                  {customer.symptom_note || customer.Customers_symptoms?.note}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 flex flex-col items-center text-slate-300">
                          <div className="text-5xl mb-4">📝</div>
                          <h4 className="font-bold">ไม่มีข้อมูลอาการ</h4>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* การนัดติดตามและการแจ้งเตือน */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Follow-up Section */}
                    <div className="lg:col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <span className="text-xl">📅</span> การนัดติดตาม
                      </h3>
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col items-center text-center">
                        <span className="text-sm font-bold text-slate-400 uppercase mb-2">วันนัดติดตามอาการ</span>
                        <div className="text-xl font-extrabold text-indigo-600 mb-4">
                          {customer.Follow_up_appointment_date ? formatThaiDate(customer.Follow_up_appointment_date) : 'ยังไม่ได้กำหนด'}
                        </div>
                        {customer.Follow_up_appointment_date && (
                          <div className={`px-4 py-1.5 rounded-full text-xs font-extrabold shadow-sm ${
                            new Date(customer.Follow_up_appointment_date) > new Date() 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-rose-500 text-white'
                          }`}>
                            {new Date(customer.Follow_up_appointment_date) > new Date() ? '📋 กำหนดการ' : '⚠️ ครบกำหนด'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Alert Grid */}
                    <div className="lg:col-span-2 space-y-6">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-xl animate-bounce">⚠️</span> ข้อมูลสำคัญที่ต้องระวัง
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="group bg-rose-50 shadow-sm hover:shadow-md transition-all rounded-3xl p-6 border border-rose-100 flex items-start gap-4">
                          <div className="w-12 h-12 shrink-0 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">🚫</div>
                          <div>
                            <h4 className="text-rose-500 font-extrabold mb-1">ยาที่แพ้</h4>
                            <div className="text-slate-600 font-medium text-sm">
                              {customer.Allergic_drugs ? (
                                (() => {
                                  const allergies = parseAllergies(customer.Allergic_drugs);
                                  return (
                                    <div className="space-y-1">
                                      {allergies.map((allergy, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                                          {allergy.drug || allergy.allergy || 'ไม่ระบุชื่อยา'}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()
                              ) : (
                                <p className="text-slate-400 italic">ไม่มีข้อมูล</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="group bg-blue-50 shadow-sm hover:shadow-md transition-all rounded-3xl p-6 border border-blue-100 flex items-start gap-4">
                          <div className="w-12 h-12 shrink-0 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">🏥</div>
                          <div>
                            <h4 className="text-blue-500 font-extrabold mb-1">โรคประจำตัว</h4>
                            <p className="text-slate-700 font-bold text-lg leading-tight">
                              {customer.congenital_disease || 'ไม่มีข้อมูล'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            },
            {
              label: <span className="flex items-center gap-2">💊 รายการยา <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-extrabold">{customer?.prescribed_drugs?.length || 0}</span></span>,
              key: '3',
              children: (
                <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-2">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                      <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">💊</span>
                      รายการยาที่ต้องจัดเตรียม
                    </h2>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">กำลังตรวจสอบสต็อก</span>
                    </div>
                  </div>

                  {/* แสดงรายการยาที่กำหนดแล้ว */}
                  {customer.prescribed_drugs && customer.prescribed_drugs.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-200 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                          <span className="text-7xl">Rx</span>
                        </div>
                        <div className="relative z-10 flex items-center gap-4">
                          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl">💊</div>
                          <div>
                            <h3 className="text-xl font-bold">ยาที่พร้อมจัดเตรียม</h3>
                            <p className="opacity-80 font-medium">ผู้ป่วย: {user?.full_name || 'ผู้ป่วย'}</p>
                          </div>
                        </div>
                        <div className="relative z-10 text-right">
                          <div className="text-3xl font-black">{customer.prescribed_drugs.length}</div>
                          <div className="text-xs font-bold uppercase tracking-widest opacity-70">รายการยา</div>
                        </div>
                      </div>
                      
                      {/* ข้อความเตือนก่อนเลือก Lot */}
                      {!staffStatus.received && (
                        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-3xl flex items-center gap-4 animate-bounce mt-4">
                          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl">⚠️</div>
                          <div>
                            <div className="font-extrabold text-amber-800">กรุณากด "ยืนยันรับข้อมูล"</div>
                            <p className="text-amber-600 text-sm font-medium">คุณต้องยืนยันการรับข้อมูลก่อน จึงจะสามารถเลือก LOT ยาได้</p>
                          </div>
                        </div>
                      )}

                      {/* Grid Layout สำหรับยา */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                        {customer.prescribed_drugs.map((drugItem, index) => {
                          const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                          const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                          const reminderTime = typeof drugItem === 'object' ? drugItem.reminder_time : null;
                          const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                          const isOutOfStock = staffStatus.outOfStock.includes(drugId);
                          const isPrepared = staffStatus.prepared;
                          const selectedBatch = drug?.drug_batches?.find(
                            (b) => normalizeId(b.documentId) === normalizeId(selectedBatches[drugId]) || normalizeId(b.id) === normalizeId(selectedBatches[drugId])
                          );
                          const selectedBatchQuantity = Number(selectedBatch?.quantity || 0);
                          const isSelectedBatchInsufficient = !!selectedBatch && selectedBatchQuantity < Number(quantity || 0);
                          
                          return (
                            <div key={drugId} className={`group relative bg-white rounded-[2.5rem] p-6 shadow-sm border transition-all duration-300 ${
                              isOutOfStock 
                              ? 'border-rose-100 opacity-70 grayscale-[0.3]' 
                              : isPrepared 
                              ? 'border-indigo-100 bg-indigo-50/20' 
                              : 'border-slate-100 hover:shadow-xl hover:border-indigo-200'
                            }`}>
                              {isPrepared && (
                                <div className="absolute top-6 right-6 z-10 px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-tighter rounded-full shadow-lg">
                                  🔒 ล็อกแล้ว
                                </div>
                              )}
                              
                              <div className="flex items-start gap-4 mb-6">
                                <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner ${
                                  isOutOfStock ? 'bg-rose-100 text-rose-500' : 'bg-indigo-100 text-indigo-600'
                                }`}>
                                  Rx
                                </div>
                                <div className="flex-grow">
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xl font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                      {drug ? drug.name_th : 'กำลังโหลด...'}
                                    </h4>
                                    <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-extrabold">
                                      {quantity} ชิ้น
                                    </div>
                                  </div>
                                  <p className="text-slate-400 font-bold italic text-sm">{drug ? drug.name_en : '-'}</p>
                                  
                                  {isOutOfStock && (
                                    <div className="mt-2 text-rose-500 font-extrabold text-xs flex items-center gap-1">
                                      <span className="animate-ping w-2 h-2 bg-rose-500 rounded-full"></span>
                                      สินค้านี้หมดสต็อก
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-4 mb-6">
                                {drug && (drug.manufacturer || drug.price) && (
                                  <div className="flex flex-wrap gap-2">
                                    {drug.manufacturer && (
                                      <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-xl text-[10px] font-bold border border-slate-100">
                                        📦 {drug.manufacturer}
                                      </span>
                                    )}
                                    {drug.price && (
                                      <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-xl text-[10px] font-bold border border-emerald-100 font-mono">
                                        ราคา: ฿{drug.price}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                  {reminderTime && (
                                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-[10px] font-bold shadow-sm flex items-center gap-1">
                                      ⏰ ระบุเวลา: {reminderTime} น.
                                    </span>
                                  )}
                                  
                                  {/* Meal Times Display */}
                                  {(() => {
                                    const mealMap = { 
                                      take_morning: 'เช้า', 
                                      take_lunch: 'เที่ยง', 
                                      take_evening: 'เย็น', 
                                      take_bedtime: 'ก่อนนอน' 
                                    };
                                    const relationMap = { 
                                      before: 'ก่อนอาหาร', 
                                      after: 'หลังอาหาร', 
                                      with_meal: 'พร้อมอาหาร', 
                                      none: '' 
                                    };
                                    
                                    const selectedSlots = Object.keys(mealMap).filter(k => drugItem[k] === true);
                                    if (selectedSlots.length === 0) return null;
                                    
                                    const relation = drugItem.meal_relation || 'after';
                                    return (
                                      <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-xl text-[10px] font-black border border-amber-200 flex items-center gap-1">
                                        🥣 {relationMap[relation]} {selectedSlots.map(k => mealMap[k]).join(', ')}
                                      </span>
                                    );
                                  })()}

                                  {/* Frequency Display */}
                                  {drugItem.frequency_hours > 0 && (
                                    <span className="bg-violet-100 text-violet-700 px-3 py-1 rounded-xl text-[10px] font-black border border-violet-200 flex items-center gap-1">
                                      🔄 ทุก {drugItem.frequency_hours} ชม. ({Math.floor(24 / drugItem.frequency_hours)} ครั้ง/วัน)
                                    </span>
                                  )}

                                  {/* Dosage Display */}
                                  {drugItem.dosage_per_time && (
                                    <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-xl text-[10px] font-black border border-cyan-200 flex items-center gap-1">
                                      💊 ครั้งละ {drugItem.dosage_per_time}{drug?.drug_unit && ` (${drug.drug_unit === 'other' ? (drug.drug_unit_custom || '') : drug.drug_unit})`}
                                    </span>
                                  )}
                                </div>
                                
                                {drug && drug.description && (
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                      {drug.description}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Batch Selection */}
                              {drug && drug.drug_batches && drug.drug_batches.length > 0 && (
                                <div className={`p-5 rounded-3xl border-2 transition-colors ${
                                  selectedBatches[drugId] 
                                  ? 'bg-indigo-50/50 border-indigo-200' 
                                  : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'
                                }`}>
                                  <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">🏷️ เลือก LOT ที่ใช้</label>
                                  <div className="space-y-4">
                                    <select
                                      disabled={isPrepared || !staffStatus.received}
                                      value={selectedBatches[drugId] || ''}
                                      onChange={(e) => {
                                        setSelectedBatches(prev => ({
                                          ...prev,
                                          [drugId]: e.target.value
                                        }));
                                      }}
                                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
                                    >
                                      {!selectedBatches[drugId] && <option value="">-- กรุณาเลือก LOT ยา --</option>}
                                      {drug.drug_batches.map((batch, idx) => (
                                        <option
                                          key={batch.documentId || idx}
                                          value={batch.documentId || batch.id}
                                          disabled={Number(batch.quantity || 0) < Number(quantity || 0)}
                                        >
                                          {batch.lot_number} (เหลือ {batch.quantity}){Number(batch.quantity || 0) < Number(quantity || 0) ? ' - จำนวนไม่พอ' : ''} | Exp: {batch.expiry_date}
                                        </option>
                                      ))}
                                    </select>
                                    {selectedBatches[drugId] && isSelectedBatchInsufficient && (
                                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-black">
                                        ⚠️ LOT ที่เลือกมีจำนวนไม่พอ (ต้องใช้ {quantity} แต่เหลือ {selectedBatchQuantity})
                                      </div>
                                    )}
                                    
                                    {selectedBatches[drugId] && (
                                      <div className={`p-4 rounded-2xl border-2 flex items-center justify-between animate-in zoom-in-95 duration-200 shadow-sm ${
                                        isPrepared
                                          ? 'bg-indigo-600 border-indigo-700 text-white'
                                          : isSelectedBatchInsufficient
                                          ? 'bg-white border-rose-400 text-rose-600'
                                          : 'bg-white border-emerald-500/30 text-emerald-700'
                                      }`}>
                                        <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                                            isPrepared ? 'bg-white/20' : 'bg-emerald-100'
                                          }`}>
                                            {isPrepared ? '🔒' : '✅'}
                                          </div>
                                          <div>
                                            <div className="text-[10px] font-black uppercase opacity-60 tracking-wider leading-none mb-1">Lot ที่เลือกตอนนี้</div>
                                            <div className="font-extrabold leading-tight">
                                              {drug.drug_batches.find(b => b.documentId === selectedBatches[drugId] || b.id === selectedBatches[drugId])?.lot_number}
                                            </div>
                                          </div>
                                        </div>
                                        {!isPrepared && (
                                          <button
                                            onClick={() => {
                                              setSelectedBatches(prev => ({
                                                ...prev,
                                                [drugId]: ''
                                              }));
                                            }}
                                            disabled={!staffStatus.received}
                                            className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                            title="ยกเลิก LOT นี้"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Expandable Details */}
                                  {!isPrepared && (
                                    <details className="mt-4 border-t border-slate-200/50 pt-4 group">
                                      <summary className="list-none text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-500 transition-colors flex items-center justify-between">
                                        <span>📋 ข้อมูล LOTS ทั้งหมด ({drug.drug_batches.length})</span>
                                        <span className="group-open:rotate-180 transition-transform">▼</span>
                                      </summary>
                                      <div className="mt-4 grid grid-cols-1 gap-2">
                                        {drug.drug_batches.map((batch, idx) => (
                                          <div key={batch.documentId || idx} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                              <span className="text-xs font-black text-slate-800">LT-{batch.lot_number}</span>
                                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${batch.quantity > 10 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                สต็อก: {batch.quantity}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                                              {batch.date_produced && <span>ผลิต: {batch.date_produced}</span>}
                                              {batch.expiry_date && <span className="text-rose-400 font-bold">หมดอายุ: {batch.expiry_date}</span>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Floating Bottom Bar for Save LOTS */}
                      {!lotsSaved && !staffStatus.prepared && (
                        <div className="sticky bottom-8 z-20 mx-auto max-w-2xl animate-in slide-in-from-bottom-8 duration-500">
                          <div className="bg-white/80 backdrop-blur-xl border border-indigo-100 p-6 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 text-center">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white px-6 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                              Awaiting Verification
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl animate-pulse">⚠️</div>
                              <div className="text-left">
                                <h4 className="text-lg font-extrabold text-slate-800 leading-tight">บันทึก LOT ยา</h4>
                                <p className="text-sm text-slate-500 font-medium italic">กรุณากดบันทึกทุกรายการที่เลือกก่อนจัดยาส่ง</p>
                              </div>
                            </div>
                            <button
                              onClick={handleSaveLots}
                              disabled={!staffStatus.received}
                              className={`w-full py-4 px-8 rounded-2xl text-lg font-black tracking-tight transform transition-all shadow-xl shadow-indigo-200 ${
                                staffStatus.received 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                              }`}
                            >
                              💾 บันทึก LOT ยา
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Success States */}
                      {lotsSaved && !staffStatus.prepared && (
                        <div className="bg-emerald-50 border-2 border-emerald-100 p-6 rounded-[2.5rem] flex items-center gap-6 shadow-sm">
                          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-3xl shadow-sm animate-bounce">✅</div>
                          <div>
                            <h4 className="text-xl font-extrabold text-emerald-700">บันทึกสำเร็จ</h4>
                            <p className="font-bold text-emerald-600/80">คุณสามารถกดยืนยันการ "จัดยาส่งแล้ว" ได้ที่แผงควบคุมหลัก</p>
                          </div>
                        </div>
                      )}

                      {staffStatus.prepared && (
                        <div className="bg-indigo-600 p-6 rounded-[2.5rem] flex items-center gap-6 shadow-xl shadow-indigo-200 text-white">
                          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-3xl backdrop-blur-sm">🚚</div>
                          <div>
                            <h4 className="text-xl font-extrabold">ดำเนินการสำเร็จแล้ว</h4>
                            <p className="font-bold opacity-80 italic">ระบบได้ตัดสต็อกและส่งข้อมูลให้พยาบาลเรียบร้อยแล้ว</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                      <div className="text-7xl mb-6 opacity-30">💊</div>
                      <h3 className="text-2xl font-black text-slate-300">ไม่พบรายการยาที่กำหนด</h3>
                      <p className="text-slate-400 font-medium">กรุณาติดต่อเภสัชกรเพื่อสอบถามรายละเอียดเพิ่มเติม</p>
                    </div>
                  )}
                </div>
              )
            },
            {
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <span className="text-base">📋</span>
                  <span className="text-sm font-bold">ดำเนินการ</span>
                </span>
              ),
              key: '4',
              children: (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {/* Status Progress Map - More Compact */}
                  <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2.5">
                      <span className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-xs">📊</span>
                      สรุปสถานะการดำเนินการ
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {/* Step 1: Received */}
                      <div className={`p-4 rounded-3xl border-2 transition-all duration-500 ${
                        staffStatus.received 
                        ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                        : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${staffStatus.received ? 'text-emerald-500' : 'text-slate-400'}`}>
                          ขั้นตอนที่ 1
                        </div>
                        <div className={`text-base font-black mb-1 ${staffStatus.received ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {staffStatus.received ? '✅ ได้รับข้อมูลแล้ว' : '⏳ รอยืนยันการรับ'}
                        </div>
                        {staffStatus.received && staffStatus.received_at && (
                          <div className="text-[10px] font-bold text-emerald-600/70 italic">
                            {new Date(staffStatus.received_at).toLocaleString('th-TH')}
                          </div>
                        )}
                      </div>

                      {/* Step 2: Lots Selected */}
                      <div className={`p-4 rounded-3xl border-2 transition-all duration-500 ${
                        lotsSaved 
                        ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                        : 'bg-slate-50 border-slate-100'
                      } ${!staffStatus.received && 'opacity-40'}`}>
                        <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${lotsSaved ? 'text-emerald-500' : 'text-slate-400'}`}>
                          ขั้นตอนที่ 2
                        </div>
                        <div className={`text-base font-black mb-1 ${lotsSaved ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {lotsSaved ? '✅ บันทึก LOT ยาเรียบร้อย' : '⏳ รอบันทึก LOT ยา'}
                        </div>
                        {lotsSaved && (
                          <div className="text-[10px] font-bold text-emerald-600/70 italic">
                            {Object.keys(selectedBatches).filter(k => selectedBatches[k]).length} รายการที่เลือก
                          </div>
                        )}
                      </div>

                      {/* Step 3: Prepared */}
                      <div className={`p-4 rounded-3xl border-2 transition-all duration-500 ${
                        staffStatus.prepared 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-slate-50 border-slate-100'
                      } ${!lotsSaved && 'opacity-40'}`}>
                        <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${staffStatus.prepared ? 'text-indigo-500' : 'text-slate-400'}`}>
                          ขั้นตอนที่ 3
                        </div>
                        <div className={`text-base font-black mb-1 ${staffStatus.prepared ? 'text-indigo-700' : 'text-slate-400'}`}>
                          {staffStatus.prepared ? '✅ จัดส่งสำเร็จ' : '⏳ รอจัดส่งยา'}
                        </div>
                        {staffStatus.prepared && staffStatus.prepared_at && (
                          <div className="text-[10px] font-bold text-indigo-600/70 italic">
                            {new Date(staffStatus.prepared_at).toLocaleString('th-TH')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar - Compact */}
                    <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                      <div className="flex justify-between items-end mb-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ความคืบหน้า</span>
                        <span className="text-xl font-black text-indigo-600">
                          {staffStatus.prepared ? '100%' : lotsSaved ? '66%' : staffStatus.received ? '33%' : '0%'}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                          style={{ width: staffStatus.prepared ? '100%' : lotsSaved ? '66%' : staffStatus.received ? '33%' : '0%' }}
                        />
                      </div>
                      <div className="mt-2 text-center">
                        <p className="text-xs font-bold text-slate-500 italic">
                          {staffStatus.prepared ? 'เสร็จสิ้นเรียบร้อย' : lotsSaved ? 'กำลังแพ็คและขอจัดส่ง' : staffStatus.received ? 'รับงานแล้ว ตรวจสต็อกยา' : 'รอรับงาน'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section - Compact */}
                  {(staffStatus.prepared_note || notifData.note) && (
                    <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-lg shadow-indigo-100 relative overflow-hidden">
                      <h4 className="text-lg font-black mb-4 flex items-center gap-2">
                        <span className="text-xl">📝</span>
                        หมายเหตุ
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {staffStatus.prepared_note && (
                          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                            <div className="text-[9px] font-black uppercase opacity-60 tracking-wider mb-1">สาขาบันทึก:</div>
                            <div className="text-sm font-medium leading-relaxed italic">"{staffStatus.prepared_note}"</div>
                          </div>
                        )}
                        {notifData.note && (
                          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                            <div className="text-[9px] font-black uppercase opacity-60 tracking-wider mb-1">เภสัชกรแจ้ง:</div>
                            <div className="text-sm font-medium leading-relaxed italic text-amber-200">"{notifData.note}"</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Out of Stock - Compact */}
                  {staffStatus.outOfStock && staffStatus.outOfStock.length > 0 && (
                    <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center text-lg shadow-lg shadow-rose-100">!</div>
                        <div>
                          <h4 className="text-base font-black text-rose-800">ยาหมดสต็อก</h4>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {staffStatus.outOfStock.map((drugId, idx) => {
                          const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                          return (
                            <div key={idx} className="bg-white px-4 py-2 rounded-xl border border-rose-200 text-rose-700 font-extrabold shadow-sm">
                              {drug ? drug.name_th : drugId}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="pt-4 flex justify-center">
                    <button 
                      onClick={handleBack}
                      className="group flex items-center gap-2.5 bg-slate-800 hover:bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black text-sm transition-all hover:-translate-x-1 shadow-xl"
                    >
                      <span>←</span>
                      กลับไปยังรายการลูกค้า
                    </button>
                  </div>
                </div>
              )
            }
          ]}
        />

      </main>

      <>
        {/* Modern Status Update Modal */}
        <Modal
        title={null}
        open={statusModal.open}
        onCancel={() => setStatusModal({ open: false, type: '', note: '', selectedDrugs: [] })}
        centered
        width={statusModal.type === 'outOfStock' ? 700 : 500}
        footer={null}
        styles={{
          mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
          content: { padding: 0, borderRadius: '2.5rem', overflow: 'hidden' }
        }}
      >
        <div className="relative">
          {/* Modal Header */}
          <div className={`p-8 ${
            statusModal.type === 'cancelDelivery' ? 'bg-rose-600' : 'bg-indigo-600'
          } text-white`}>
            <div className="text-4xl mb-4">
              {statusModal.type === 'received' && '📥'}
              {statusModal.type === 'prepared' && '📦'}
              {statusModal.type === 'outOfStock' && '🚨'}
              {statusModal.type === 'cancelDelivery' && '⏮️'}
            </div>
            <h2 className="text-2xl font-black">
              {statusModal.type === 'received' && 'ยืนยันรับข้อมูล'}
              {statusModal.type === 'prepared' && 'ยืนยันจัดยาส่งแล้ว'}
              {statusModal.type === 'outOfStock' && 'แจ้งยาหมดสต็อก'}
              {statusModal.type === 'cancelDelivery' && 'ยกเลิกการจัดส่ง'}
            </h2>
            <p className="opacity-80 font-medium italic mt-1 text-sm">
              CareLink Operation Management System
            </p>
          </div>

          <div className="p-8">
            {/* Modal Body Content */}
            <div className="mb-8 overflow-y-auto max-h-[50vh] pr-2">
              {statusModal.type === 'received' && (
                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">💡</div>
                  <p className="text-indigo-900 font-bold leading-relaxed">
                    คุณต้องการยืนยันว่า "ได้รับข้อมูลลูกค้า" เข้าระบบคลังยาสาขาเรียบร้อยแล้วใช่หรือไม่?
                  </p>
                </div>
              )}

              {statusModal.type === 'prepared' && (
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">✅</div>
                  <p className="text-emerald-900 font-bold leading-relaxed">
                    ยืนยันว่าได้จัดเตรียมยาและ "ส่งมอบให้แมสเซนเจอร์/พยาบาล" เรียบร้อยแล้ว? ระบบจะทำการตัดสต็อกยาทันที
                  </p>
                </div>
              )}

              {statusModal.type === 'cancelDelivery' && (
                <div className="space-y-4">
                  <div className="bg-rose-50 p-6 rounded-3xl border-2 border-rose-100">
                    <h4 className="text-rose-800 font-black mb-2 flex items-center gap-2">
                      <span>⚠️</span> คำเตือนการยกเลิก
                    </h4>
                    <ul className="text-sm text-rose-600 font-bold space-y-2 ml-2">
                      <li>• จะทำการคืนสต็อกยาทั้งหมดที่ถูกตัดไป</li>
                      <li>• รีเซ็ตสถานะการจัดส่งกลับไปจุดเริ่มต้น</li>
                      <li>• แจ้งเตือนเภสัชกรผู้สั่งยาเพื่อทราบเหตุผล</li>
                    </ul>
                  </div>
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest pl-2">
                    กรุณาระบุเหตุผลการยกเลิกด้านล่าง
                  </p>
                </div>
              )}

              {statusModal.type === 'outOfStock' && (
                <div className="space-y-6">
                  <p className="text-slate-500 font-bold px-2 italic">กรุณาเลือกรายการยาที่ไม่สามารถจ่ายได้เนื่องจากหมดสต็อก:</p>
                  <div className="grid grid-cols-1 gap-3">
                    {customer.prescribed_drugs?.map((drugItem, index) => {
                      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                      const isSelected = (statusModal.selectedDrugs || []).includes(drugId);
                      
                      return (
                        <label 
                          key={drugId}
                          className={`flex items-center gap-4 p-4 rounded-3xl border-2 cursor-pointer transition-all ${
                            isSelected 
                            ? 'bg-rose-50 border-rose-500 shadow-md shadow-rose-100' 
                            : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-rose-500 border-rose-500' : 'border-slate-300'
                          }`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStatusModal(prev => ({ ...prev, selectedDrugs: [...prev.selectedDrugs, drugId] }));
                              } else {
                                setStatusModal(prev => ({ ...prev, selectedDrugs: prev.selectedDrugs.filter(id => id !== drugId) }));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <div className={`font-black ${isSelected ? 'text-rose-700' : 'text-slate-700'}`}>
                              {drug?.name_th || 'กำลังโหลด...'}
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">
                              {drug?.name_en || '-'} • จำนวน {typeof drugItem === 'string' ? 1 : drugItem.quantity || 1}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Common Note Field */}
            <div className="relative">
              <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">
                หมายเหตุเพิ่มเติม (Optional)
              </span>
              <textarea
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                value={statusModal.note}
                onChange={(e) => setStatusModal({ ...statusModal, note: e.target.value })}
                rows={3}
                className="w-full p-5 rounded-3xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-0 transition-all font-medium text-slate-700 resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <button
                onClick={() => setStatusModal({ open: false, type: '', note: '', selectedDrugs: [] })}
                className="flex-1 py-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50 transition-colors border-2 border-transparent"
              >
                ย้อนกลับ
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => {
                  if (statusModal.type === 'outOfStock') {
                    if (statusModal.selectedDrugs.length === 0) {
                      toast.error('กรุณาเลือกยาที่หมดสต็อก');
                      return;
                    }
                    handleReportOutOfStock(statusModal.selectedDrugs, statusModal.note);
                  } else if (statusModal.type === 'cancelDelivery') {
                    handleCancelDelivery(statusModal.note);
                  } else {
                    handleUpdateStatus(statusModal.type, statusModal.note);
                  }
                }}
                className={`flex-[2] py-4 rounded-2xl font-black text-white shadow-xl transform transition-all hover:-translate-y-1 active:scale-95 ${
                  isSubmitting ? 'opacity-60 cursor-not-allowed' :
                  statusModal.type === 'cancelDelivery' 
                  ? 'bg-rose-600 shadow-rose-200' 
                  : 'bg-indigo-600 shadow-indigo-200'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    กำลังดำเนินการ...
                  </span>
                ) : statusModal.type === 'cancelDelivery' ? '🔥 ยืนยันยกเลิกทันที' : '✨ ตกลงและดำเนินการ'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Line 2345 omitted */}
      <Modal
        title={null}
        open={allergyDetailModal.open}
        onCancel={() => setAllergyDetailModal({ open: false, allergies: [] })}
        footer={null}
        centered
        width={600}
        styles={{
          mask: { backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255, 255, 255, 0.4)' },
          content: { padding: 0, borderRadius: '3rem', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(225, 29, 72, 0.15)' }
        }}
      >
        <div className="bg-white">
          <div className="bg-rose-600 p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-4xl">💊</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Security Protocol</span>
              </div>
              <h2 className="text-3xl font-black italic tracking-tight">รายละเอียดยาที่แพ้</h2>
            </div>
          </div>

          <div className="p-10">
            {allergyDetailModal.allergies?.length > 0 ? (
              <div className="space-y-6">
                {allergyDetailModal.allergies.map((allergy, idx) => (
                  <div key={idx} className="group relative bg-rose-50/50 p-8 rounded-[2.5rem] border-2 border-rose-100 transition-all hover:bg-rose-50 hover:border-rose-300">
                    <div className="absolute top-4 right-8 text-rose-200 text-6xl font-black select-none pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                      {idx + 1}
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-8 bg-rose-500 rounded-full" />
                        <h4 className="text-xl font-black text-rose-800 uppercase tracking-tight">
                          {allergy.drug || 'ไม่ระบุชื่อยา'}
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div className="bg-white/60 p-4 rounded-2xl">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">อาการที่พบ (Symptoms)</div>
                          <div className="text-slate-700 font-bold leading-relaxed italic text-lg">
                            "{allergy.symptoms || 'ไม่ระบุอาการ'}"
                          </div>
                        </div>
                        {allergy.date && (
                          <div className="flex items-center gap-2 text-xs font-black text-rose-400 uppercase tracking-widest">
                            <span>🕒 recorded:</span>
                            <span>{formatThaiDate(allergy.date)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="text-6xl mb-6 grayscale opacity-20">🍃</div>
                <h3 className="text-2xl font-black text-slate-300">ไม่พบข้อมูลการแพ้ยา</h3>
                <p className="text-slate-400 font-medium">สภาวะสุขภาพปกติสำหรับการใช้ยา</p>
              </div>
            )}

            <button
              onClick={() => setAllergyDetailModal({ open: false, allergies: [] })}
              className="w-full mt-10 py-5 rounded-[2rem] bg-slate-800 text-white font-black text-lg transition-all hover:bg-slate-950 hover:-translate-y-1 shadow-2xl active:scale-95"
            >
              รับทราบและปิดหน้านี้
            </button>
          </div>
        </div>
      </Modal>
      </>
    </div>
  );
}

export default CustomerDetailStaff;

