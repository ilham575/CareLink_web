import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/pharmacy/detail_customer.css';
import '../../../css/pages/staff/CustomerDetail_staff.css';
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

  // Refs to avoid stale closures in polling and event handlers
  const notificationRef = useRef(notification);
  const selectedBatchesRef = useRef(selectedBatches);
  
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
  // Count how many drugs with batches have a batch selected in the current UI
  const lotsSaved = (() => {
    const drugsWithBatches = customer?.prescribed_drugs?.filter(drugItem => {
      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
      return drug && drug.drug_batches && drug.drug_batches.length > 0;
    }) || [];
    
    if (drugsWithBatches.length === 0) return false;
    
    // Check if all drugs with batches have a selection
    const allSelected = drugsWithBatches.every(drugItem => {
      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
      return selectedBatches[drugId] && selectedBatches[drugId].trim() !== '';
    });
    
    return allSelected;
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

          // โหลด notification
          const notifRes = await fetch(
            API.notifications.getById(notificationId),
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
          console.log('[LoadData] === isNotificationOnly MODE ===');
          console.log('[LoadData] Full notification object:', notif);
          console.log('[LoadData] Notification type:', notif?.type);
          console.log('[LoadData] Notification staff_work_status:', notif?.staff_work_status);
          console.log('[LoadData] Loading staff status from notification (isNotificationOnly)');
          if (notif?.staff_work_status) {
            console.log('[LoadData] Found staff_work_status:', notif.staff_work_status);
            // If this notification is an assignment update from the pharmacy,
            // reset actionable status fields but preserve outOfStock.
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
              console.log('[LoadData] Setting reset status:', resetStatus);
              setStaffStatus(resetStatus);
              if (notif.staff_work_status.batches_selected) {
                setSelectedBatches(notif.staff_work_status.batches_selected);
              }
            } else {
              console.log('[LoadData] Setting full staff status:', notif.staff_work_status);
              setStaffStatus(notif.staff_work_status);
              // ดึง selected batches จากที่เก็บไว้ใน notification
              if (notif.staff_work_status.batches_selected) {
                setSelectedBatches(notif.staff_work_status.batches_selected);
              }
            }
          } else {
            console.log('[LoadData] ⚠️ No staff_work_status in notification, initializing empty status');
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
          console.log('[LoadData] Loading customer:', customerDocumentId);
          const customerRes = await fetch(
            API.customerProfiles.getByIdBasic(customerDocumentId),
            {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            }
          );
          
          if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
          
          const customerData = await customerRes.json();
          console.log('[LoadData] Customer data:', customerData.data);
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
              console.log('[LoadData] Searching notification for staff:', staffProfile.documentId, 'customer:', customerDocumentId);
              
              // โหลด notification ของลูกค้าคนนี้ที่ส่งมาให้ staff คนนี้
              // ค้นหาทั้งจาก customer_profile relation และจาก notification.data
              const notifRes = await fetch(
                API.notifications.list(`filters[staff_profile][documentId][$eq]=${staffProfile.documentId}&filters[type][$in][0]=customer_assignment&filters[type][$in][1]=customer_assignment_update&populate=*&sort[0]=createdAt:desc`),
                { headers: { Authorization: token ? `Bearer ${token}` : '' } }
              );

              if (notifRes.ok) {
                const notifData = await notifRes.json();
                console.log('[LoadData] All notifications:', notifData.data);
                
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
                  console.log('[LoadData] Searching by name/phone:', customerName, customerPhone);
                  
                  notif = notifData.data?.find(n => {
                    const d = n.data || {};
                    return (d.customer_name && d.customer_name === customerName) || (d.customer_phone && d.customer_phone === customerPhone);
                  });
                }
                
                // 4. ถ้ายังไม่เจอ ใช้ตัวล่าสุด
                if (!notif) {
                  notif = notifData.data?.[0];
                  console.log('[LoadData] Using latest notification:', notif?.documentId);
                }
                
                console.log('[LoadData] Found notification:', notif);
                console.log('[LoadData] notification.staff_work_status:', notif?.staff_work_status);
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
                  console.log('[LoadData] Setting staff status from notification');
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
                    
                    console.log('[LoadData] Check reset condition:', {
                      type: notif.type,
                      staffReceivedAt,
                      staffPreparedAt,
                      notifUpdatedAt,
                      staffAcknowledgedUpdate,
                      shouldReset: !staffAcknowledgedUpdate
                    });
                    
                    if (!staffAcknowledgedUpdate) {
                      // Reset เฉพาะเมื่อพนักงานยังไม่ได้ยืนยันรับข้อมูลหลังอัปเดต
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
                      console.log('[LoadData] Reset status for update notification:', resetStatus);
                      setStaffStatus(resetStatus);
                    } else {
                      // ใช้สถานะที่มีอยู่ เพราะพนักงานยืนยันแล้ว
                      console.log('[LoadData] Staff already acknowledged, keeping status:', notif.staff_work_status);
                      setStaffStatus(notif.staff_work_status);
                    }
                    // ดึง selected batches จากที่เก็บไว้ใน notification (always load for update notifications)
                    if (notif.staff_work_status.batches_selected) {
                      console.log('[LoadData] Loading batches_selected from update notification:', notif.staff_work_status.batches_selected);
                      setSelectedBatches(notif.staff_work_status.batches_selected);
                    }
                  } else {
                    console.log('[LoadData] Setting full status:', notif.staff_work_status);
                    setStaffStatus(notif.staff_work_status);
                    // ดึง selected batches จากที่เก็บไว้ใน notification
                    if (notif.staff_work_status.batches_selected) {
                      console.log('[LoadData] Loading batches_selected from notification:', notif.staff_work_status.batches_selected);
                      setSelectedBatches(notif.staff_work_status.batches_selected);
                    }
                  }
                } else {
                  console.log('[LoadData] ⚠️ No staff_work_status found in notification');
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
                console.log('[LoadData] ⚠️ No notification found');
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
        
        // Load pharmacy data if pharmacyId exists
        if (pharmacyId) {
          const pharmacyRes = await fetch(
            API.drugStores.getByDocumentId(pharmacyId),
            {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            }
          );
          
          if (pharmacyRes.ok) {
            const pharmacyData = await pharmacyRes.json();
            const store = pharmacyData.data?.find(item => item.documentId === pharmacyId);
            setPharmacy(store);
          }
          
          // Load drugs for this pharmacy
          const drugsRes = await fetch(
            API.drugs.listByStore(pharmacyId),
            {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            }
          );
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
      console.log('[EffectSync] 🔄 Syncing staffStatus from notification:', notification.staff_work_status);
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
        console.log('[VisibilityChange] Staff tab is now visible, checking for real-time updates...');
        
        try {
          const token = localStorage.getItem('jwt') || '';
          const notifRes = await fetch(
            API.notifications.getById(notification.documentId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (notifRes.ok) {
            const notifData = await notifRes.json();
            const updatedNotif = notifData.data;
            
            if (updatedNotif?.staff_work_status) {
              console.log('[VisibilityChange] 🔄 Detected real-time updates:', updatedNotif.staff_work_status);
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
      try {
        const token = localStorage.getItem('jwt') || '';
        const staffProfile = JSON.parse(localStorage.getItem('staff_profile') || '{}');
        
        let latestNotif = null;

        if (queryNotifId) {
           // Case 1: Specific Round - Reload specific notification
           const notifRes = await fetch(
             API.notifications.getById(queryNotifId),
             { headers: { Authorization: token ? `Bearer ${token}` : '' } }
           );
           if (notifRes.ok) {
              const resData = await notifRes.json();
              latestNotif = resData.data;
           }
        } else {
           // Case 2: Live View - Reload latest assignment
           if (!staffProfile?.documentId) return;
           const notifRes = await fetch(
             API.notifications.getStaffAssignments(staffProfile.documentId, customerDocumentId),
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
              console.log('[AutoReload] 📊 Updating staff status from reloaded notification');
              // console.log('[AutoReload] staff_work_status:', latestNotif.staff_work_status);
              
              setStaffStatus(latestNotif.staff_work_status);
              
              // 🔑 Sync batches_selected from notification, but ONLY if the user is not currently editing
              // Check if local selectedBatches matches the current notification's batches
              const currentNotifBatches = notificationRef.current?.staff_work_status?.batches_selected || {};
              const localBatches = selectedBatchesRef.current || {};
              const serverBatches = latestNotif.staff_work_status.batches_selected || {};
              
              const isDirty = JSON.stringify(localBatches) !== JSON.stringify(currentNotifBatches);
              
              if (serverBatches && !isDirty) {
                // If not dirty (user hasn't changed anything since last sync), ok to update from server
                if (JSON.stringify(localBatches) !== JSON.stringify(serverBatches)) {
                   console.log('[AutoReload] ✅ Update selectedBatches from server (not dirty)');
                   setSelectedBatches(serverBatches);
                }
              } else if (isDirty) {
                 console.log('[AutoReload] ⚠️ User has unsaved Lot changes, skipping sync for selectedBatches');
              }
            }
            
            // Only update main notification state if ID changed (e.g. switch to newer notification in live mode)
            // or if we are forcing a deep reload
            if (latestNotif.documentId !== notificationRef.current?.documentId) {
              console.log('[AutoReload] 🔄 Notification changed from', notificationRef.current?.documentId, 'to', latestNotif.documentId);
              setNotification(latestNotif);
            }
        }
      } catch (err) {
        console.error('[AutoReload] Error reloading notification:', err);
      }
    };

    // Poll faster to reduce time-to-update (2 seconds)
    const interval = setInterval(reloadNotification, 2000);
    return () => clearInterval(interval);
  }, [customerDocumentId, queryNotifId]);

  useEffect(() => {
    if (!notification?.documentId) return;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:1337';
    const token = localStorage.getItem('jwt') || '';

    console.log('[Socket] Attempting connection to:', socketUrl, 'with token:', !!token);

    // Create socket connection
    socketRef.current = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      // Faster reconnection to reduce downtime
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      reconnectionAttempts: 10,
      forceNew: false,
      rejectUnauthorized: false
    });

    console.log('[Socket] Created socket with config:', {
      url: socketUrl,
      hasToken: !!token,
      transports: ['websocket', 'polling']
    });

    // Handle connection
    socketRef.current.on('connect', () => {
      console.log('[Socket] Connected to Strapi server');
      console.log('[Socket] 🎉 Socket.IO transport used:', socketRef.current?.io?.engine?.transport?.name);
      console.log('[Socket] Socket ID:', socketRef.current?.id);
      
      // Join rooms: by notification ID and by customer ID
      const notifRoom = `notification:${notification.documentId}`;
      const customerRoom = `customer:${customerDocumentId}`;
      
      console.log('[Socket] Joining rooms:', { notifRoom, customerRoom });
      socketRef.current.emit('join', notifRoom);
      socketRef.current.emit('join', customerRoom);
    });

    // Handle connection error
    socketRef.current.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', {
        message: error?.message,
        data: error?.data,
        type: error?.type,
        code: error?.code
      });
      console.error('[Socket] Full error:', error);
      toast.error('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ - กรุณารีโหลดหน้า');
    });

    // Handle disconnect
    socketRef.current.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from server:', {
        reason,
        reconnecting: socketRef.current?.disconnected === false
      });
    });

    // Listen for notification updates
    socketRef.current.on('notification:update', (updatedNotif) => {
      console.log('[Socket] Received notification update:', updatedNotif);
      console.log('[Socket] Notification type:', updatedNotif?.type);
      console.log('[Socket] Notification title:', updatedNotif?.title);
      console.log('[Socket] Notification staff_work_status:', updatedNotif?.staff_work_status);
      console.log('[Socket] Full notification object:', JSON.stringify(updatedNotif, null, 2));
      
      if (!updatedNotif) return;

      // Always update notification state with the latest data
      console.log('[Socket] 🔄 Updating notification state with latest data');
      setNotification(updatedNotif);

      // Handle status reset for update notifications (preserve outOfStock)
      if (updatedNotif.type === 'customer_assignment_update') {
        // เช็คว่า staff acknowledged update นี้แล้วหรือยัง
        const staffReceivedAt = updatedNotif.staff_work_status?.received_at;
        const staffPreparedAt = updatedNotif.staff_work_status?.prepared_at;
        const notifUpdatedAt = updatedNotif.updatedAt;
        
        // ถ้าพนักงานยืนยันรับข้อมูล หรือ จัดยาเสร็จ หลังจาก notification ถูกอัปเดต = ไม่ต้อง reset
        const staffAcknowledgedUpdate = 
          (staffPreparedAt && notifUpdatedAt && new Date(staffPreparedAt) >= new Date(notifUpdatedAt) - 1000) ||
          (staffReceivedAt && notifUpdatedAt && new Date(staffReceivedAt) >= new Date(notifUpdatedAt) - 1000); // 1 sec tolerance
        
        console.log('[Socket] Check reset condition:', {
          type: updatedNotif.type,
          staffReceivedAt,
          staffPreparedAt,
          notifUpdatedAt,
          staffAcknowledgedUpdate
        });
        
        if (!staffAcknowledgedUpdate) {
          console.log('[Socket] ✅ Detected customer_assignment_update - RESETTING STATUS to initial state');
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
          console.log('[Socket] Reset status:', resetStatus);
          setStaffStatus(resetStatus);
          toast.success('🔄 เภสัชกรส่งข้อมูลอัพเดต - สถานะถูกรีเซ็ทแล้ว');
        } else {
          console.log('[Socket] Staff already acknowledged, keeping status:', updatedNotif.staff_work_status);
          if (updatedNotif.staff_work_status) {
            setStaffStatus(updatedNotif.staff_work_status);
          }
        }
      } else {
        console.log('[Socket] ℹ️ Not customer_assignment_update, type is:', updatedNotif.type);
        if (updatedNotif.staff_work_status) {
          console.log('[Socket] 📊 Updating staff status from notification:', updatedNotif.staff_work_status);
          setStaffStatus(updatedNotif.staff_work_status);
          // Only show toast if there's a real change (not initial load)
          if (notificationRef.current?.documentId === updatedNotif.documentId) {
            toast.info('🔄 ข้อมูลถูกอัพเดท');
          }
        }
      }

      if (updatedNotif.staff_work_status?.batches_selected) {
        console.log('[Socket] Setting selected batches (if not dirty):', updatedNotif.staff_work_status.batches_selected);
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
      console.log('[Socket] 📨 Received customer data update from pharmacy:', updatedCustomer);
      
      if (!updatedCustomer) return;

      // Refresh customer data to reflect pharmacist updates
      setCustomer(updatedCustomer);
      toast.warning('⚠️ เภสัชกรได้อัพเดตข้อมูลผู้ป่วย - กรุณาตรวจสอบข้อมูลล่าสุด');
    });

    // Listen for pharmacy notifications (if they send updates)
    socketRef.current.on('pharmacy:update', (pharmacyUpdate) => {
      console.log('[Socket] 📨 Received pharmacy update:', pharmacyUpdate);
      
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

      console.log('Drugs with batches:', drugsWithBatches.length);
      console.log('Selected batches:', selectedBatches);

      // ตรวจสอบว่ายาทั้งหมดที่มี batch ถูกเลือกแล้ว
      const missingBatches = drugsWithBatches.filter(drugItem => {
        const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
        const isSelected = selectedBatches[drugId] && selectedBatches[drugId].trim() !== '';
        console.log(`Drug ${drugId}: isSelected=${isSelected}, selectedValue='${selectedBatches[drugId]}'`);
        return !isSelected;
      });

      console.log('Missing batches:', missingBatches.length);

      if (missingBatches.length > 0) {
        toast.error(`กรุณาเลือก Lot สำหรับทุกรายการยา (ขาด ${missingBatches.length} รายการ)`);
        return;
      }

      // บันทึก Lot ลงใน notification
      const updatedStatus = { ...staffStatus, batches_selected: selectedBatches };

      console.log('[SaveLots] Sending to backend:', {
        staffStatus: staffStatus,
        selectedBatches: selectedBatches,
        updatedStatus: updatedStatus
      });

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
      console.log('[SaveLots] Backend response:', responseData);
      console.log('[SaveLots] Response staff_work_status:', responseData?.data?.staff_work_status);

      if (res.ok) {
        // Use the response data from backend instead of local state
        const backendStaffStatus = responseData?.data?.staff_work_status || updatedStatus;
        console.log('[SaveLots] Using staff_work_status from backend:', backendStaffStatus);
        
        setStaffStatus(backendStaffStatus);
        setNotification(prev => ({ ...prev, staff_work_status: backendStaffStatus }));
        
        // ✅ Ensure batches_selected is set from backend response
        if (backendStaffStatus.batches_selected) {
          console.log('[SaveLots] ✅ Setting selectedBatches from backend:', backendStaffStatus.batches_selected);
          setSelectedBatches(backendStaffStatus.batches_selected);
        } else {
          // Fallback: if backend doesn't return batches_selected, use local state
          console.warn('[SaveLots] ⚠️ Backend did not return batches_selected, using local state');
          setSelectedBatches(prev => ({ ...prev, ...selectedBatches }));
        }
        
        // 🚀 Broadcast to pharmacy page via Socket.IO
        if (socketRef.current?.connected) {
          socketRef.current.emit('notification:update', {
            documentId: notification.documentId,
            customerDocumentId,
            staff_work_status: backendStaffStatus,
            batches_selected: backendStaffStatus.batches_selected || selectedBatches,
            is_read: true,
            timestamp: new Date().toISOString()
          });
          console.log('[SaveLots] 📡 Broadcast Lots selection to pharmacy via Socket.IO');
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
        updatedStatus.batches_selected = selectedBatches;
        console.log('[HandleUpdateStatus] Saving batches_selected with prepared status:', selectedBatches);
        // Reset cancelled status เมื่อจัดส่งยารอบใหม่
        updatedStatus.cancelled = false;
        updatedStatus.cancelled_at = null;
        updatedStatus.cancelled_note = '';

        // ลดสต็อก batch ที่เลือก
        for (const drugItem of customer.prescribed_drugs) {
          const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
          const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
          // ดึง batch ID จาก staffStatus.batches_selected (ที่บันทึกไปแล้ว)
          const selectedBatchId = staffStatus.batches_selected?.[drugId] || selectedBatches[drugId];

          if (selectedBatchId) {
            // ลดสต็อก batch นี้
            try {
              const batchRes = await fetch(API.drugBatches.getById(selectedBatchId), {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` }
              });

              if (batchRes.ok) {
                const batchData = await batchRes.json();
                const batch = batchData.data;
                const newQuantity = Math.max(0, (batch.quantity || 0) - quantity);

                // Update batch quantity
                await fetch(API.drugBatches.getById(selectedBatchId), {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    data: { quantity: newQuantity }
                  })
                });
              }
            } catch (err) {
              console.error(`Error updating batch ${selectedBatchId}:`, err);
            }
          }
        }
      }

      const notifIdentifier = notification?.documentId;
      console.log('[UpdateStatus] Updating notification:', notifIdentifier);
      console.log('[UpdateStatus] New staff_work_status:', updatedStatus);
      
      const res = await fetch(API.notifications.updateByDocumentId(notifIdentifier), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            staff_work_status: updatedStatus,
            is_read: true
          }
        })
      });

      console.log('[UpdateStatus] Response status:', res.status);
      
      if (res.ok) {
        const responseData = await res.json();
        console.log('[UpdateStatus] Response data:', responseData);
        console.log('[UpdateStatus] Response staff_work_status:', responseData?.data?.staff_work_status);
        
        // Use response data from backend to ensure sync
        const backendStaffStatus = responseData?.data?.staff_work_status || updatedStatus;
        console.log('[UpdateStatus] Using staff_work_status from backend:', backendStaffStatus);
        
        setStaffStatus(backendStaffStatus);
        setNotification(prev => ({ ...prev, staff_work_status: backendStaffStatus, is_read: true }));
        
        // Update selectedBatches from backend response to ensure sync
        if (backendStaffStatus.batches_selected) {
          console.log('[UpdateStatus] Updating selectedBatches from backend:', backendStaffStatus.batches_selected);
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
          
          console.log('[UpdateStatus] 📡 Emitted real-time update via Socket.IO to rooms:', [notifRoom, customerRoom]);
        } else {
          console.warn('[UpdateStatus] ⚠️ Socket not connected, update broadcast skipped');
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
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
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

      // กู้คืนสต็อก batch ที่ลดไป
      for (const drugItem of customer.prescribed_drugs) {
        const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
        const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
        const selectedBatchId = selectedBatches[drugId];

        if (selectedBatchId) {
          try {
            const batchRes = await fetch(API.drugBatches.getById(selectedBatchId), {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` }
            });

            if (batchRes.ok) {
              const batchData = await batchRes.json();
              const batch = batchData.data;
              // บวกคืนจำนวนยาที่ลดไป
              const newQuantity = (batch.quantity || 0) + quantity;

              await fetch(API.drugBatches.getById(selectedBatchId), {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  data: { quantity: newQuantity }
                })
              });
            }
          } catch (err) {
            console.error(`Error restoring batch ${selectedBatchId}:`, err);
          }
        }
      }

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
      <div className="customer-detail-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
        <main className="customer-detail-main">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="customer-detail-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
        <main className="customer-detail-main">
          <div className="error-container">
            <h2>ไม่พบข้อมูลลูกค้า</h2>
            <button className="btn-back" onClick={handleBack}>
              กลับ
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const user = customer.users_permissions_user;
  const notifData = notification?.data || {};

  // Debug: Log staffStatus to console
  console.log('[Render] Current staffStatus:', staffStatus);
  console.log('[Render] staffStatus.received:', staffStatus.received);
  console.log('[Render] staffStatus.received_at:', staffStatus.received_at);
  console.log('[Render] staffStatus.prepared:', staffStatus.prepared);
  console.log('[Render] staffStatus.prepared_at:', staffStatus.prepared_at);
  console.log('[Render] Current selectedBatches:', selectedBatches);
  console.log('[Render] Notification staff_work_status:', notification?.staff_work_status);
  console.log('[Render] Notification staff_work_status.batches_selected:', notification?.staff_work_status?.batches_selected);
  console.log('[Render] Full notification object:', notification);

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
    <div className="customer-detail-page">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
      
      <main className="customer-detail-main">
        {/* Header summary: patient info only */}
        <div className="detail-header-summary">
          <div className="detail-header-left">
            <div className="detail-header-name">
              👤 {user?.full_name || 'ไม่พบชื่อ'}
            </div>
            <div className="detail-header-meta">
              <span className="meta-item meta-phone">
                📱 {user?.phone || '-'}
              </span>
              <span className="dot">•</span>
              <span className="meta-item meta-date">
                📅 {customer.Follow_up_appointment_date ? formatThaiDate(customer.Follow_up_appointment_date) : 'ไม่มีวันนัด'}
              </span>
            </div>
          </div>
          <div className="detail-header-right">
            <div className="detail-header-badges">
              <div className="pill-badge">
                💊 {customer.prescribed_drugs ? customer.prescribed_drugs.length : 0} รายการ
              </div>
            </div>
          </div>
        </div>

        {/* สถานะการทำงานของ Staff */}
        <div className="staff-status-panel">
          <h3>📊 สถานะการดำเนินการ</h3>
          <div className="status-btn-group">
            <button
              onClick={() => setStatusModal({ open: true, type: 'received', note: '' })}
              disabled={staffStatus.received}
              className={`status-btn received ${staffStatus.received ? 'active' : ''}`}
            >
              {staffStatus.received ? (
                <>
                  ✅ ได้รับข้อมูล
                  {staffStatus.received_at && (
                    <div className="btn-time">
                      {formatThaiDate(staffStatus.received_at)}
                    </div>
                  )}
                </>
              ) : '📥 ยืนยันรับข้อมูล'}
            </button>
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'prepared', note: '' })}
              disabled={staffStatus.prepared || !staffStatus.received || !lotsSaved}
              className={`status-btn prepared ${staffStatus.prepared ? 'active' : ''}`}
              style={{ opacity: (!staffStatus.received || !lotsSaved) ? 0.5 : 1 }}
              title={!lotsSaved ? 'กรุณาบันทึก Lot ยาก่อน' : staffStatus.prepared ? 'จัดยาส่งแล้ว' : ''}
            >
              {staffStatus.prepared ? (
                <>
                  ✅ จัดยาสำเร็จ
                  {staffStatus.prepared_at && (
                    <div className="btn-time">
                      {formatThaiDate(staffStatus.prepared_at)}
                    </div>
                  )}
                </>
              ) : '📦 จัดยาส่งไปแล้ว'}
            </button>
            
            {staffStatus.prepared && (
              <button
                onClick={() => setStatusModal({ open: true, type: 'cancelDelivery', note: '' })}
                className="status-btn cancel"
                title="ยกเลิกการจัดส่งและกู้คืนสต็อกยา"
              >
                ⏮️ ยกเลิกการจัดส่ง
              </button>
            )}
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'outOfStock', note: '', selectedDrugs: [] })}
              disabled={staffStatus.prepared}
              className="status-btn out-of-stock"
              style={{ opacity: staffStatus.prepared ? 0.5 : 1 }}
              title={staffStatus.prepared ? 'ปิดปุ่มนี้หลังจากจัดส่งยา' : ''}
            >
              🚨 แจ้งยาหมดสต็อก
            </button>
          </div>
          
          {notifData.staff_note && (
            <div className="note-box">
              <strong>📝 หมายเหตุ:</strong> {notifData.staff_note}
            </div>
          )}

          {notifData.note && (
            <div className="note-box" style={{ borderColor: 'rgba(255, 255, 255, 0.5)' }}>
              <strong>💬 หมายเหตุจากเภสัชกร:</strong> {notifData.note}
            </div>
          )}
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={key => setActiveTab(key)} 
          defaultActiveKey="1" 
          type="card" 
          size="large"
          className="customer-detail-tabs responsive"
          items={[
            {
              label: <span>📋 ข้อมูลพื้นฐาน</span>,
              key: '1',
              children: (
            <div className="customer-info-form responsive">
              {/* Essential Customer Info */}
              <div className="essential-info-grid">
                <div className="info-card">
                  <div className="info-card-header">
                    <span className="info-card-icon">👤</span>
                    <h3>ข้อมูลติดต่อ</h3>
                  </div>
                  <div className="info-card-content">
                    <div className="info-row">
                      <label>ชื่อ-นามสกุล:</label>
                      <span>{user?.full_name || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="info-row">
                      <label>เบอร์โทรศัพท์:</label>
                      <span>{user?.phone || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card-header">
                    <span className="info-card-icon">⚠️</span>
                    <h3>ข้อมูลสำคัญ</h3>
                  </div>
                  <div className="info-card-content">
                    <div className="allergy-info-section">
                      <div className="allergy-label">⚠️ ยาที่แพ้</div>
                      {customer.Allergic_drugs ? (
                        (() => {
                          const allergies = parseAllergies(customer.Allergic_drugs);
                          return (
                            <button
                              onClick={() => {
                                setAllergyDetailModal({
                                  open: true,
                                  allergies: allergies
                                });
                              }}
                              className={`allergy-btn ${allergies.length > 0 ? 'has-allergy' : 'no-allergy'}`}
                            >
                              {allergies.length > 0 
                                ? `👀 ดูรายละเอียด (${allergies.length} รายการ)` 
                                : '✓ ไม่มี'
                              }
                            </button>
                          );
                        })()
                      ) : (
                        <button
                          disabled
                          className="allergy-btn no-allergy"
                        >
                          ✓ ไม่มี
                        </button>
                      )}
                    </div>
                    <div className="info-row">
                      <label>โรคประจำตัว:</label>
                      <span>{customer.congenital_disease || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              )
            },
            {
              label: <span>🩺 อาการและการติดตาม</span>,
              key: '2',
              children: (
            <div className="symptoms-followup-panel responsive">
              {/* อาการปัจจุบัน */}
              <div className="symptom-section">
                <div className="symptom-section-header">
                  <h3 className="section-title">🩺 อาการปัจจุบัน</h3>
                </div>
                
                <div className="symptom-card">
                  {(customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) ? (
                    <>
                      <div className="symptom-main">
                        <label>อาการหลัก:</label>
                        <div className="symptom-display">
                          {(() => {
                            const sym = customer.Customers_symptoms;
                            if (!sym) return '-';
                            if (typeof sym === 'object') return sym.main || sym.symptom || 'ไม่ระบุอาการ';
                            return sym;
                          })()}
                        </div>
                      </div>
                      {(customer.symptom_history || (typeof customer.Customers_symptoms === 'object' && customer.Customers_symptoms?.history)) && (
                        <div className="symptom-history">
                          <label>ประวัติการเจ็บป่วย:</label>
                          <div className="symptom-display">
                            {customer.symptom_history || customer.Customers_symptoms?.history}
                          </div>
                        </div>
                      )}
                      {(customer.symptom_note || (typeof customer.Customers_symptoms === 'object' && customer.Customers_symptoms?.note)) && (
                        <div className="symptom-note">
                          <label>หมายเหตุ:</label>
                          <div className="symptom-display">
                            {customer.symptom_note || customer.Customers_symptoms?.note}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="symptom-empty">
                      <div className="symptom-empty-icon">📝</div>
                      <h4>ไม่มีข้อมูลอาการ</h4>
                    </div>
                  )}
                </div>
              </div>

              {/* การนัดติดตาม */}
              <div className="followup-section">
                <h3 className="section-title">📅 การนัดติดตาม</h3>
                <div className="followup-card">
                  <div className="current-appointment">
                    <div className="appointment-info">
                      <span className="appointment-label">วันนัดติดตามอาการ:</span>
                      <span className="appointment-date">
                        {customer.Follow_up_appointment_date ? formatThaiDate(customer.Follow_up_appointment_date) : 'ยังไม่ได้กำหนด'}
                      </span>
                    </div>
                  </div>
                  {customer.Follow_up_appointment_date && (
                    <div className="appointment-status">
                      <div className={`status-badge ${new Date(customer.Follow_up_appointment_date) > new Date() ? 'upcoming' : 'overdue'}`}>
                        {new Date(customer.Follow_up_appointment_date) > new Date() ? '📋 กำหนดการ' : '⚠️ ครบกำหนด'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ข้อมูลเตือนสำคัญ */}
              <div className="alert-section">
                <h3 className="section-title">⚠️ ข้อมูลสำคัญที่ต้องระวัง</h3>
                <div className="alert-grid">
                  <div className="alert-card allergy">
                    <div className="alert-icon">🚫</div>
                    <div className="alert-content">
                      <h4>ยาที่แพ้</h4>
                      {customer.Allergic_drugs ? (
                        (() => {
                          const allergies = parseAllergies(customer.Allergic_drugs);
                          return (
                            <div>
                              {allergies.map((allergy, idx) => (
                                <p key={idx} style={{ margin: '4px 0', fontWeight: 'bold' }}>💊 {allergy.drug || allergy.allergy || 'ไม่ระบุชื่อยา'}</p>
                              ))}
                            </div>
                          );
                        })()
                      ) : (
                        <p>ไม่มีข้อมูล</p>
                      )}
                    </div>
                  </div>
                  <div className="alert-card disease">
                    <div className="alert-icon">🏥</div>
                    <div className="alert-content">
                      <h4>โรคประจำตัว</h4>
                      <p>{customer.congenital_disease || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              )
            },
            {
              label: <span>💊 รายการยา <span className="tab-badge">{customer?.prescribed_drugs?.length || 0}</span></span>,
              key: '3',
              children: (
            <div className="customer-actions-panel responsive">
              <div className="actions-header responsive">
                <h2>รายการยาที่ต้องใช้</h2>
              </div>

              {/* แสดงรายการยาที่กำหนดแล้ว */}
              {customer.prescribed_drugs && customer.prescribed_drugs.length > 0 ? (
                <div style={{ marginBottom: '20px' }}>
                  <div className="prescribed-drugs-header">
                    <div className="prescribed-drugs-info">
                      <span className="prescribed-drugs-icon">💊</span>
                      <div>
                        <h3 className="prescribed-drugs-title">
                          ยาที่กำหนดแล้ว:
                        </h3>
                        <p className="prescribed-drugs-patient">
                          {user?.full_name || 'ผู้ป่วย'}
                        </p>
                      </div>
                    </div>
                    <div className="prescribed-drugs-count">
                      {customer.prescribed_drugs.length} รายการ
                    </div>
                  </div>
                  
                  {/* ข้อความเตือนก่อนเลือก Lot */}
                  {!staffStatus.received && (
                    <div style={{ marginBottom: '20px', padding: '15px', background: '#fff7e6', border: '2px solid #ffc53d', borderRadius: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ad6800' }}>
                        ⚠️ กรุณากด "ยืนยันรับข้อมูล" ก่อนเลือก Lot ยา
                      </div>
                    </div>
                  )}

                  {/* Grid Layout สำหรับยา */}
                  <div className="prescribed-drugs-grid">
                    {customer.prescribed_drugs.map((drugItem, index) => {
                      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                      const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                      const isOutOfStock = staffStatus.outOfStock.includes(drugId);
                      
                      return (
                        <div key={drugId} className="prescribed-drug-card-individual" style={{
                          opacity: isOutOfStock ? 0.6 : staffStatus.prepared ? 0.85 : 1,
                          border: isOutOfStock ? '2px solid #ff4d4f' : staffStatus.prepared ? '2px solid #0050b3' : undefined,
                          background: staffStatus.prepared ? '#f0f5ff' : undefined,
                          position: 'relative'
                        }}>
                          {staffStatus.prepared && (
                            <div className="drug-lock-badge">
                              🔒 ล็อก
                            </div>
                          )}
                          {/* Quantity Badge */}
                          <div className="prescribed-drug-quantity-badge">
                            จำนวน {quantity}
                          </div>

                          {isOutOfStock && (
                            <div className="drug-out-of-stock-badge">
                              หมดสต็อก
                            </div>
                          )}

                          {/* Drug Icon และ Badge */}
                          <div className="prescribed-drug-header">
                            <div className="prescribed-drug-icon">
                              Rx
                            </div>
                            <div className="prescribed-drug-info">
                              <h4 className="prescribed-drug-name">
                                {drug ? drug.name_th : 'กำลังโหลด...'}
                              </h4>
                              <p className="prescribed-drug-name-en">
                                {drug ? drug.name_en : '-'}
                              </p>
                              {drug && drug.manufacturer && (
                                <div className="manufacturer-tag">
                                  📦 {drug.manufacturer}
                                </div>
                              )}
                              {drug && drug.price && (
                                <div className="prescribed-drug-price">
                                  ราคา: {drug.price} บาท
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Drug Description */}
                          {drug && drug.description && (
                            <div className="prescribed-drug-description">
                              <p>
                                {drug.description}
                              </p>
                            </div>
                          )}

                          {/* Batch Selection - Lots for Staff */}
                          {drug && drug.drug_batches && drug.drug_batches.length > 0 && (
                            <div className="lot-selection-box" style={{ opacity: staffStatus.prepared ? 0.6 : 1 }}>
                              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#0050b3' }}>
                                🏷️ เลือก Lot ที่ใช้:
                              </div>
                              <select
                                disabled={staffStatus.prepared || !staffStatus.received}
                                value={selectedBatches[drugId] || ''}
                                onChange={(e) => {
                                  setSelectedBatches(prev => ({
                                    ...prev,
                                    [drugId]: e.target.value
                                  }));
                                }}
                                className="lot-select"
                                style={{
                                  background: (staffStatus.prepared || !staffStatus.received) ? '#f5f5f5' : 'white',
                                }}
                              >
                                {!selectedBatches[drugId] && <option value="">-- เลือก Lot --</option>}
                                {drug.drug_batches.map((batch, idx) => (
                                  <option key={batch.documentId || idx} value={batch.documentId || batch.id}>
                                    {batch.lot_number} (เหลือ {batch.quantity}) | หมดอายุ: {batch.expiry_date}
                                  </option>
                                ))}
                              </select>
                              
                              {selectedBatches[drugId] && (
                                <div className="selected-lot-info" style={{ border: staffStatus.prepared ? '2px solid #52c41a' : '1px solid #b7eb8f', fontWeight: staffStatus.prepared ? 'bold' : 'normal' }}>
                                  <span>
                                    {staffStatus.prepared ? '🔒 ล็อกแล้ว - ' : '✅ '}เลือก Lot: <strong>{drug.drug_batches.find(b => b.documentId === selectedBatches[drugId] || b.id === selectedBatches[drugId])?.lot_number}</strong>
                                  </span>
                                  {!staffStatus.prepared && (
                                    <button
                                      onClick={() => {
                                        setSelectedBatches(prev => ({
                                          ...prev,
                                          [drugId]: ''
                                        }));
                                      }}
                                      disabled={!staffStatus.received}
                                      className="cancel-lot-btn"
                                      title={!staffStatus.received ? 'กรุณายืนยันรับข้อมูลก่อน' : 'ยกเลิกการเลือก Lot นี้'}
                                    >
                                      ✕ ยกเลิก
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Show all available batches info */}
                          {drug && drug.drug_batches && drug.drug_batches.length > 0 && !staffStatus.prepared && (
                            <details style={{ marginTop: '10px', fontSize: '12px' }}>
                              <summary style={{ cursor: 'pointer', color: '#666', fontWeight: '500' }}>
                                📋 ข้อมูล Lots ทั้งหมด ({drug.drug_batches.length})
                              </summary>
                              <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #e8e8e8' }}>
                                {drug.drug_batches.map((batch, idx) => (
                                  <div key={batch.documentId || idx} style={{ marginBottom: '8px', padding: '6px', background: '#fafafa', borderRadius: '3px' }}>
                                    <div><strong>Lot:</strong> {batch.lot_number}</div>
                                    <div><strong>สต็อก:</strong> {batch.quantity}</div>
                                    {batch.date_produced && <div><strong>วันผลิต:</strong> {batch.date_produced}</div>}
                                    {batch.expiry_date && <div><strong>หมดอายุ:</strong> <span style={{ color: '#ff4d4f' }}>{batch.expiry_date}</span></div>}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                          {/* Show locked info when prepared */}
                          {drug && drug.drug_batches && drug.drug_batches.length > 0 && staffStatus.prepared && selectedBatches[drugId] && (
                            <div style={{ marginTop: '10px', fontSize: '12px', padding: '10px', background: '#f0f5ff', borderRadius: '4px', border: '2px solid #0050b3', color: '#0050b3', fontWeight: 'bold' }}>
                              🔒 ข้อมูลที่ส่งแล้ว:
                              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 'normal', color: '#000' }}>
                                Lot: <strong>{drug.drug_batches.find(b => b.documentId === selectedBatches[drugId] || b.id === selectedBatches[drugId])?.lot_number}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ปุ่มบันทึก Lot - ซ่อนเมื่อบันทึกแล้วหรือจัดส่งยาแล้ว */}
                  {!lotsSaved && !staffStatus.prepared && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#fff7e6', border: '2px solid #ffc53d', borderRadius: '8px' }}>
                      <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold', color: '#ad6800' }}>
                        ⚠️ กรุณาบันทึก Lot ยาที่เลือกก่อน
                      </div>
                      <button
                        onClick={handleSaveLots}
                        disabled={!staffStatus.received}
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: staffStatus.received ? 'linear-gradient(135deg, #1890ff, #0050b3)' : 'rgba(0,0,0,0.25)',
                          color: 'white',
                          cursor: staffStatus.received ? 'pointer' : 'not-allowed',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          transition: 'all 0.3s',
                          opacity: staffStatus.received ? 1 : 0.6
                        }}
                        onMouseEnter={(e) => {
                          if (staffStatus.received) {
                            e.target.style.background = 'linear-gradient(135deg, #0050b3, #003d99)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (staffStatus.received) {
                            e.target.style.background = 'linear-gradient(135deg, #1890ff, #0050b3)';
                          }
                        }}
                        title={!staffStatus.received ? 'กรุณายืนยันรับข้อมูลก่อน' : ''}
                      >
                        💾 บันทึก Lot ยาที่เลือก
                      </button>
                    </div>
                  )}

                  {/* แสดงสถานะเมื่อบันทึก Lot แล้ว แต่ยังไม่ได้จัดส่ง */}
                  {lotsSaved && !staffStatus.prepared && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#f6ffed', border: '2px solid #52c41a', borderRadius: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#274e0a' }}>
                        ✅ บันทึก Lot ยาเรียบร้อยแล้ว - สามารถกด "จัดยาส่งแล้ว" ได้
                      </div>
                    </div>
                  )}

                  {/* แสดงสถานะเมื่อจัดส่งยาแล้ว */}
                  {staffStatus.prepared && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#e6f7ff', border: '2px solid #1890ff', borderRadius: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0050b3' }}>
                        ✅ จัดส่งยาเรียบร้อยแล้ว
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-drugs-placeholder">
                  <div className="no-drugs-placeholder-icon">💊</div>
                  <h3>
                    ยังไม่มีรายการยาที่กำหนด
                  </h3>
                </div>
              )}
            </div>
              )
            },
            {
              label: <span>📋 ดำเนินการ</span>,
              key: '4',
              children: (
            <div className="customer-actions-panel responsive">
              {/* Status Summary */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: 'bold' }}>📊 สรุปสถานะการดำเนินการ</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {/* Step 1: Received */}
                  <div className="process-step-card" style={{
                    border: staffStatus.received ? '2px solid #52c41a' : '2px solid #d9d9d9',
                    background: staffStatus.received ? '#f6ffed' : '#fafafa',
                  }}>
                    <div className="step-number" style={{ color: staffStatus.received ? '#274e0a' : '#8c8c8c' }}>
                      ขั้นตอนที่ 1
                    </div>
                    <div className="step-title" style={{ color: staffStatus.received ? '#52c41a' : '#262626' }}>
                      {staffStatus.received ? '✅ ได้รับข้อมูล' : '⏳ รอยืนยัน'}
                    </div>
                    {staffStatus.received && staffStatus.received_at && (
                      <div className="step-time">
                        {new Date(staffStatus.received_at).toLocaleString('th-TH')}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Lots Selected */}
                  <div className="process-step-card" style={{
                    border: lotsSaved ? '2px solid #52c41a' : '2px solid #d9d9d9',
                    background: lotsSaved ? '#f6ffed' : '#fafafa',
                    opacity: !staffStatus.received ? 0.6 : 1,
                  }}>
                    <div className="step-number" style={{ color: lotsSaved ? '#274e0a' : '#8c8c8c' }}>
                      ขั้นตอนที่ 2
                    </div>
                    <div className="step-title" style={{ color: lotsSaved ? '#52c41a' : '#262626' }}>
                      {lotsSaved ? '✅ บันทึก Lot' : '⏳ รอบันทึก'}
                    </div>
                    {lotsSaved && (
                      <div className="step-time">
                        {Object.keys(selectedBatches).filter(k => selectedBatches[k]).length} รายการ
                      </div>
                    )}
                  </div>

                  {/* Step 3: Prepared */}
                  <div className="process-step-card" style={{
                    border: staffStatus.prepared ? '2px solid #52c41a' : '2px solid #d9d9d9',
                    background: staffStatus.prepared ? '#f6ffed' : '#fafafa',
                    opacity: !lotsSaved ? 0.6 : 1,
                  }}>
                    <div className="step-number" style={{ color: staffStatus.prepared ? '#274e0a' : '#8c8c8c' }}>
                      ขั้นตอนที่ 3
                    </div>
                    <div className="step-title" style={{ color: staffStatus.prepared ? '#52c41a' : '#262626' }}>
                      {staffStatus.prepared ? '✅ จัดส่งแล้ว' : '⏳ รอจัดส่ง'}
                    </div>
                    {staffStatus.prepared && staffStatus.prepared_at && (
                      <div className="step-time">
                        {new Date(staffStatus.prepared_at).toLocaleString('th-TH')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-container" style={{ marginBottom: '20px' }}>
                  <div className="progress-label" style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>
                    ความคืบหน้า
                  </div>
                  <div className="progress-track" style={{ width: '100%', height: '100%', background: '#e8e8e8', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="progress-bar" style={{
                      height: '8px',
                      width: staffStatus.prepared ? '100%' : lotsSaved ? '66%' : staffStatus.received ? '33%' : '0%',
                      background: 'linear-gradient(90deg, #52c41a 0%, #73d13d 100%)',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                  <div className="progress-text" style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                    {staffStatus.prepared ? '100% เสร็จสิ้น' : lotsSaved ? '66% ระหว่างจัดส่ง' : staffStatus.received ? '33% รับข้อมูลแล้ว' : '0% ยังไม่เริ่ม'}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    className="action-btn green responsive" 
                    onClick={handleBack}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#1890ff',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    ← กลับไปยังรายการ
                  </button>
                </div>
              </div>

              {/* Notes Display */}
              {(staffStatus.prepared_note || notifData.note) && (
                <div style={{ marginTop: '20px', padding: '15px', background: '#f0f5ff', border: '2px solid #1890ff', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '10px', color: '#0050b3', fontWeight: 'bold' }}>📝 หมายเหตุ</h4>
                  {staffStatus.prepared_note && (
                    <div style={{ marginBottom: '8px', padding: '8px', background: 'white', borderRadius: '4px', borderLeft: '3px solid #1890ff' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>หมายเหตุการจัดส่ง:</div>
                      <div style={{ fontSize: '14px', color: '#000' }}>{staffStatus.prepared_note}</div>
                    </div>
                  )}
                  {notifData.note && (
                    <div style={{ padding: '8px', background: 'white', borderRadius: '4px', borderLeft: '3px solid #faad14' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>หมายเหตุจากเภสัชกร:</div>
                      <div style={{ fontSize: '14px', color: '#000' }}>{notifData.note}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Out of Stock Info */}
              {staffStatus.outOfStock && staffStatus.outOfStock.length > 0 && (
                <div style={{ marginTop: '20px', padding: '15px', background: '#fff7e6', border: '2px solid #faad14', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '10px', color: '#ad6800', fontWeight: 'bold' }}>🚨 ยาที่หมดสต็อก</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {staffStatus.outOfStock.map((drugId, idx) => {
                      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                      return (
                        <div key={idx} style={{
                          padding: '6px 12px',
                          background: '#ffccc7',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#ad2102'
                        }}>
                          {drug ? drug.name_th : drugId}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
              )
            }
          ]}
        />
      </main>

      <Footer />

      {/* Status Update Modal */}
      <Modal
        title={
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {statusModal.type === 'received' && '📥 ยืนยันรับข้อมูล'}
            {statusModal.type === 'prepared' && '📦 ยืนยันจัดยาส่งแล้ว'}
            {statusModal.type === 'outOfStock' && '🚨 แจ้งยาหมดสต็อก'}
            {statusModal.type === 'cancelDelivery' && '⏮️ ยกเลิกการจัดส่ง'}
          </div>
        }
        open={statusModal.open}
        onCancel={() => setStatusModal({ open: false, type: '', note: '', selectedDrugs: [] })}
        centered
        width={statusModal.type === 'outOfStock' ? 600 : 450}
        footer={[
          <button
            key="cancel"
            onClick={() => setStatusModal({ open: false, type: '', note: '', selectedDrugs: [] })}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            ยกเลิก
          </button>,
          <button
            key="confirm"
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
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: statusModal.type === 'cancelDelivery' ? 'linear-gradient(135deg, #ff7a45, #ff4d4f)' : 'linear-gradient(135deg, #52c41a, #73d13d)',
              color: 'white',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            {statusModal.type === 'cancelDelivery' ? 'ยืนยันยกเลิก' : 'ยืนยัน'}
          </button>
        ]}
      >
        <div style={{ padding: '20px 0' }}>
          {statusModal.type === 'received' && (
            <p>คุณต้องการยืนยันว่าได้รับข้อมูลลูกค้าแล้วใช่หรือไม่?</p>
          )}
          {statusModal.type === 'prepared' && (
            <p>คุณได้จัดยาส่งไปให้ลูกค้าเรียบร้อยแล้วใช่หรือไม่?</p>
          )}
          {statusModal.type === 'cancelDelivery' && (
            <div>
              <div style={{
                padding: '12px',
                background: '#fff7e6',
                border: '2px solid #ffc53d',
                borderRadius: '6px',
                marginBottom: '15px',
                color: '#ad6800',
                fontWeight: 'bold'
              }}>
                ⚠️ ยกเลิกการจัดส่ง?
              </div>
              <p style={{ marginBottom: '10px' }}>
                การทำการนี้จะ:
              </p>
              <ul style={{ marginBottom: '15px', paddingLeft: '20px', color: '#666' }}>
                <li>🔄 กู้คืนสต็อกยาทั้งหมดที่ลดไป</li>
                <li>♻️ รีเซ็ตสถานะการจัดส่ง</li>
                <li>📝 บันทึกหมายเหตุการยกเลิก</li>
                <li>📢 แจ้งเภสัชกรรับทราบ</li>
              </ul>
              <p style={{ fontSize: '14px', color: '#999' }}>
                กรุณาระบุเหตุผลการยกเลิก (ตัวเลือก):
              </p>
            </div>
          )}
          {statusModal.type === 'outOfStock' && (
            <div>
              <p style={{ marginBottom: '15px' }}>เลือกยาที่หมดสต็อก:</p>
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                border: '1px solid #e8e8e8', 
                borderRadius: '6px',
                padding: '10px'
              }}>
                {customer.prescribed_drugs && customer.prescribed_drugs.length > 0 ? (
                  customer.prescribed_drugs.map((drugItem, index) => {
                    const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                    const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                    const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                    const isSelected = (statusModal.selectedDrugs || []).includes(drugId);
                    
                    return (
                      <div 
                        key={drugId} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px 0',
                          borderBottom: index < customer.prescribed_drugs.length - 1 ? '1px solid #f0f0f0' : 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStatusModal(prev => ({
                                ...prev,
                                selectedDrugs: [...prev.selectedDrugs, drugId]
                              }));
                            } else {
                              setStatusModal(prev => ({
                                ...prev,
                                selectedDrugs: prev.selectedDrugs.filter(id => id !== drugId)
                              }));
                            }
                          }}
                          style={{ marginRight: '10px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                            {drug ? drug.name_th : 'กำลังโหลด...'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {drug ? drug.name_en : '-'} • จำนวน {quantity}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ textAlign: 'center', color: '#999' }}>ไม่มีรายการยา</p>
                )}
              </div>
              {statusModal.selectedDrugs.length > 0 && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '8px', 
                  background: '#f6ffed', 
                  border: '1px solid #b7eb8f',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#52c41a'
                }}>
                  เลือกแล้ว {statusModal.selectedDrugs.length} รายการ
                </div>
              )}
            </div>
          )}
          
          <textarea
            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            value={statusModal.note}
            onChange={(e) => setStatusModal({ ...statusModal, note: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              marginTop: '15px',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              fontSize: '14px'
            }}
          />
        </div>
      </Modal>

      {/* Allergy Detail Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 'bold' }}>
            <span>💊</span>
            <span>รายละเอียดยาที่แพ้</span>
          </div>
        }
        open={allergyDetailModal.open}
        onCancel={() => setAllergyDetailModal({ open: false, allergies: [] })}
        footer={[
          <button
            key="close"
            onClick={() => setAllergyDetailModal({ open: false, allergies: [] })}
            className="allergy-btn no-allergy"
            style={{ width: 'auto', padding: '8px 24px' }}
          >
            ปิด
          </button>
        ]}
        centered
        width={600}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '24px' } }}
      >
        {allergyDetailModal.allergies && allergyDetailModal.allergies.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allergyDetailModal.allergies.map((allergy, idx) => (
              <div
                key={idx}
                className="info-card"
                style={{
                  background: 'linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%)',
                  border: '1px solid #ffb3b3',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 4px 12px rgba(255, 120, 117, 0.15)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '24px', lineHeight: '1.4' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#d32f2f', marginBottom: '6px' }}>
                      💊 {allergy.drug || 'ยาไม่ระบุชื่อ'}
                    </div>
                    {allergy.symptoms && (
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                        <strong>อาการแพ้:</strong> {allergy.symptoms}
                      </div>
                    )}
                    {allergy.date && (
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        <strong>วันที่บันทึก:</strong> {formatThaiDate(allergy.date)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
            <div>ไม่มีข้อมูลยาที่แพ้</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CustomerDetailStaff;

