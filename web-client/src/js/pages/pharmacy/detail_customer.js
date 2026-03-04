import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import HomeHeader from '../../components/HomeHeader';
import DrugNotificationModal from '../../components/DrugNotificationModal';
// Footer is rendered globally in App.js
import 'react-toastify/dist/ReactToastify.css';
import { Modal, DatePicker, Tabs } from 'antd';
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

function CustomerDetail() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [medicalModal, setMedicalModal] = useState({ open: false, title: '', icon: '', value: '' });
  const [editMedicalModal, setEditMedicalModal] = useState({ open: false, type: '', label: '', value: '' });
  const [editSymptomModal, setEditSymptomModal] = useState({
    open: false,
    main: '',
    history: '',
    note: ''
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'ยืนยัน',
    cancelText: 'ยกเลิก',
    type: 'danger' // 'danger' | 'warning' | 'info'
  });
  const [staffAssignModal, setStaffAssignModal] = useState({
    open: false,
    availableStaff: [],
    selectedStaffId: null,
    loading: false,
    assignNote: ''
  });
  const [assignedByStaff, setAssignedByStaff] = useState(null);
  const [staffWorkStatus, setStaffWorkStatus] = useState({
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
  // Keep latest notification (if any) so we can tell initial assign vs update
  const [latestNotification, setLatestNotification] = useState(null);
  // Keep current notification being viewed (from notifId) separate from latestNotification
  // This prevents showing symptoms/appointment from a different sheet that was edited
  const [currentNotification, setCurrentNotification] = useState(null);
  const userRole = localStorage.getItem('role');
  
  const [outOfStockModal, setOutOfStockModal] = useState({
    open: false,
    drugs: []
  });
  const [activeTab, setActiveTab] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [drugQuantities, setDrugQuantities] = useState({}); // {drugId: quantity}
  
  const [addDrugModal, setAddDrugModal] = useState({
    open: false,
    availableDrugs: [],
    selectedDrugs: [],
    filterBy: 'all'
  });
  // Modal สำหรับตั้งค่าเวลาทานยา (แยกออกมา)
  const [drugNotificationModal, setDrugNotificationModal] = useState({
    open: false,
    drug: null,
    drugId: null,
    take_morning: false,
    take_lunch: false,
    take_evening: false,
    take_bedtime: false,
    meal_relation: 'after',
    reminder_time: '',
    quantity: 1,
    dosage_per_time: '',
    frequency_hours: 0,
    useDefaults: true,
    drugDefaults: {}
  });
  // IDs of drugs reported out-of-stock by staff (used to update the prescribed-drugs tab)
  const [outOfStockIds, setOutOfStockIds] = useState([]);
  // Modal state for showing a drug's full details when user clicks 'รายละเอียด'
  const [drugDetailModal, setDrugDetailModal] = useState({ open: false, drug: null });
  // State สำหรับ Modal แก้ไขยาที่แพ้ (Allergy) แบบมีรายละเอียด - รองรับหลายรายการ
  const [allergyModal, setAllergyModal] = useState({
    open: false,
    allergies: [], // Array of { drug, symptoms, date }
    availableDrugs: []
  });
  // State สำหรับ Modal แสดงรายละเอียดยาแพ้ (view only)
  const [allergyDetailModal, setAllergyDetailModal] = useState({
    open: false,
    allergies: []
  });

  // State สำหรับตั้งค่าเวลาอาหารเฉลี่ยของลูกค้า (ใช้คำนวณเวลาแจ้งเตือนยา)
  const [mealTimes, setMealTimes] = useState({
    morning: '08:00',
    lunch:   '12:00',
    evening: '18:00',
    bedtime: '21:00',
  });
  const [savingMealTimes, setSavingMealTimes] = useState(false);

  // Get pharmacyId from URL params
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');
  const notifId = searchParams.get('notifId');
  const newVisit = searchParams.get('newVisit') === '1' || searchParams.get('newVisit') === 'true';

  const defaultStaffStatus = {
    received: false,
    prepared: false,
    received_at: null,
    prepared_at: null,
    prepared_note: '',
    outOfStock: [],
    cancelled: false,
    cancelled_at: null,
    cancelled_note: ''
  };

  useEffect(() => {
    console.log('useEffect triggered with customerDocumentId:', customerDocumentId, 'pharmacyId:', pharmacyId, 'notifId:', notifId);
    const loadCustomerData = async () => {
      console.log('loadCustomerData function called');

      if (!customerDocumentId && !notifId) {
        console.log('Neither customerDocumentId nor notifId provided, skipping load');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('jwt');
      console.log('Token exists:', !!token);

      // Determine which customer documentId to load. If notifId provided, fetch notification first.
      let targetCustomerDoc = customerDocumentId;
      let initialNotification = null;

      if (notifId) {
        try {
          const nRes = await fetch(API.notifications.getById(notifId), {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          });
          if (nRes.ok) {
            const nJson = await nRes.json();
            initialNotification = nJson.data || nJson;
            // Try several possible shapes for customer_profile
            const cp = initialNotification?.customer_profile || initialNotification?.data?.customer_profile;
            targetCustomerDoc = cp?.documentId || cp?.data?.documentId || targetCustomerDoc;
            setLatestNotification(initialNotification);
            // Keep current notification separate from latest to prevent showing another sheet's data
            setCurrentNotification(initialNotification);
            console.log('📝 Loaded current notification via notifId:', notifId, 'derived customerDocumentId:', targetCustomerDoc);
          } else {
            console.warn('Notification fetch failed for notifId:', notifId, 'status:', nRes.status);
          }
        } catch (err) {
          console.warn('Error fetching notification for notifId:', notifId, err);
        }
      }

      // helper: try fetching customer by documentId with retries (backend may take a moment to return newly-created item)
      const fetchWithRetry = async (attempts = 4, delay = 300) => {
        for (let i = 0; i < attempts; i++) {
          try {
            const res = await fetch(API.customerProfiles.getByDocumentId(targetCustomerDoc), {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            });
            if (!res.ok) {
              const text = await res.text().catch(() => '');
              throw new Error(`API error ${res.status}: ${text}`);
            }
            const data = await res.json();
            const found = Array.isArray(data.data) ? data.data[0] : data.data;
            if (found) return found;
          } catch (err) {
            console.warn(`Attempt ${i + 1} failed to load customer:`, err.message || err);
          }

          // wait before retrying (exponential-ish backoff)
          // but don't wait after last attempt
          if (i < attempts - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
        return null;
      };

      try {
        const customer = await fetchWithRetry();
        if (!customer) {
          throw new Error('ไม่พบข้อมูลลูกค้า (หลังจากลองหลายครั้ง)');
        }

        console.log('Customer data loaded:', customer);
        // If newVisit flag is present, clear visit-specific data (prescribed_drugs AND symptoms)
        // เพื่อให้เริ่มกระดาษใหม่โดยไม่มีข้อมูลจากแผ่นเก่าติดมา
        if (newVisit) {
          const cleared = { 
            ...customer, 
            prescribed_drugs: [],
            Customers_symptoms: '',
            symptom_history: '',
            symptom_note: '',
            Follow_up_appointment_date: null
          };
          setCustomer(cleared);
        } else if (initialNotification?.data) {
          // ถ้ามี notification snapshot ให้ใช้ข้อมูลจาก notification (กระดาษแผ่นนั้นๆ)
          // แทนที่จะใช้ customer profile ปัจจุบัน
          // รองรับทั้ง nested (data.data) และ flat (data) structure
          console.log('⚠️ initialNotification check:');
          console.log('  - initialNotification:', initialNotification);
          console.log('  - initialNotification?.data:', initialNotification?.data);
          console.log('  - initialNotification?.data?.data:', initialNotification?.data?.data);
          
          // ลองหา snapshot จาก nested structure ก่อน (new style)
          const innerData = initialNotification.data?.data || {};
          let snapshotDrugs = innerData.prescribed_drugs;
          let snapshotSymptoms = innerData.symptoms;
          let snapshotAppointment = innerData.appointment_date;
          
          // ถ้าไม่เจอ ลองหาจาก flat structure (old style)
          if (!snapshotDrugs) {
            snapshotDrugs = initialNotification.data?.prescribed_drugs;
            console.log('⚠️ Using flat structure (old style): initialNotification.data.prescribed_drugs');
          }
          if (!snapshotSymptoms) {
            snapshotSymptoms = initialNotification.data?.symptoms;
          }
          if (!snapshotAppointment) {
            snapshotAppointment = initialNotification.data?.appointment_date || initialNotification.data?.Follow_up_appointment_date;
          }
          
          // สร้าง customer object จาก snapshot
          const customerWithSnapshot = { ...customer };
          
          // โหลดยาจาก snapshot
          if (snapshotDrugs && Array.isArray(snapshotDrugs)) {
            console.log('✅ Using prescribed_drugs from notification snapshot:', snapshotDrugs);
            customerWithSnapshot.prescribed_drugs = snapshotDrugs;
          } else {
            console.log('❌ No drugs snapshot found, using customer.prescribed_drugs');
          }
          
          // โหลดอาการจาก snapshot
          if (snapshotSymptoms) {
            console.log('✅ Using symptoms from notification snapshot:', snapshotSymptoms);
            if (typeof snapshotSymptoms === 'object') {
              customerWithSnapshot.Customers_symptoms = snapshotSymptoms.main || '';
              customerWithSnapshot.symptom_history = snapshotSymptoms.history || '';
              customerWithSnapshot.symptom_note = snapshotSymptoms.note || '';
            } else if (typeof snapshotSymptoms === 'string') {
              customerWithSnapshot.Customers_symptoms = snapshotSymptoms;
            }
          } else {
            console.log('❌ No symptoms snapshot found, using customer symptoms');
          }

          // ✅ โหลดวันนัดจาก snapshot
          if (snapshotAppointment) {
            console.log('✅ Using appointment_date from notification snapshot:', snapshotAppointment);
            customerWithSnapshot.Follow_up_appointment_date = snapshotAppointment;
          }
          
          console.log('📝 notifId present:', !!notifId, '- this will prevent database writes');
          setCustomer(customerWithSnapshot);
        } else {
          setCustomer(customer);
        }

        // assigned_by_staff: ถ้าเป็น newVisit ให้เคลียร์ (เริ่มกระดาษใหม่)
        if (newVisit) {
          console.log('New visit mode: clearing assigned_by_staff and visit-specific state');
          setAssignedByStaff(null);
        } else {
          if (customer?.assigned_by_staff && customer.assigned_by_staff.documentId) {
            console.log('Customer has assigned_by_staff:', customer.assigned_by_staff);
            setAssignedByStaff(customer.assigned_by_staff);
          } else {
            console.log('Customer does NOT have assigned_by_staff or it is incomplete');
            setAssignedByStaff(null);
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
            const drugsNormalized = (Array.isArray(drugsData.data) ? drugsData.data : [drugsData.data || []]).map(d => 
              d.attributes ? { id: d.id, documentId: d.documentId, ...d.attributes } : d
            );
            setAddDrugModal(prev => ({ ...prev, availableDrugs: drugsNormalized }));
          }
          
          // โหลด staff work status จาก latest notification (หรือ notification ที่ระบุ) (ยกเว้น newVisit)
          if (!newVisit && (initialNotification?.documentId || customer?.assigned_by_staff?.documentId)) {
            // Priority 1: Use specific notification if provided in URL (History/Specific Round Mode)
            if (initialNotification && initialNotification.documentId) {
               console.log('Using explicit notification for work status:', initialNotification.documentId);
               setLatestNotification(initialNotification);
               if (initialNotification.staff_work_status) {
                 setStaffWorkStatus(initialNotification.staff_work_status);
               } else {
                 setStaffWorkStatus(defaultStaffStatus);
               }
            } 
            // Priority 2: Fetch latest active assignment (Live Dashboard Mode)
            else {
              console.log('Loading staff work status for assigned_by_staff:', customer.assigned_by_staff.documentId);
              try {
                // Query both customer_assignment and customer_assignment_update types using OR
                const notificationRes = await fetch(
                  API.notifications.getCustomerNotifications(customerDocumentId),
                  {
                    headers: { Authorization: token ? `Bearer ${token}` : "" }
                  }
                );
                
                console.log('Notification API response status:', notificationRes.status);
                if (notificationRes.ok) {
                  const notifData = await notificationRes.json();
                  console.log('Notification data:', notifData);
                  const notification = notifData.data?.[0];
                  console.log('Loaded notification:', notification);
                  if (notification) {
                    // Keep the latest notification object
                    setLatestNotification(notification);
                    if (notification.staff_work_status) {
                      console.log('Setting staff work status from notification:', notification.staff_work_status);
                      setStaffWorkStatus(notification.staff_work_status);
                    } else {
                      // Initialize with default empty status if notification exists but no status yet
                      console.log('Notification exists but no staff_work_status, initializing defaults');
                      setStaffWorkStatus({
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
                    // no notification found for this assigned staff
                    console.log('No notification found for this staff assignment');
                    setLatestNotification(null);
                    setStaffWorkStatus(defaultStaffStatus);
                  }
                } else {
                  const errorData = await notificationRes.json().catch(() => ({}));
                  console.log('Notification API failed with status:', notificationRes.status, 'Error:', errorData);
                }
              } catch (err) {
                console.error('Error loading staff work status:', err);
              }
            }
          } else {
            console.log('No assigned_by_staff.documentId found, skipping notification load');
            // For newVisit we want fresh state; otherwise initialize defaults
            setLatestNotification(null);
            setStaffWorkStatus(newVisit ? defaultStaffStatus : defaultStaffStatus);
          }

          // If newVisit, clear visit-related UI state so page looks like a blank form
          if (newVisit) {
            setLatestNotification(null);
            setCurrentNotification(null); // 🔒 Clear currentNotification so UI shows customer profile (which is cleared)
            setStaffWorkStatus(defaultStaffStatus);
            setAssignedByStaff(null);
            setAddDrugModal(prev => ({ ...prev, selectedDrugs: [] }));
            setDrugQuantities({});
            setEditSymptomModal({ open: false, main: '', history: '', note: '' });
            setAllergyModal(prev => ({ ...prev, allergies: [] }));
            setAllergyDetailModal({ open: false, allergies: [] });
            setOutOfStockIds([]);
            setActiveTab('1');
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

  // Socket.IO Connection for real-time staff status updates
  const socketRef = useRef(null);

  useEffect(() => {
    if (!latestNotification?.documentId) return;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:1337';
    const token = localStorage.getItem('jwt') || '';

    console.log('[Socket] Attempting connection to:', socketUrl, 'with token:', !!token);

    socketRef.current = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      // Faster reconnection to reduce downtime and speed up status propagation
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      reconnectionAttempts: 10,
      forceNew: false
    });

    socketRef.current.on('connect', () => {
      console.log('[Socket] Connected to Strapi server');
      
      // Join rooms for this notification and customer
      const notifRoom = `notification:${latestNotification.documentId}`;
      const customerRoom = `customer:${customerDocumentId}`;
      
      socketRef.current.emit('join', notifRoom);
      socketRef.current.emit('join', customerRoom);
    });

    // Handle connection error
    socketRef.current.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message || error);
      console.error('[Socket] Full error object:', error);
      toast.error('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ - กรุณารีโหลดหน้า');
    });

    // Handle disconnect
    socketRef.current.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from server:', reason);
    });

    // Listen for notification updates from staff
    socketRef.current.on('notification:update', (updatedNotif) => {
      console.log('[Socket] 📨 Received notification update from staff:', updatedNotif);
      
      if (!updatedNotif) return;

      // Verify the update is for this customer
      if (updatedNotif.customerDocumentId && updatedNotif.customerDocumentId !== customerDocumentId) {
        console.log('[Socket] Ignoring update for different customer:', updatedNotif.customerDocumentId);
        return;
      }

      // If this is the same notification we're viewing, update it immediately
      if (updatedNotif.documentId === latestNotification?.documentId || 
          updatedNotif.id === latestNotification?.id) {
        
        console.log('[Socket] ✅ This is the current notification, updating UI in real-time');
        
        // Update notification state
        setLatestNotification(prev => ({
          ...prev,
          ...updatedNotif,
          staff_work_status: updatedNotif.staff_work_status || prev?.staff_work_status,
          batches_selected: updatedNotif.batches_selected || prev?.batches_selected,
          is_read: updatedNotif.is_read ?? prev?.is_read
        }));
        
        // Update staff work status state immediately
        if (updatedNotif.staff_work_status) {
          const prevStatus = staffWorkStatus;
          const newStatus = updatedNotif.staff_work_status;
          
          // Show toast only if status actually changed
          let showToast = false;
          let message = '';
          
          if (!prevStatus.received && newStatus.received) {
            showToast = true;
            message = '✅ พนักงานได้รับข้อมูลแล้ว';
          } else if (!prevStatus.prepared && newStatus.prepared) {
            showToast = true;
            message = '📦 พนักงานจัดส่งยาแล้ว';
          } else if (!prevStatus.cancelled && newStatus.cancelled) {
            showToast = true;
            message = '❌ การจัดส่งถูกยกเลิก';
          } else if (prevStatus.outOfStock?.length !== newStatus.outOfStock?.length) {
            showToast = true;
            message = '⚠️ พนักงานแจ้งยาหมดสต็อก';
          }
          
          if (showToast) {
            toast.info('🔄 ' + message);
            console.log('[Socket] 📢 Toast:', message);
          }
          
          // Always update staff work status
          setStaffWorkStatus(newStatus);
        }
        
        // Log batches_selected if available
        if (updatedNotif.batches_selected) {
          console.log('[Socket] 📦 Lots selection updated:', updatedNotif.batches_selected);
        }
      }
    });

    return () => {
      if (socketRef.current) {
        const notifRoom = `notification:${latestNotification.documentId}`;
        const customerRoom = `customer:${customerDocumentId}`;
        socketRef.current.emit('leave', notifRoom);
        socketRef.current.emit('leave', customerRoom);
        socketRef.current.disconnect();
      }
    };
  }, [latestNotification?.documentId, customerDocumentId]);

  // Force refresh เมื่อ window ได้ focus (user switch tab กลับมา)
  // This ensures we catch any updates that happened while the tab was inactive
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && customerDocumentId && latestNotification?.documentId) {
        console.log('[VisibilityChange] Tab is now visible, checking for updates...');
        
        try {
          const token = localStorage.getItem('jwt') || '';
          const notifRes = await fetch(
            API.notifications.getById(latestNotification.documentId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (notifRes.ok) {
            const notifData = await notifRes.json();
            const updatedNotif = notifData.data;
            
            if (updatedNotif?.staff_work_status) {
              console.log('[VisibilityChange] 🔄 Detected updates from staff:', updatedNotif.staff_work_status);
              setLatestNotification(updatedNotif);
              setStaffWorkStatus(updatedNotif.staff_work_status);
              toast.info('🔄 ข้อมูลถูกอัพเดทจากพนักงาน');
            }
          }
        } catch (err) {
          console.error('[VisibilityChange] Error refreshing data:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [customerDocumentId, latestNotification?.documentId]);

  // Listen for staff status update events from staff detail page
  useEffect(() => {
    const handleStaffStatusUpdate = (event) => {
      const { customerDocumentId: updatedCustomerId, staffStatus, notificationId } = event.detail;
      
      // Only update if this is the same customer
      if (updatedCustomerId === customerDocumentId && staffStatus) {
        // GUIDELINE: If the current view is bound to a specific notification (latestNotification),
        // we must ensure the update belongs to THAT notification.
        if (latestNotification?.documentId && notificationId && notificationId !== latestNotification.documentId) {
           console.log('[Event] Ignoring staff status update for different notification:', notificationId, 'Current:', latestNotification.documentId);
           return;
        }

        setStaffWorkStatus(staffStatus);
        toast.info('🔄 ข้อมูลสถานะจากพนักงานได้รับการอัพเดต');
      }
    };

    // Listen for custom events
    window.addEventListener('staffStatusUpdated', handleStaffStatusUpdate);

    // Listen for localStorage changes (cross-tab communication)
    const handleStorageChange = (event) => {
      if (event.key === `staffStatus_${customerDocumentId}` && event.newValue) {
        try {
          const { staffStatus, notificationId } = JSON.parse(event.newValue);
          if (staffStatus) {
            // GUIDELINE: Check notification ID match
            if (latestNotification?.documentId && notificationId && notificationId !== latestNotification.documentId) {
                console.log('[Storage] Ignoring staff status update for different notification:', notificationId);
                return;
            }

            setStaffWorkStatus(staffStatus);
            toast.info('🔄 ข้อมูลสถานะจากพนักงานได้รับการอัพเดต');
          }
        } catch (error) {
          console.error('Error parsing localStorage update:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('staffStatusUpdated', handleStaffStatusUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [customerDocumentId, latestNotification?.documentId]);

  const handleEdit = () => {
    navigate(`/form_customer?documentId=${customerDocumentId}&pharmacyId=${pharmacy?.documentId || pharmacyId}`);
  };

  const handleBack = () => {
    if (pharmacy?.documentId || pharmacyId) {
      navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/customer/${customerDocumentId}/history`);
    } else {
      navigate(-1);
    }
  };

  // Helper: get pharmacist name from pharmacy object
  const getPharmacistName = (pharmacyObj) => {
    if (!pharmacyObj) return '';

    // 1) If API populated staff_profiles, prefer staff with position 'pharmacist' (Thai/EN), else first staff
    if (Array.isArray(pharmacyObj.staff_profiles) && pharmacyObj.staff_profiles.length > 0) {
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

    // Fallback: direct fields
    const userFullName = pharmacyObj.users_permissions_user?.full_name || pharmacyObj.attributes?.users_permissions_user?.full_name;
    if (userFullName) return userFullName;
    return pharmacyObj.pharmacist_name || pharmacyObj.attributes?.pharmacist_name || '';
  };

  const handleOpenAppointmentModal = () => {
    setAppointmentDate(customer?.Follow_up_appointment_date || null);
    setIsAppointmentModalOpen(true);
  };

  const handleSaveAppointment = async () => {
    if (staffWorkStatus.prepared) {
      toast.error('ไม่สามารถบันทึกวันนัดได้ เนื่องจากพนักงานจัดส่งยาเรียบร้อยแล้ว');
      return;
    }
    if (!appointmentDate) {
      toast.error('กรุณาเลือกวันนัดติดตามอาการ');
      return;
    }
    try {
      const token = localStorage.getItem('jwt');
      
      // ถ้าดูอยู่ notification เก่า (notifId มี) บันทึกเข้า snapshot แทน customer profile
      if (notifId) {
        console.log('📝 Viewing old notification - updating snapshot only');
        
        // ✅ ต้อง merge กับ existing snapshot data
        const displayNotif = currentNotification || latestNotification;
        const existingData = displayNotif?.data?.data || displayNotif?.data || {};
        const mergedData = {
          ...existingData,
          appointment_date: appointmentDate
        };

        const updateRes = await fetch(API.notifications.updateByDocumentId(notifId), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            data: {
              data: mergedData
            }
          })
        });
        if (!updateRes.ok) throw new Error('บันทึกวันนัดไม่สำเร็จ');
        toast.success('บันทึกวันนัดติดตามอาการสำเร็จ (snapshot)');
        setIsAppointmentModalOpen(false);
        // Refresh notification and update latestNotification state
        const notifRes = await fetch(
          API.notifications.getById(notifId),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const notifData = await notifRes.json();
        const updatedNotif = notifData.data || notifData;
        setLatestNotification(updatedNotif);
        setCurrentNotification(updatedNotif);
        
        // Also update local customer state for visual consistency in header/other places
        setCustomer(prev => ({
          ...prev,
          Follow_up_appointment_date: appointmentDate
        }));
        
        return;
      }
      
      // ถ้าสร้างใหม่ (ไม่มี notifId) บันทึกเข้า customer profile
      const res = await fetch(API.customerProfiles.update(customerDocumentId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            Follow_up_appointment_date: appointmentDate
          }
        })
      });
      if (!res.ok) throw new Error('บันทึกวันนัดไม่สำเร็จ');

      // ✅ อัพเดตเข้า notification ล่าสุดด้วย (ถ้าเป็นรอบปัจจุบันที่ยังไม่เสร็จ)
      if (latestNotification?.documentId && staffWorkStatus?.prepared === false) {
        console.log('🔄 Updating appointment date in active notification snapshot');
        try {
          const updateNotifRes = await fetch(API.notifications.updateByDocumentId(latestNotification.documentId), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              data: {
                data: {
                  ...(latestNotification.data?.data || latestNotification.data || {}),
                  appointment_date: appointmentDate
                }
              }
            })
          });

          if (updateNotifRes.ok) {
             const updatedNotifData = await updateNotifRes.json();
             setLatestNotification(updatedNotifData.data || updatedNotifData);
          }
        } catch (err) {
          console.error('Failed to update appointment in notification:', err);
        }
      }

      toast.success('บันทึกวันนัดติดตามอาการสำเร็จ');
      setIsAppointmentModalOpen(false);
      // refresh customer data และ update state เพื่อให้หน้าแสดงข้อมูล
      const customerRes = await fetch(
        API.customerProfiles.getByIdBasic(customerDocumentId),
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteAppointment = async () => {
    if (staffWorkStatus.prepared) {
      toast.error('ไม่สามารถลบวันนัดได้ เนื่องจากพนักงานจัดส่งยาเรียบร้อยแล้ว');
      return;
    }
    try {
      const token = localStorage.getItem('jwt');

      // ถ้าดูอยู่ notification เก่า (notifId มี) ลบใน snapshot แทน customer profile
      if (notifId) {
        console.log('📝 Viewing old notification - deleting from snapshot only');
        
        // ✅ ต้อง merge กับ existing snapshot data
        const displayNotif = currentNotification || latestNotification;
        const existingData = displayNotif?.data?.data || displayNotif?.data || {};
        const mergedData = {
          ...existingData,
          appointment_date: null
        };

        const updateRes = await fetch(API.notifications.updateByDocumentId(notifId), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            data: {
              data: mergedData
            }
          })
        });
        if (!updateRes.ok) throw new Error('ลบวนนัดไม่สำเร็จ');
        toast.success('ลบวันนัดติดตามอาการสำเร็จ (snapshot)');
        setIsAppointmentModalOpen(false);
        // Refresh notification and update state
        const notifRes = await fetch(
          API.notifications.getById(notifId),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const notifData = await notifRes.json();
        const updatedNotif = notifData.data || notifData;
        setLatestNotification(updatedNotif);
        setCurrentNotification(updatedNotif);
        
        // Update local customer state
        setCustomer(prev => ({
          ...prev,
          Follow_up_appointment_date: null
        }));
        return;
      }

      const res = await fetch(API.customerProfiles.update(customer.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            Follow_up_appointment_date: null
          }
        })
      });
      if (!res.ok) throw new Error('ลบวันนัดไม่สำเร็จ');

      // ✅ ลบใน notification ล่าสุดด้วย (ถ้าเป็นรอบปัจจุบันที่ยังไม่เสร็จ)
      if (latestNotification?.documentId && staffWorkStatus?.prepared === false) {
        try {
          await fetch(API.notifications.updateByDocumentId(latestNotification.documentId), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              data: {
                data: {
                  ...(latestNotification.data?.data || latestNotification.data || {}),
                  appointment_date: null
                }
              }
            })
          });
        } catch (err) {
          console.error('Failed to update appointment in notification:', err);
        }
      }

      toast.success('ลบวันนัดติดตามอาการสำเร็จ');
      setIsAppointmentModalOpen(false);
      // refresh customer data
      const customerRes = await fetch(
        API.customerProfiles.getByDocumentId(customerDocumentId),
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      const updatedCustomer = Array.isArray(customerData.data) ? customerData.data[0] : customerData.data;
      setCustomer(updatedCustomer);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleOpenAddDrugModal = () => {
    // แปลงข้อมูลเก่า (array) เป็นรูปแบบใหม่ถ้าจำเป็น
    const currentDrugs = customer.prescribed_drugs || [];
    let selectedDrugs = [];
    let quantities = {};
    
    if (Array.isArray(currentDrugs) && currentDrugs.length > 0) {
      if (typeof currentDrugs[0] === 'string') {
        // รูปแบบเก่า - array ของ drugId
        selectedDrugs = currentDrugs.map(drugId => ({ drugId, quantity: 1 }));
        currentDrugs.forEach(drugId => {
          quantities[drugId] = 1;
        });
      } else {
        // รูปแบบใหม่ - array ของ object
        selectedDrugs = currentDrugs;
        currentDrugs.forEach(item => {
          quantities[item.drugId] = item.quantity || 1;
        });
      }
    }
    
    setAddDrugModal(prev => ({
      ...prev,
      open: true,
      selectedDrugs
    }));
    setDrugQuantities(quantities);
  };

  const handleNextPatient = () => {
    // If we have a pharmacy context, go back to followup list; otherwise just navigate back
    if (pharmacy?.documentId || pharmacyId) {
      navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/followup-customers`);
    } else {
      navigate(-1);
    }
  };

  const handleQuickSave = async () => {
    // Save depending on active tab
    try {
      if (activeTab === '2') {
        if (addDrugModal.selectedDrugs.length === 0) {
          toast.info('ไม่มีการเปลี่ยนแปลงยาให้บันทึก');
          return;
        }
        await handleSaveAddDrug();
      } else if (activeTab === '3') {
        if (editSymptomModal.open) {
          await handleSaveEditSymptom();
        } else {
          toast.info('เปิดแบบฟอร์มแก้ไขอาการเพื่อบันทึกข้อมูล');
        }
      } else if (activeTab === '1') {
        toast.info('บันทึกสำหรับแท็บข้อมูลลูกค้า: ไม่มีการเปลี่ยนแปลงอัตโนมัติ');
      } else if (activeTab === '4') {
        toast.success('✅ บันทึกการดำเนินการเรียบร้อย');
      } else {
        toast.info('ไม่มีข้อมูลที่จะบันทึก');
      }
    } catch (err) {
      // handleSave* already toasts errors
    }
  };

  // Keyboard shortcuts for power users (pharmacists)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      // ignore when typing in input or textarea
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Use lower-case checks for convenience
      const key = e.key.toLowerCase();
      if (key === 'a') { // A = add drug
        e.preventDefault();
        setActiveTab('2'); // ไปแท็บยา
        setTimeout(() => handleOpenAddDrugModal(), 100);
      } else if (key === 's') { // S = save
        e.preventDefault();
        handleQuickSave();
      } else if (key === 'n') { // N = next patient
        e.preventDefault();
        handleNextPatient();
      } else if (key === 'f') { // F = follow-up (symptoms tab)
        e.preventDefault();
        setActiveTab('2'); // อาการและการติดตาม
      } else if (key === 'd') { // D = do actions
        e.preventDefault();
        setActiveTab('4'); // ดำเนินการ
      } else if (key === '1' || key === '2' || key === '3' || key === '4') {
        e.preventDefault();
        setActiveTab(key);
      } else if (key === '/') { // focus search inside add modal if open
        if (addDrugModal.open) {
          const el = document.querySelector('.drug-search-input');
          if (el) el.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addDrugModal.open, addDrugModal.selectedDrugs, activeTab, pharmacy, pharmacyId]);

  // Keep assignedByStaff synced with customer data whenever customer changes
  useEffect(() => {
    // Don't sync with customer.assigned_by_staff if newVisit mode (keep null)
    if (newVisit) {
      setAssignedByStaff(null);
    } else if (customer?.assigned_by_staff && customer.assigned_by_staff.documentId) {
      setAssignedByStaff(customer.assigned_by_staff);
    } else {
      setAssignedByStaff(null);
    }
  }, [customer, newVisit]);

  // Sync เวลาอาหารจาก customer profile เมื่อโหลดข้อมูล
  useEffect(() => {
    if (customer) {
      setMealTimes({
        morning: customer.morning_meal_time || '08:00',
        lunch:   customer.lunch_meal_time   || '12:00',
        evening: customer.evening_meal_time || '18:00',
        bedtime: customer.bedtime_time      || '21:00',
      });
    }
  }, [customer?.documentId]); // sync เฉพาะตอน customer เปลี่ยน (ไม่ overwrite ขณะ user กำลัง edit)

  // บันทึกเวลาอาหารของลูกค้า และ force-sync schedules โดยส่ง prescribed_drugs ซ้ำ
  const handleSaveMealTimes = async () => {
    if (!customerDocumentId || notifId) return; // ไม่บันทึกเมื่อดู history
    setSavingMealTimes(true);
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(API.customerProfiles.update(customerDocumentId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          data: {
            morning_meal_time: mealTimes.morning,
            lunch_meal_time:   mealTimes.lunch,
            evening_meal_time: mealTimes.evening,
            bedtime_time:      mealTimes.bedtime,
            // ส่ง prescribed_drugs ซ้ำเพื่อ trigger lifecycle sync schedules ด้วยเวลาใหม่
            ...(customer?.prescribed_drugs?.length > 0 ? { prescribed_drugs: customer.prescribed_drugs } : {}),
          }
        })
      });
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      setCustomer(prev => ({
        ...prev,
        morning_meal_time: mealTimes.morning,
        lunch_meal_time:   mealTimes.lunch,
        evening_meal_time: mealTimes.evening,
        bedtime_time:      mealTimes.bedtime,
      }));
      toast.success('✅ บันทึกเวลาอาหารและอัปเดตตารางแจ้งเตือนแล้ว');
    } catch (err) {
      toast.error('บันทึกเวลาอาหารไม่สำเร็จ');
    } finally {
      setSavingMealTimes(false);
    }
  };

  const handleSaveAddDrug = async () => {
    if (staffWorkStatus.prepared) {
      toast.error('ไม่สามารถแก้ไขยาได้ เนื่องจากพนักงานจัดส่งยาเรียบร้อยแล้ว');
      return;
    }
    // ✅ Validation: ตรวจสอบว่าแต่ละยามีการระบุเวลาทาน (บังคับสำหรับการจ่ายยาให้ลูกค้า)
    const drugsWithoutNotif = addDrugModal.selectedDrugs.filter(item => {
      const hasSlot = item.take_morning || item.take_lunch || item.take_evening || item.take_bedtime;
      const hasTime = item.reminder_time && String(item.reminder_time).trim() !== '';
      return !hasSlot && !hasTime;
    });
    if (drugsWithoutNotif.length > 0) {
      const names = drugsWithoutNotif.map(item => {
        const drug = addDrugModal.availableDrugs.find(d => d.documentId === (typeof item === 'string' ? item : item.drugId));
        return drug ? drug.name_th : 'ไม่ระบุชื่อ';
      });
      toast.error(`กรุณาระบุเวลาทานยา (เลือกช่วงเวลา หรือระบุเวลาเอง) สำหรับ: ${names.join(', ')}`);
      return;
    }
    try {
      const token = localStorage.getItem('jwt');
      
      // แปลงข้อมูลให้เป็นรูปแบบ array ของ object ที่มี drugId และ quantity
      const prescribedDrugs = addDrugModal.selectedDrugs.map(item => {
        const dId = typeof item === 'string' ? item : item.drugId;
        const drugInfo = addDrugModal.availableDrugs.find(d => d.documentId === dId);
        
        return { 
          drugId: dId, 
          quantity: drugQuantities[dId] || (typeof item === 'object' ? item.quantity : 1) || 1,
          reminder_time: typeof item === 'object' ? item.reminder_time : null,
          take_morning: typeof item === 'object' ? !!item.take_morning : !!drugInfo?.take_morning,
          take_lunch: typeof item === 'object' ? !!item.take_lunch : !!drugInfo?.take_lunch,
          take_evening: typeof item === 'object' ? !!item.take_evening : !!drugInfo?.take_evening,
          take_bedtime: typeof item === 'object' ? !!item.take_bedtime : !!drugInfo?.take_bedtime,
          meal_relation: typeof item === 'object' ? (item.meal_relation || drugInfo?.meal_relation || 'after') : (drugInfo?.meal_relation || 'after'),
          dosage_per_time: typeof item === 'object' ? (item.dosage_per_time || drugInfo?.dosage_per_time || '') : (drugInfo?.dosage_per_time || ''),
          frequency_hours: typeof item === 'object' ? (item.frequency_hours || drugInfo?.frequency_hours || 0) : (drugInfo?.frequency_hours || 0)
        };
      });
      
      // ถ้าเป็นการดู notification เก่า (มี notifId) → ไม่บันทึกลง customer database
      // เพราะจะทำให้ยาในกระดาษแผ่นอื่นเปลี่ยนไปด้วย
      // แค่อัปเดต state ในหน้านี้ และจะถูกบันทึกเป็น snapshot ตอนส่งข้อมูลให้พนักงาน
      if (notifId) {
        console.log('📝 Viewing old notification - updating local state only, not database');
        // อัปเดต customer state ในหน้านี้เท่านั้น (ไม่บันทึกลง database)
        setCustomer(prev => ({
          ...prev,
          prescribed_drugs: prescribedDrugs
        }));
        toast.success('อัปเดตยาสำเร็จ (จะบันทึกเมื่อส่งข้อมูลให้พนักงาน)');
        setAddDrugModal(prev => ({ ...prev, open: false }));
        setDrugQuantities({});
        return;
      }
      
      // ✅ ถ้าเป็น newVisit → ไม่บันทึกลง database (จะไปทับข้อมูลเก่า)
      // แค่อัปเดต local state และรอจนกว่าจะส่งข้อมูลให้พนักงาน
      if (newVisit) {
        console.log('📝 newVisit mode - updating local state only, not database');
        setCustomer(prev => ({
          ...prev,
          prescribed_drugs: prescribedDrugs
        }));
        toast.success('บันทึกยาสำเร็จ');
        setAddDrugModal(prev => ({ ...prev, open: false }));
        setDrugQuantities({});
        return;
      }
      
      // ถ้าไม่มี notifId และไม่ใช่ newVisit → บันทึกลง customer database ตามปกติ
      const res = await fetch(API.customerProfiles.update(customerDocumentId), { method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            prescribed_drugs: prescribedDrugs
          }
        })
      });
      if (!res.ok) throw new Error('บันทึกยาไม่สำเร็จ');
      
      
      // ❌ ไม่สร้าง notification ใน newVisit mode (จะสร้างตอนส่งข้อมูลให้พนักงาน)
      // ✅ สร้าง notification เฉพาะเมื่อไม่ใช่ newVisit และมี staff assignment
      if (!newVisit && assignedByStaff && pharmacy) {
        const drugNames = prescribedDrugs.map(item => {
          const drug = addDrugModal.availableDrugs.find(d => d.documentId === item.drugId);
          return drug ? drug.name_th : 'ยาไม่ระบุ';
        }).join(', ');
        
        // สร้าง notification เพื่อบันทึกประวัติการบันทึกยา
        const notificationData = {
          data: {
            type: 'message',
            customer_profile: customerDocumentId,
            staff_profile: assignedByStaff.documentId,
            drug_store: pharmacy.documentId,
            message: `บันทึกยา: ${drugNames}`,
            prescribed_drugs: prescribedDrugs,
            staff_work_status: staffWorkStatus
          }
        };
        
        const notifRes = await fetch(API.notifications.create(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(notificationData)
        });
        
        if (notifRes.ok) {
          const newNotif = await notifRes.json();
          console.log('✅ Created drug notification:', newNotif);
        } else {
          console.warn('Failed to create drug notification');
        }
      } else if (newVisit) {
        console.log('📝 newVisit mode: skipping notification (will create when sending to staff)');
      }
      
      toast.success('บันทึกยาสำเร็จ');
      setAddDrugModal(prev => ({ ...prev, open: false }));
      setDrugQuantities({});
      
      // อัพเดต customer state ทั้ง newVisit และ old visit เพื่อให้ยาขึ้นบนหน้าเว็บ
      setCustomer(prev => ({
        ...prev,
        prescribed_drugs: prescribedDrugs
      }));
      
      // ✅ เฉพาะเมื่อไม่ใช่ newVisit ให้ fetch เอา assigned_by_staff ข้อมูล
      if (!newVisit) {
        // refresh customer data พร้อมกับ assigned_by_staff ข้อมูล
        const customerRes = await fetch(
          API.customerProfiles.getByDocumentId(customerDocumentId),
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );
        const customerData = await customerRes.json();
        const customer = Array.isArray(customerData.data) ? customerData.data[0] : customerData.data;
        setCustomer(customer);
        
        // อัพเดต assignedByStaff เพื่อให้แท็บการทำงานยังคงแสดง
        if (customer?.assigned_by_staff && customer.assigned_by_staff.documentId) {
          setAssignedByStaff(customer.assigned_by_staff);
        }
      } else {
        console.log('📝 newVisit mode: updated local state with drugs (server sync on staff assignment)');
      }
      
      // Note: ไม่ต้อง reload notification จาก database เพราะเรามี latestNotification แล้ว
      // การ reload จะทำให้ได้ notification แรกสุด ซึ่งอาจไม่ใช่อันที่เพิ่งสร้าง
      // latestNotification ได้ถูก set ใน notification creation response ข้างบนแล้ว
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const openMedicalModal = (type) => {
    let title = '';
    let icon = '';
    let value = '';
    let extra = null;
    if (type === 'disease') {
      title = 'โรคประจำตัว';
      icon = '🏥';
      value = customer.congenital_disease || '-';
    } else if (type === 'allergy') {
      title = 'ยาที่แพ้';
      icon = '⚠️';
      value = customer.Allergic_drugs || '-';
    } else if (type === 'symptom') {
      title = 'อาการ';
      icon = '🩺';
      // สมมุติ field ใน customer: symptom_main, symptom_history, symptom_note
      const main = customer.symptom_main || customer.Customers_symptoms || '-';
      const history = customer.symptom_history || '-';
      const note = customer.symptom_note || '-';
      extra = { main, history, note };
      value = '';
    }
    setMedicalModal({ open: true, title, icon, value, extra });
  };

  const openEditMedicalModal = (type) => {
    let label = '';
    let value = '';
    if (type === 'disease') {
      label = 'โรคประจำตัว';
      value = customer.congenital_disease || '';
    } else if (type === 'allergy') {
      // เปิด modal allergy ใหม่แบบมีรายละเอียด
      return openEditAllergyModal();
    }
    setEditMedicalModal({ open: true, type, label, value });
  };

  // ฟังก์ชันเปิด modal แก้ไขยาที่แพ้
  const openEditAllergyModal = async () => {
    let drugs = addDrugModal.availableDrugs.length > 0 ? addDrugModal.availableDrugs : [];
    
    // ถ้าไม่มีรายการยา ให้โหลดจาก API
    if (drugs.length === 0) {
      try {
        const res = await fetch(
          `${API.BASE_URL}/api/drugs?filters[pharmacy_profiles][documentId][$eq]=${pharmacy?.documentId || pharmacyId}&pagination[pageSize]=10000`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }
        );
        if (res.ok) {
          const data = await res.json();
          const drugsData = Array.isArray(data.data) ? data.data : data;
          drugs = drugsData.map(drug => ({
            documentId: drug.documentId || drug.id,
            name_th: drug.attributes?.name_th || drug.name_th || '',
            name_en: drug.attributes?.name_en || drug.name_en || '',
            id: drug.id,
            ...drug.attributes
          }));
        }
      } catch (err) {
        console.error('Error loading drugs:', err);
      }
    }
    
    let allergies = [];
    
    // Parse existing allergies (handle old single-allergy format and new multi-allergy array format)
    if (customer.Allergic_drugs) {
      try {
        if (Array.isArray(customer.Allergic_drugs)) {
          // New format: already array
          allergies = customer.Allergic_drugs;
        } else if (typeof customer.Allergic_drugs === 'object') {
          // Old format: single object -> convert to array
          allergies = [customer.Allergic_drugs];
        } else if (typeof customer.Allergic_drugs === 'string') {
          const s = customer.Allergic_drugs.trim();
          if (s.startsWith('[')) {
            // JSON array
            allergies = JSON.parse(s);
          } else if (s.startsWith('{')) {
            // Single JSON object
            const parsed = JSON.parse(s);
            allergies = [parsed];
          } else {
            // Plain string -> treat as single drug name
            allergies = [{ drug: s, symptoms: '', date: '' }];
          }
        }
      } catch (e) {
        console.error('Error parsing allergies:', e);
      }
    }
    
    setAllergyModal({ open: true, allergies, availableDrugs: drugs });
  };

  // ฟังก์ชันบันทึกข้อมูลยาที่แพ้ (รองรับหลายรายการ)
  const handleSaveAllergy = async () => {
    // Filter out empty allergies
    const validAllergies = allergyModal.allergies.filter(a => a.drug && a.drug.trim());
    
    if (validAllergies.length === 0) {
      toast.error('กรุณาเลือกหรือระบุชื่อยาอย่างน้อย 1 รายการ');
      return;
    }

    try {
      const updateData = {
        Allergic_drugs: JSON.stringify(validAllergies)
      };

      const token = localStorage.getItem('jwt') || localStorage.getItem('token');
      const res = await fetch(API.customerProfiles.update(customerDocumentId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ data: updateData })
      });

      if (!res.ok) throw new Error('ไม่สามารถบันทึกข้อมูลได้');

      const updatedCustomer = await res.json();
      // normalize response (API returns { data: ... })
      setCustomer(updatedCustomer.data || updatedCustomer);
      setAllergyModal({ open: false, allergies: [], availableDrugs: [] });
      toast.success('บันทึกข้อมูลยาที่แพ้สำเร็จ');
    } catch (err) {
      console.error('Error saving allergy:', err);
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // ฟังก์ชันยกเลิกการใส่ข้อมูลยาที่แพ้ (ลบข้อมูลทั้งหมด)
  const handleClearAllergy = async () => {
    // เปิด confirmation modal ก่อน
    setConfirmModal({
      open: true,
      title: '⚠️ ยกเลิกการใส่ข้อมูลยาที่แพ้',
      message: 'คุณต้องการลบข้อมูลยาที่แพ้ทั้งหมดใช่หรือไม่? การทำการนี้จะไม่สามารถยกเลิกได้',
      confirmText: 'ยืนยันการลบ',
      cancelText: 'ยกเลิก',
      type: 'danger',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('jwt') || localStorage.getItem('token');
          const res = await fetch(API.customerProfiles.update(customerDocumentId), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ data: { Allergic_drugs: null } })
          });

          if (!res.ok) throw new Error('ไม่สามารถลบข้อมูลได้');

          const updatedCustomer = await res.json();
          setCustomer(updatedCustomer.data || updatedCustomer);
          setAllergyModal({ open: false, allergies: [], availableDrugs: [] });
          setConfirmModal({ ...confirmModal, open: false });
          toast.success('ลบข้อมูลยาที่แพ้สำเร็จ');
        } catch (err) {
          console.error('Error clearing allergy:', err);
          toast.error('เกิดข้อผิดพลาด: ' + err.message);
          setConfirmModal({ ...confirmModal, open: false });
        }
      }
    });
  };

  // เปิด modal แก้ไขอาการ
  const openEditSymptomModal = () => {
    // 🔒 สำหรับ newVisit ให้ใช้ค่าจาก customer state (ที่อาจถูกอัปเดตแล้ว)
    // ไม่ใช่ว่างเปล่าเสมอ เพราะถ้า user บันทึกไปแล้ว ควรเห็นค่าที่บันทึก
    if (newVisit) {
      console.log('📝 New visit - using customer state symptoms:', {
        main: customer.Customers_symptoms,
        history: customer.symptom_history,
        note: customer.symptom_note
      });
      setEditSymptomModal({
        open: true,
        main: customer.Customers_symptoms || '',
        history: customer.symptom_history || '',
        note: customer.symptom_note || ''
      });
      return;
    }

    // 🔒 ถ้า viewing old notification (มี notifId) ให้ดึง symptoms จาก currentNotification snapshot
    const symptoms = notifId && currentNotification?.data?.data?.symptoms
      ? currentNotification.data.data.symptoms
      : notifId && currentNotification?.data?.symptoms
      ? currentNotification.data.symptoms
      : notifId && latestNotification?.data?.data?.symptoms
      ? latestNotification.data.data.symptoms
      : {
          main: customer.Customers_symptoms || '',
          history: customer.symptom_history || '',
          note: customer.symptom_note || ''
        };
    
    // Handle ทั้ง object และ string format
    const main = typeof symptoms === 'object' ? (symptoms.main || '') : symptoms;
    const history = typeof symptoms === 'object' ? (symptoms.history || '') : '';
    const note = typeof symptoms === 'object' ? (symptoms.note || '') : '';
    
    setEditSymptomModal({
      open: true,
      main: main,
      history: history,
      note: note
    });
  };

  const handleSaveEditMedical = async () => {
    try {
      const token = localStorage.getItem('jwt');
      let updateData = {};
      if (editMedicalModal.type === 'disease') {
        updateData = { congenital_disease: editMedicalModal.value };
      } else {
        return; // ถ้าไม่ใช่ disease ให้ออก (allergy ใช้ modal แยกแล้ว)
      }
      const res = await fetch(API.customerProfiles.update(customerDocumentId), { method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ data: updateData })
      });
      if (!res.ok) throw new Error('บันทึกข้อมูลไม่สำเร็จ');
      toast.success('บันทึกข้อมูลสำเร็จ');
      setEditMedicalModal({ ...editMedicalModal, open: false });
      // refresh customer data
      const customerRes = await fetch(
        API.customerProfiles.getByIdBasic(customerDocumentId),
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // ฟังก์ชันบันทึกอาการ
  const handleSaveEditSymptom = async () => {
    if (staffWorkStatus.prepared) {
      toast.error('ไม่สามารถบันทึกอาการได้ เนื่องจากพนักงานจัดส่งยาเรียบร้อยแล้ว');
      return;
    }
    try {
      const token = localStorage.getItem('jwt');
      
      // ถ้าดูอยู่ notification เก่า (notifId มี) บันทึกเข้า snapshot แทน customer profile
      if (notifId) {
        console.log('📝 Viewing old notification - updating snapshot only');
        
        // ✅ ต้อง merge กับ existing snapshot data (ไม่งั้น prescribed_drugs จะหาย!)
        const existingData = currentNotification?.data?.data || currentNotification?.data || {};
        const mergedData = {
          ...existingData,
          symptoms: {
            main: editSymptomModal.main,
            history: editSymptomModal.history,
            note: editSymptomModal.note
          }
        };
        console.log('📝 Merging symptoms with existing snapshot:', mergedData);
        
        const updateRes = await fetch(API.notifications.updateByDocumentId(notifId), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            data: {
              data: mergedData
            }
          })
        });
        if (!updateRes.ok) throw new Error('บันทึกข้อมูลไม่สำเร็จ');
        toast.success('บันทึกข้อมูลสำเร็จ (snapshot)');
        setEditSymptomModal({ ...editSymptomModal, open: false });
        
        // Update local customer state to show the new symptom immediately
        setCustomer(prev => ({
          ...prev,
          Customers_symptoms: editSymptomModal.main,
          symptom_history: editSymptomModal.history,
          symptom_note: editSymptomModal.note
        }));
        
        // Refresh notification and update currentNotification state (not latestNotification)
        // We only update the currently-viewed old sheet, not the latest one
        const notifRes = await fetch(
          API.notifications.getById(notifId),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const notifData = await notifRes.json();
        setCurrentNotification(notifData.data);
        
        // DON'T refresh customer - this would override snapshot data
        // The UI reads from latestNotification.data.data.symptoms
        return;
      }
      
      // ❌ ไม่สร้าง notification ใน newVisit mode (จะสร้างตอนส่งข้อมูลให้พนักงาน)
      // ✅ สร้าง notification เฉพาะเมื่อไม่ใช่ newVisit และมี staff assignment  
      if (!newVisit && assignedByStaff && pharmacy) {
        const notificationData = {
          data: {
            type: 'message',
            customer_profile: customerDocumentId,
            staff_profile: assignedByStaff.documentId,
            drug_store: pharmacy.documentId,
            message: `บันทึกอาการ: ${editSymptomModal.main || 'ไม่ระบุอาการ'}`,
            data: {
              symptoms: {
                main: editSymptomModal.main,
                history: editSymptomModal.history,
                note: editSymptomModal.note
              },
              appointment_date: null,
              prescribed_drugs: customer.prescribed_drugs || []
            },
            staff_work_status: staffWorkStatus
          }
        };
        
        const notifRes = await fetch(API.notifications.create(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(notificationData)
        });
        
        if (notifRes.ok) {
          console.log('✅ Created symptom notification');
          toast.success('บันทึกข้อมูลสำเร็จ');
          setEditSymptomModal({ ...editSymptomModal, open: false });
          return;
        } else {
          console.warn('Failed to create symptom notification');
        }
      } else if (newVisit) {
        console.log('📝 newVisit mode: skipping notification (will create when sending to staff)');
        // ✅ ใน newVisit mode → ไม่บันทึกลง database (จะไปทับข้อมูลเก่า)
        // แค่อัปเดต local state และรอจนกว่าจะส่งข้อมูลให้พนักงาน
        setCustomer(prev => ({
          ...prev,
          Customers_symptoms: editSymptomModal.main,
          symptom_history: editSymptomModal.history,
          symptom_note: editSymptomModal.note
        }));
        toast.success('บันทึกข้อมูลสำเร็จ');
        setEditSymptomModal({ ...editSymptomModal, open: false });
        return;
      }
      
      // บันทึกเข้า customer profile (เฉพาะเมื่อไม่ใช่ newVisit และไม่มี assignedByStaff)
      const res = await fetch(API.customerProfiles.update(customerDocumentId), { method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            Customers_symptoms: editSymptomModal.main,
            symptom_history: editSymptomModal.history,
            symptom_note: editSymptomModal.note
          }
        })
      });
      if (!res.ok) throw new Error('บันทึกข้อมูลไม่สำเร็จ');
      
      toast.success('บันทึกข้อมูลสำเร็จ');
      setEditSymptomModal({ ...editSymptomModal, open: false });
      
      // refresh customer data และ update state เพื่อให้หน้าแสดงข้อมูล
      const customerRes = await fetch(
        API.customerProfiles.getByIdBasic(customerDocumentId),
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
      
      // 🔒 Clear currentNotification เมื่อบันทึกเสร็จ เพื่อ UI แสดงข้อมูล customer profile ที่อัพเดตแล้ว
      setCurrentNotification(null);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // ฟังก์ชันลบอาการ
  const handleDeleteSymptom = async () => {
    if (staffWorkStatus.prepared) {
      toast.error('ไม่สามารถลบอาการได้ เนื่องจากพนักงานจัดส่งยาเรียบร้อยแล้ว');
      return;
    }
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(API.customerProfiles.update(customerDocumentId), { method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            Customers_symptoms: '',
            symptom_history: '',
            symptom_note: ''
          }
        })
      });
      if (!res.ok) throw new Error('ลบข้อมูลไม่สำเร็จ');
      toast.success('ลบข้อมูลอาการสำเร็จ');
      setEditSymptomModal({ ...editSymptomModal, open: false });
      // refresh customer data
      const customerRes = await fetch(
        API.customerProfiles.getByIdBasic(customerDocumentId),
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // เปิด modal เพิ่มอาการใหม่
  const openAddSymptomModal = () => {
    setEditSymptomModal({
      open: true,
      main: '',
      history: '',
      note: ''
    });
  };

  // Helper function สำหรับเปิด confirmation modal
  const showConfirmation = (config) => {
    setConfirmModal({
      open: true,
      title: config.title || 'ยืนยันการดำเนินการ',
      message: config.message || 'คุณแน่ใจหรือไม่?',
      onConfirm: config.onConfirm,
      confirmText: config.confirmText || 'ยืนยัน',
      cancelText: config.cancelText || 'ยกเลิก',
      type: config.type || 'danger'
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      open: false,
      title: '',
      message: '',
      onConfirm: null,
      confirmText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      type: 'danger'
    });
  };

  const handleConfirm = () => {
    if (confirmModal.onConfirm) {
      confirmModal.onConfirm();
    }
    closeConfirmModal();
  };

  // ฟังก์ชันเปิด modal ส่งข้อมูลให้พนักงาน (หรือส่งอัพเดตถ้าเคยส่งมาก่อน)
  const handleOpenStaffAssignModal = async () => {
    // If we already have a previous notification for this customer/staff (and NOT in newVisit mode), send update directly
    if (!newVisit && latestNotification && latestNotification.id) {
      // send update directly to same staff
      const staffDocId = assignedByStaff?.documentId || (latestNotification.staff_profile && latestNotification.staff_profile.documentId);
      await handleAssignToStaff(staffDocId, true);
      return;
    }
    
    // ถ้ายังไม่เคยส่ง ให้เปิด modal เลือกพนักงาน
    setStaffAssignModal(prev => ({ ...prev, open: true, loading: true }));
    
    try {
      const token = localStorage.getItem('jwt');
      
      // โหลดข้อมูลพนักงานที่ทำงานในร้านยานี้
      const staffRes = await fetch(
        API.staffProfiles.listByStore(pharmacyId),
        {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        }
      );
      
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        // กรองเฉพาะพนักงานที่ออนไลน์ (สมมติว่ามี field is_online หรือ last_active)
        const onlineStaff = staffData.data.filter(staff => {
          // ถ้ามี field is_online ใช้เลย
          if (staff.is_online !== undefined) return staff.is_online;
          // ถ้าไม่มี ให้แสดงพนักงานทั้งหมดที่ active
          return staff.status === 'active' || !staff.status;
        });
        setStaffAssignModal(prev => ({ 
          ...prev, 
          availableStaff: onlineStaff,
          loading: false 
        }));
      } else {
        toast.error('ไม่สามารถโหลดข้อมูลพนักงานได้');
        setStaffAssignModal(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน');
      setStaffAssignModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ฟังก์ชันส่งข้อมูลผู้ป่วยให้พนักงาน
  const handleAssignToStaff = async (staffIdOverride = null, isUpdate = false) => {
    // ใช้ staffId ที่ส่งมาหรือจาก state
    const targetStaffId = staffIdOverride || staffAssignModal.selectedStaffId;
    
    if (!targetStaffId) {
      toast.error('กรุณาเลือกพนักงานที่ต้องการส่งข้อมูล');
      return;
    }

    try {
      const token = localStorage.getItem('jwt');
      
      // Logic การสร้าง/อัพเดต notification:
      // 1. ถ้าไม่มี latestNotification → สร้างใหม่ (customer_assignment)
      // 2. ถ้ามี latestNotification และพนักงานยังไม่ทำเสร็จ (prepared=false) → UPDATE เดิม (ยังคงเป็น customer_assignment)
      // 3. ถ้ามี latestNotification และพนักงานทำเสร็จแล้ว (prepared=true) → สร้างใหม่ (customer_assignment)
      
      const hasExistingNotification = !!latestNotification?.documentId;
      const staffFinished = staffWorkStatus?.prepared === true;
      
      // ถ้าพนักงานทำเสร็จแล้ว ให้สร้างใหม่เสมอ (กระดาษแผ่นใหม่)
      // ถ้ายังไม่เสร็จ ให้อัพเดตเดิม (กระดาษแผ่นเดิม) แต่ยังคง type เป็น customer_assignment
      const shouldUpdate = hasExistingNotification && !staffFinished;
      const notificationType = 'customer_assignment'; // ✅ ไม่เปลี่ยน type เมื่ออัพเดต เพื่อให้ปรากฏในหน้า history
      const actionLabel = shouldUpdate ? 'อัพเดต' : 'มอบหมาย';
      
      console.log('handleAssignToStaff - hasExisting:', hasExistingNotification, 'staffFinished:', staffFinished, 'shouldUpdate:', shouldUpdate, 'action:', actionLabel);
      
      // ดึง pharmacy profile จาก localStorage (ถ้ามี) หรือจากข้อมูลที่โหลดมา
      const userDocumentId = localStorage.getItem('user_documentId');
      let pharmacyProfileId = null;
      
      // ถ้าเป็น pharmacy role ให้ดึง pharmacy_profile จาก localStorage หรือ API
      if (userDocumentId) {
        const pharmacyProfileRes = await fetch(
          API.pharmacyProfiles.getByUserDocumentId(userDocumentId),
          {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          }
        );
        if (pharmacyProfileRes.ok) {
          const pharmacyProfileData = await pharmacyProfileRes.json();
          pharmacyProfileId = pharmacyProfileData.data?.[0]?.documentId || null;
        }
      }
      
      console.log('Pharmacy Profile ID:', pharmacyProfileId);
      console.log('User Document ID:', userDocumentId);
      
      // เตรียมข้อมูลยาพร้อมชื่อและรายละเอียด (snapshot ณ ขณะนั้น)
      // ⚠️ ถ้ามี notifId (viewing notification) ให้ใช้ snapshot จากแผ่นปัจจุบัน
      // ถ้าไม่มี notifId ให้ใช้ customer.prescribed_drugs ปัจจุบัน
      const prescribedDrugsSnapshot = await (async () => {
        try {
          const token = localStorage.getItem('jwt');
          const drugsRes = await fetch(
            API.drugs.list(`filters[drug_store][documentId][$eq]=${pharmacyId}&populate[0]=drug_batches&populate[1]=drug_store`),
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (drugsRes.ok) {
            const drugsData = await drugsRes.json();
            const allDrugs = drugsData.data || [];
            
            // ถ้ามี notifId (viewing notification) ใช้ drugs จาก notification snapshot
            const drugsToSnapshot = notifId && latestNotification?.data?.data?.prescribed_drugs 
              ? latestNotification.data.data.prescribed_drugs 
              : customer.prescribed_drugs || [];
            
            console.log('📋 Using drugs from:', notifId ? 'notification snapshot' : 'customer profile');
            
            // Map prescribed_drugs เป็น object ที่มีชื่อยาและปริมาณ
            const snapshot = (drugsToSnapshot || []).map(prescribedItem => {
              const drugId = typeof prescribedItem === 'string' ? prescribedItem : (prescribedItem.drugId || prescribedItem);
              const quantity = typeof prescribedItem === 'object' ? prescribedItem.quantity : 1;
              const drugInfo = allDrugs.find(d => d.documentId === drugId || d.id === drugId);
              
              return {
                drugId: drugId,
                drugName: drugInfo?.name_th || 'ยาไม่ทราบชื่อ',
                quantity: quantity || 1,
                unit: drugInfo?.unit || 'เม็ด',
                // Snapshot current dosage and schedule settings
                take_morning: prescribedItem.take_morning || false,
                take_lunch: prescribedItem.take_lunch || false,
                take_evening: prescribedItem.take_evening || false,
                take_bedtime: prescribedItem.take_bedtime || false,
                meal_relation: prescribedItem.meal_relation || 'after',
                dosage_per_time: prescribedItem.dosage_per_time || '',
                frequency_hours: prescribedItem.frequency_hours || 0,
                reminder_time: prescribedItem.reminder_time || ''
              };
            });
            console.log('✅ prescribedDrugsSnapshot created:', snapshot);
            return snapshot;
          }
        } catch (err) {
          console.error('Failed to fetch drug details:', err);
        }
        
        // Fallback: ถ้าดึงข้อมูลไม่สำเร็จ
        const drugsToSnapshot = notifId && latestNotification?.data?.data?.prescribed_drugs 
          ? latestNotification.data.data.prescribed_drugs 
          : customer.prescribed_drugs || [];
        
        const fallback = (drugsToSnapshot || []).map(item => ({
          drugId: typeof item === 'string' ? item : (item.drugId || item),
          quantity: typeof item === 'object' ? item.quantity : 1,
          drugName: typeof item === 'object' ? item.drugName : undefined,
          // Snapshot current dosage and schedule settings (fallback)
          take_morning: item.take_morning || false,
          take_lunch: item.take_lunch || false,
          take_evening: item.take_evening || false,
          take_bedtime: item.take_bedtime || false,
          meal_relation: item.meal_relation || 'after',
          dosage_per_time: item.dosage_per_time || '',
          frequency_hours: item.frequency_hours || 0,
          reminder_time: item.reminder_time || ''
        }));
        console.log('⚠️ Using fallback prescribedDrugsSnapshot:', fallback);
        return fallback;
      })();
      
      console.log('📦 prescribedDrugsSnapshot final:', prescribedDrugsSnapshot);
      
      // 🔍 DEBUG: ตรวจสอบค่า symptoms ที่จะส่ง
      console.log('🔍 DEBUG symptoms values:');
      console.log('  - customer.Customers_symptoms:', customer.Customers_symptoms);
      console.log('  - customer.symptom_history:', customer.symptom_history);
      console.log('  - customer.symptom_note:', customer.symptom_note);
      console.log('  - newVisit mode:', newVisit);
      
      // เตรียมข้อมูลสำหรับ notification
      // ⚠️ Strapi ไม่ accept relations fields ที่ไม่ระบุแบบ explicit
      // ✅ วิธีแก้: เก็บ relation IDs เข้า data JSON field + set actual relations เพื่อ filter/query ต่างชื่นแบบปกติ
      const safeNotificationData = {
        data: {
          // Basic fields
          type: notificationType,
          title: shouldUpdate ? 'อัพเดตข้อมูลผู้ป่วย' : 'ได้รับมอบหมายข้อมูลผู้ป่วย',
          // 🔒 ถ้า newVisit ไม่ต้องแสดง symptom เก่าใน message
          message: `${shouldUpdate ? 'ได้รับอัพเดต' : 'ได้รับมอบหมายดูแล'}ผู้ป่วย: ${user?.full_name || 'ผู้ป่วย'}${newVisit ? '' : `\nอาการ: ${customer.Customers_symptoms || 'ไม่ระบุ'}`}\n${staffAssignModal.assignNote ? `หมายเหตุ: ${staffAssignModal.assignNote}` : ''}`,
          
          // Actual relations (ต้องระบุให้ API รู้ว่า notification นี้เกี่ยวกับตัวไหน)
          customer_profile: customerDocumentId,
          staff_profile: targetStaffId,
          drug_store: pharmacyId,
          
          // JSON field - เก็บ snapshot + relation IDs ณ ขณะนั้น
          data: {
            // Relations IDs - เก็บไว้ใน JSON field สำหรับ snapshot/history
            staff_profile_id: targetStaffId,
            pharmacy_profile_id: pharmacyProfileId,
            customer_profile_id: customerDocumentId,
            drug_store_id: pharmacyId,
            
            customer_documentId: customerDocumentId,
            customer_name: user?.full_name || '',
            customer_phone: user?.phone || '',
            // ✅ ใช้ symptoms จาก customer state (ที่เก็บไว้ใน local state หลังบันทึก)
            // สำหรับทั้ง newVisit และ old visit
            symptoms: {
              main: customer.Customers_symptoms || '',
              history: customer.symptom_history || '',
              note: customer.symptom_note || ''
            },
            // 🎯 เก็บ snapshot ของยา ณ ขณะที่ส่งข้อมูล
            prescribed_drugs: Array.isArray(prescribedDrugsSnapshot) ? prescribedDrugsSnapshot : [],
            assigned_at: notificationType === 'customer_assignment_update' ? new Date().toISOString() : undefined,
            updated_at: notificationType === 'customer_assignment_update' ? new Date().toISOString() : undefined,
            note: staffAssignModal.assignNote || '',
            allergy: customer.Allergic_drugs || '',
            disease: customer.congenital_disease || '',
            appointment_date: customer.Follow_up_appointment_date || null
          },
          
          // staff_work_status - JSON field
          staff_work_status: (function() {
            const existingOOS = Array.isArray(staffWorkStatus?.outOfStock) ? [...new Set([...staffWorkStatus.outOfStock])] : [];
            if (notificationType === 'customer_assignment') {
              return {
                received: false,
                prepared: false,
                received_at: null,
                prepared_at: null,
                prepared_note: '',
                outOfStock: existingOOS
              };
            }
            return {
              received: false,
              prepared: false,
              received_at: null,
              prepared_at: null,
              prepared_note: '',
              outOfStock: existingOOS,
              cancelled: false,
              cancelled_at: null,
              cancelled_note: ''
            };
          })(),
          
          // Status fields
          is_read: false,
          priority: 'normal'
        }
      };

      console.log('Sending notification:', safeNotificationData);
      console.log('notificationType:', notificationType, 'shouldUpdate:', shouldUpdate);
      console.log('DEBUG: safeNotificationData.data.data.prescribed_drugs =', safeNotificationData.data.data.prescribed_drugs);

      // ถ้า shouldUpdate=true ให้ UPDATE notification เดิม (กระดาษแผ่นเดิม)
      // ถ้า shouldUpdate=false ให้ CREATE notification ใหม่ (กระดาษแผ่นใหม่)
      const notificationEndpoint = shouldUpdate
        ? API.notifications.updateByDocumentId(latestNotification.documentId)
        : API.notifications.create();
      
      const requestBody = JSON.stringify({ data: safeNotificationData.data });
      console.log('📤 REQUEST BODY that will be sent:', requestBody);
      console.log('📤 REQUEST BODY PARSED:', JSON.parse(requestBody));
      
      const notificationMethod = shouldUpdate ? 'PUT' : 'POST';

      const notificationRes = await fetch(
        notificationEndpoint,
        {
          method: notificationMethod,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: (() => {
              try {
                const jsonBody = JSON.stringify(safeNotificationData);
                console.log('📤 Actual JSON body being sent:', jsonBody);
                return jsonBody;
              } catch (e) {
                console.error('Error serializing notification data:', e);
                // Return a safe fallback
                return JSON.stringify({
                  data: {
                    type: notificationType,
                    title: 'Notification',
                    message: 'Error in data serialization',
                    data: {},
                    staff_work_status: {},
                    is_read: false,
                    priority: 'normal'
                  }
                });
              }
            })()
        }
      );

      let result = null;
      if (notificationRes.ok) {
        result = await notificationRes.json();
        console.log('Notification ' + (shouldUpdate ? 'updated' : 'created') + ':', result);
        console.log('✅ Success - documentId:', result.data?.documentId);
        console.log('✅ Type:', result.data?.type);
        console.log('📦 Returned data.data.prescribed_drugs:', result.data?.data?.prescribed_drugs);
      } else {
        const errorData = await notificationRes.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || notificationRes.statusText;
        console.error('❌ Notification ' + (shouldUpdate ? 'update' : 'create') + ' failed:', {
          status: notificationRes.status,
          method: notificationMethod,
          endpoint: notificationEndpoint,
          error: errorMsg
        });
        toast.error('❌ ส่งข้อมูล' + (shouldUpdate ? 'อัพเดต' : '') + 'ไม่สำเร็จ: ' + errorMsg);
        return;
      }

      // ใช้ result ที่ได้มาแล้ว ไม่ต้อง read json อีกครั้ง
      console.log('Processing notification result...');
      
          // Also update customer profile with assigned_by_staff (สำหรับทุกครั้ง)
      if (notificationType === 'customer_assignment') {
        try {
          // Fetch the staff profile with populated user relation so we have name/avatar
          const staffRes = await fetch(
            API.staffProfiles.getByDocumentIdWithUser(targetStaffId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (staffRes.ok) {
            const staffData = await staffRes.json();
            const staffProfile = staffData.data?.[0];

            if (staffProfile) {
              // Update customer profile using the internal numeric id for relation
              const updateRes = await fetch(
                API.customerProfiles.update(customerDocumentId), { method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    data: {
                      // use numeric id to set relation cleanly
                      assigned_by_staff: staffProfile.id
                    }
                  })
                }
              );

              if (updateRes.ok) {
                console.log('Customer profile updated with assigned_by_staff (id)', staffProfile.id);
                // Update local state with the populated staff profile so UI shows name/avatar
                setAssignedByStaff(staffProfile);
              } else {
                console.error('Failed to update customer.assigned_by_staff', updateRes.status);
              }
            }
          } else {
            console.error('Failed to fetch staff profile for assignment', staffRes.status);
          }
        } catch (err) {
          console.error('Error updating assigned_by_staff:', err);
        }
      }
      
      // update latestNotification state from created notification result (if backend returns it)
      try {
        const createdEntry = result.data || result;
        console.log('Notification response data:', createdEntry);
        setLatestNotification(createdEntry);
        
        // Also update staffWorkStatus from the notification's staff_work_status field
        if (createdEntry.staff_work_status) {
          console.log('Updating staffWorkStatus from notification:', createdEntry.staff_work_status);
          setStaffWorkStatus(prev => ({
            ...prev,
            received: createdEntry.staff_work_status.received || false,
            prepared: createdEntry.staff_work_status.prepared || false,
            received_at: createdEntry.staff_work_status.received_at || null,
            prepared_at: createdEntry.staff_work_status.prepared_at || null,
            prepared_note: createdEntry.staff_work_status.prepared_note || '',
            outOfStock: createdEntry.staff_work_status.outOfStock || [],
            cancelled: createdEntry.staff_work_status.cancelled || false,
            cancelled_at: createdEntry.staff_work_status.cancelled_at || null,
            cancelled_note: createdEntry.staff_work_status.cancelled_note || ''
          }));
        } else {
          console.warn('NO staff_work_status in notification response - initializing defaults');
          setStaffWorkStatus({
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
      } catch (e) {
        console.warn('Could not set latestNotification from response', e);
      }

      toast.success(notificationType === 'customer_assignment_update' ? '✅ อัพเดตข้อมูลให้พนักงานสำเร็จ' : '✅ ส่งข้อมูลให้พนักงานสำเร็จ');
      setStaffAssignModal({
        open: false,
        availableStaff: [],
        selectedStaffId: null,
        loading: false,
        assignNote: ''
      });
    } catch (error) {
      console.error('Error assigning to staff:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งข้อมูล');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 font-prompt">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
            <p className="text-slate-600 font-bold text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-50 font-prompt">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-4">ไม่พบข้อมูลลูกค้า</h2>
            <button 
              onClick={handleBack}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              ← กลับ
            </button>
          </div>
        </main>
      </div>
    );
  }

  const user = customer.users_permissions_user;
  const customerName = user?.full_name || customer.temp_full_name || 'ไม่พบชื่อ';
  const customerPhone = user?.phone || customer.temp_phone || 'ไม่ระบุเบอร์';
  const hasAccount = !!user;

  return (
    <div className="min-h-screen bg-slate-50 font-prompt">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Modern Header Section */}
        <div className="relative bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden mb-8">
          {/* Background Decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-emerald-50/30 pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="relative p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200 ring-4 ring-white">
                  {customerName.charAt(0)?.toUpperCase() || 'C'}
                </div>
                {!hasAccount && (
                  <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-slate-800 text-white text-[9px] font-black rounded-full shadow-lg border-2 border-white uppercase tracking-tighter">
                    No Acc
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">{customerName}</h1>
                  {!hasAccount && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded border border-slate-200 uppercase tracking-tighter">
                      Manual Record
                    </span>
                  )}
                </div>
                <p className="text-slate-500 font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {customerPhone}
                </p>
                {(() => {
                  const displayNotification = currentNotification || latestNotification;
                  const snapshotAppointment = displayNotification?.data?.data?.appointment_date || displayNotification?.data?.appointment_date || null;
                  const displayDate = snapshotAppointment || customer.Follow_up_appointment_date;
                  if (!displayDate) return null;
                  return (
                    <p className="text-emerald-600 font-bold text-sm flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      นัดครั้งถัดไป: {formatThaiDate(displayDate)}
                    </p>
                  );
                })()}
                {assignedByStaff && assignedByStaff.documentId && (
                  <p className="text-indigo-600 font-bold text-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    จัดส่งโดย: {assignedByStaff.users_permissions_user?.full_name || 'ไม่ระบุชื่อ'}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex gap-3">
                <div className="bg-slate-50 rounded-2xl px-5 py-3 text-center border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">รายการยา</p>
                  <p className="text-2xl font-black text-indigo-600">{customer?.prescribed_drugs?.length || 0}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl px-5 py-3 text-center border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">สถานะ</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${assignedByStaff ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {assignedByStaff ? '✓ จัดส่งแล้ว' : 'รอดำเนินการ'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Work Status Panel */}
        {assignedByStaff && assignedByStaff.documentId && latestNotification && latestNotification.id ? (
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 mb-8 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="text-xl">📊</span> สถานะการดำเนินการ
                </h3>
                <span className="text-sm text-slate-500 font-medium">ของ {assignedByStaff.users_permissions_user?.full_name || assignedByStaff.documentId || 'พนักงาน'}</span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('jwt');
                    const notificationRes = await fetch(
                      API.notifications.getCustomerNotifications(customerDocumentId),
                      { headers: { Authorization: token ? `Bearer ${token}` : "" } }
                    );
                    if (notificationRes.ok) {
                      const notifData = await notificationRes.json();
                      const notification = notifData.data?.[0];
                      if (notification && notification.staff_work_status) {
                        setStaffWorkStatus(notification.staff_work_status);
                        setLatestNotification(notification);
                        toast.success('✅ รีเฟรซข้อมูลสำเร็จ');
                      }
                    }
                  } catch (error) {
                    console.error('Error refreshing status:', error);
                    toast.error('ไม่สามารถรีเฟรซได้');
                  }
                }}
                className="bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-2 rounded-xl text-xs font-black hover:from-emerald-600 hover:to-green-600 transition-all duration-200 shadow-lg shadow-emerald-200 whitespace-nowrap"
              >
                🔄 รีเฟรซ
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 ${staffWorkStatus.received ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                disabled={true}
                title="รอพนักงานอัปเดตสถานะ"
              >
                <span className="text-2xl mb-2">{staffWorkStatus.received ? '✅' : '📥'}</span>
                <span className="text-sm font-bold">ได้รับข้อมูล</span>
                {staffWorkStatus.received_at && (
                  <span className="text-[10px] mt-1 opacity-75">{formatThaiDate(staffWorkStatus.received_at)}</span>
                )}
              </button>
              
              <button
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 ${staffWorkStatus.prepared && !staffWorkStatus.cancelled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : staffWorkStatus.received ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                disabled={true}
                title={staffWorkStatus.cancelled ? 'พนักงานยกเลิกการจัดส่ง - รอจัดส่งใหม่' : 'รอพนักงานอัปเดตสถานะ'}
              >
                <span className="text-2xl mb-2">{staffWorkStatus.prepared && !staffWorkStatus.cancelled ? '✅' : '📦'}</span>
                <span className="text-sm font-bold">จัดยาส่งแล้ว</span>
                {staffWorkStatus.prepared_at && !staffWorkStatus.cancelled && (
                  <span className="text-[10px] mt-1 opacity-75">{formatThaiDate(staffWorkStatus.prepared_at)}</span>
                )}
              </button>

              {staffWorkStatus.cancelled && (
                <button
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 bg-rose-50 border-rose-200 text-rose-700"
                  disabled={true}
                  title="ยกเลิกการจัดส่งแล้ว"
                >
                  <span className="text-2xl mb-2">⏮️</span>
                  <span className="text-sm font-bold">ยกเลิกการจัดส่ง</span>
                  {staffWorkStatus.cancelled_at && (
                    <span className="text-[10px] mt-1 opacity-75">{formatThaiDate(staffWorkStatus.cancelled_at)}</span>
                  )}
                </button>
              )}
              
              <button
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 ${staffWorkStatus.outOfStock.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-pointer hover:bg-amber-100' : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'}`}
                disabled={staffWorkStatus.outOfStock.length === 0}
                title={staffWorkStatus.outOfStock.length > 0 ? 'คลิกเพื่อดูรายชื่อยาที่หมด' : 'ยังไม่มีข้อมูลยาหมดสต็อก'}
                onClick={() => {
                  if (staffWorkStatus.outOfStock.length > 0) {
                    const outOfStockDrugs = staffWorkStatus.outOfStock.map(drugId => {
                      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                      return drug ? drug : { documentId: drugId, name_th: 'ไม่พบข้อมูลยา', name_en: '-' };
                    });
                    setOutOfStockModal({ open: true, drugs: outOfStockDrugs });
                    setOutOfStockIds(Array.isArray(staffWorkStatus.outOfStock) ? staffWorkStatus.outOfStock : []);
                  }
                }}
              >
                <span className="text-2xl mb-2">🚨</span>
                <span className="text-sm font-bold">ยาหมดสต็อก</span>
                {staffWorkStatus.outOfStock.length > 0 && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full">{staffWorkStatus.outOfStock.length} รายการ</span>
                )}
              </button>
            </div>

            {staffWorkStatus.prepared_note && (
              <div className="mt-4 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl flex items-start gap-3">
                <span className="text-lg">📝</span>
                <span className="text-sm text-emerald-800 font-medium">{staffWorkStatus.prepared_note}</span>
              </div>
            )}

            {staffWorkStatus.cancelled_note && (
              <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl flex items-start gap-3">
                <span className="text-lg">⏮️</span>
                <span className="text-sm text-amber-800 font-medium">การยกเลิก: {staffWorkStatus.cancelled_note}</span>
              </div>
            )}
          </div>
        ) : null}

        <Tabs 
          activeKey={activeTab} 
          onChange={key => setActiveTab(key)} 
          defaultActiveKey="1" 
          type="card" 
          size="large"
          className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden [&_.ant-tabs-nav]:bg-slate-50 [&_.ant-tabs-nav]:px-6 [&_.ant-tabs-nav]:pt-4 [&_.ant-tabs-tab]:font-bold [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-indigo-600 [&_.ant-tabs-ink-bar]:bg-indigo-600 [&_.ant-tabs-content]:p-6"
        >
          <Tabs.TabPane tab={<span className="flex items-center gap-2">📋 ข้อมูลพื้นฐาน</span>} key="1">
            <div className="space-y-6">
              {/* Essential Customer Info */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                    <span className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-lg">👤</span>
                    <h3 className="text-lg font-black text-slate-800">ข้อมูลติดต่อ</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-100">
                      <label className="text-sm font-bold text-slate-500">ชื่อ-นามสกุล:</label>
                      <span className="text-sm font-semibold text-slate-800">{customerName}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-100">
                      <label className="text-sm font-bold text-slate-500">เบอร์โทรศัพท์:</label>
                      <span className="text-sm font-semibold text-slate-800">{customerPhone}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                    <span className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-lg">⚠️</span>
                    <h3 className="text-lg font-black text-slate-800">ข้อมูลสำคัญ</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-rose-600 font-black text-sm">⚠️ ยาที่แพ้</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => {
                            const allergies = (() => {
                              let allrgData = [];
                              try {
                                if (Array.isArray(customer.Allergic_drugs)) {
                                  allrgData = customer.Allergic_drugs;
                                } else if (typeof customer.Allergic_drugs === 'string') {
                                  const s = customer.Allergic_drugs.trim();
                                  if (s.startsWith('[')) {
                                    allrgData = JSON.parse(s);
                                  } else if (s.startsWith('{')) {
                                    const parsed = JSON.parse(s);
                                    allrgData = [parsed];
                                  } else {
                                    allrgData = [{ drug: s, symptoms: '', date: '' }];
                                  }
                                } else if (typeof customer.Allergic_drugs === 'object') {
                                  allrgData = [customer.Allergic_drugs];
                                }
                              } catch (e) {
                                allrgData = [{ drug: String(customer.Allergic_drugs), symptoms: '', date: '' }];
                              }
                              return allrgData;
                            })();
                            setAllergyDetailModal({ open: true, allergies });
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${customer.Allergic_drugs ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 hover:bg-rose-600' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                          {customer.Allergic_drugs ? (
                            (() => {
                              let count = 0;
                              try {
                                if (Array.isArray(customer.Allergic_drugs)) {
                                  count = customer.Allergic_drugs.length;
                                } else if (typeof customer.Allergic_drugs === 'string') {
                                  const s = customer.Allergic_drugs.trim();
                                  if (s.startsWith('[')) {
                                    count = JSON.parse(s).length;
                                  } else {
                                    count = 1;
                                  }
                                } else {
                                  count = 1;
                                }
                              } catch (e) {
                                count = 1;
                              }
                              return `👀 ดูรายละเอียด (${count} รายการ)`;
                            })()
                          ) : (
                            '✓ ไม่มี'
                          )}
                        </button>
                        {userRole === 'pharmacy' && (
                          <div className="flex gap-2">
                            <button className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all" onClick={() => openEditMedicalModal('allergy')}>✏️ แก้ไข</button>
                            {customer.Allergic_drugs && (
                              <button 
                                className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-all"
                                onClick={handleClearAllergy}
                              >
                                🗑️ ลบ
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-100">
                      <label className="text-sm font-bold text-slate-500">โรคประจำตัว:</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{customer.congenital_disease || 'ไม่มีข้อมูล'}</span>
                        {userRole === 'pharmacy' && (
                          <button className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-bold transition-all" onClick={() => openEditMedicalModal('disease')}>แก้ไข</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span className="flex items-center gap-2">🩺 อาการและการติดตาม <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black ${customer.Follow_up_appointment_date ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{customer.Follow_up_appointment_date ? 'มีนัด' : 'ไม่มีนัด'}</span></span>} key="2">
            <div className="space-y-6">
              {/* อาการปัจจุบัน */}
              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <span className="text-xl">🩺</span> อาการปัจจุบัน
                  </h3>
                  {userRole === 'pharmacy' && (
                    <div className="flex gap-2">
                      {(customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) ? (
                        <>
                          <button 
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'}`}
                            onClick={staffWorkStatus.prepared ? undefined : openEditSymptomModal}
                            disabled={staffWorkStatus.prepared}
                            title={staffWorkStatus.prepared ? 'พนักงานจัดส่งยาแล้ว — ไม่สามารถแก้ไขอาการได้' : 'แก้ไขอาการ'}
                          >
                            ✏️ แก้ไข
                          </button>
                          <button 
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-50 hover:bg-rose-100 text-rose-700'}`}
                            onClick={staffWorkStatus.prepared ? undefined : () => {
                              showConfirmation({
                                title: '🗑️ ยืนยันการลบอาการ',
                                message: 'คุณต้องการลบข้อมูลอาการทั้งหมดใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
                                onConfirm: handleDeleteSymptom,
                                confirmText: 'ลบข้อมูล',
                                type: 'danger'
                              });
                            }}
                            disabled={staffWorkStatus.prepared}
                            title={staffWorkStatus.prepared ? 'พนักงานจัดส่งยาแล้ว — ไม่สามารถลบอาการได้' : 'ลบอาการ'}
                          >
                            🗑️ ลบ
                          </button>
                        </>
                      ) : (
                        <button 
                          className={`px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-indigo-200 hover:shadow-xl'}`}
                          onClick={staffWorkStatus.prepared ? undefined : openAddSymptomModal}
                          disabled={staffWorkStatus.prepared}
                          title={staffWorkStatus.prepared ? 'พนักงานจัดส่งยาแล้ว — ไม่สามารถเพิ่มอาการได้' : 'เพิ่มอาการ'}
                        >
                          ➕ เพิ่มอาการ
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  {(() => {
                    let main = '';
                    let history = '';
                    let note = '';

                    if (currentNotification?.data?.data?.symptoms) {
                      const rawSymptoms = currentNotification.data.data.symptoms;
                      if (typeof rawSymptoms === 'string') {
                        main = rawSymptoms;
                      } else if (typeof rawSymptoms === 'object') {
                        main = rawSymptoms.main || '';
                        history = rawSymptoms.history || '';
                        note = rawSymptoms.note || '';
                      }
                    } else if (currentNotification?.data?.symptoms) {
                      const rawSymptoms = currentNotification.data.symptoms;
                      if (typeof rawSymptoms === 'string') {
                        main = rawSymptoms;
                      } else if (typeof rawSymptoms === 'object') {
                        main = rawSymptoms.main || '';
                        history = rawSymptoms.history || '';
                        note = rawSymptoms.note || '';
                      }
                    } else if (customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) {
                      main = typeof customer.Customers_symptoms === 'string' ? customer.Customers_symptoms : '';
                      history = typeof customer.symptom_history === 'string' ? customer.symptom_history : '';
                      note = typeof customer.symptom_note === 'string' ? customer.symptom_note : '';
                    }

                    const hasAny = main || history || note;

                    if (!hasAny) {
                      return (
                        <div className="text-center py-12">
                          <div className="text-5xl mb-4">📝</div>
                          <h4 className="text-lg font-bold text-slate-600 mb-2">ยังไม่มีข้อมูลอาการ</h4>
                          <p className="text-sm text-slate-400">คลิกปุ่ม "เพิ่มอาการ" เพื่อเริ่มบันทึกข้อมูลอาการของผู้ป่วย</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        <div className="p-4 bg-indigo-50/50 rounded-xl">
                          <label className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-2 block">อาการหลัก</label>
                          <div className="text-slate-700 font-medium">{main || '-'}</div>
                        </div>
                        {history && (
                          <div className="p-4 bg-amber-50/50 rounded-xl">
                            <label className="text-xs font-black text-amber-600 uppercase tracking-wider mb-2 block">ประวัติการเจ็บป่วย</label>
                            <div className="text-slate-700 font-medium">{history}</div>
                          </div>
                        )}
                        {note && (
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 block">หมายเหตุ</label>
                            <div className="text-slate-700 font-medium">{note}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* การนัดติดตาม */}
              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <span className="text-xl">📅</span> การนัดติดตาม
                </h3>
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">วันนัดติดตามอาการ</span>
                      <span className="block text-xl font-black text-slate-800">
                        {(() => {
                          const displayNotification = currentNotification || latestNotification;
                          const snapshotAppointment = displayNotification?.data?.data?.appointment_date || displayNotification?.data?.appointment_date || null;
                          const displayDate = snapshotAppointment || customer.Follow_up_appointment_date;
                          return displayDate ? formatThaiDate(displayDate) : 'ยังไม่ได้กำหนด';
                        })()}
                      </span>
                    </div>
                    <button 
                      className={`px-5 py-3 rounded-xl text-sm font-bold shadow-lg transition-all ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-indigo-200 hover:shadow-xl'}`}
                      onClick={staffWorkStatus.prepared ? undefined : handleOpenAppointmentModal}
                      disabled={staffWorkStatus.prepared}
                      title={staffWorkStatus.prepared ? 'พนักงานจัดส่งยาแล้ว — ไม่สามารถแก้ไขวันนัดได้' : 'แก้ไขวันนัด'}
                    >
                      {(() => {
                        const displayNotification = currentNotification || latestNotification;
                        const snapshotAppointment = displayNotification?.data?.data?.appointment_date || displayNotification?.data?.appointment_date || null;
                        const displayDate = snapshotAppointment || customer.Follow_up_appointment_date;
                        return displayDate ? '⚡ แก้ไขวันนัด' : '📅 กำหนดวันนัด';
                      })()}
                    </button>
                  </div>
                  {(() => {
                    const displayNotification = currentNotification || latestNotification;
                    const snapshotAppointment = displayNotification?.data?.data?.appointment_date || displayNotification?.data?.appointment_date || null;
                    const displayDate = snapshotAppointment || customer.Follow_up_appointment_date;
                    if (!displayDate) return null;
                    return (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${new Date(displayDate) > new Date() ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {new Date(displayDate) > new Date() ? '📋 กำหนดการ' : '⚠️ ครบกำหนด'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ข้อมูลเตือนสำคัญ */}
              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <span className="text-xl">⚠️</span> ข้อมูลสำคัญที่ต้องระวัง
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-100">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-2xl shrink-0">🚫</div>
                      <div>
                        <h4 className="font-black text-rose-700 mb-2">ยาที่แพ้</h4>
                        {customer.Allergic_drugs ? (
                          (() => {
                            let allergies = [];
                            try {
                              if (Array.isArray(customer.Allergic_drugs)) {
                                allergies = customer.Allergic_drugs;
                              } else if (typeof customer.Allergic_drugs === 'string') {
                                const s = customer.Allergic_drugs.trim();
                                if (s.startsWith('[')) {
                                  allergies = JSON.parse(s);
                                } else if (s.startsWith('{')) {
                                  const parsed = JSON.parse(s);
                                  allergies = [parsed];
                                } else {
                                  allergies = [{ drug: s, symptoms: '', date: '' }];
                                }
                              } else if (typeof customer.Allergic_drugs === 'object') {
                                allergies = [customer.Allergic_drugs];
                              }
                            } catch (e) {
                              allergies = [{ drug: String(customer.Allergic_drugs), symptoms: '', date: '' }];
                            }
                            return (
                              <div className="space-y-2">
                                {allergies.map((allergy, idx) => (
                                  <div key={idx} className="text-sm">
                                    <p className="font-bold text-slate-700">💊 {allergy.drug || 'ไม่ระบุชื่อยา'}</p>
                                    {allergy.symptoms && <p className="text-slate-500 text-xs">🩺 อาการ: {allergy.symptoms}</p>}
                                    {allergy.date && <p className="text-slate-400 text-xs">📅 {formatThaiDate(allergy.date)}</p>}
                                  </div>
                                ))}
                              </div>
                            );
                          })()
                        ) : (
                          <p className="text-slate-500 text-sm">ไม่มีข้อมูล</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl shrink-0">🏥</div>
                      <div>
                        <h4 className="font-black text-blue-700 mb-2">โรคประจำตัว</h4>
                        <p className="text-slate-600 text-sm">{customer.congenital_disease || 'ไม่มีข้อมูล'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span className="flex items-center gap-2">💊 ยาและการดำเนินการ <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black">{customer?.prescribed_drugs?.length || 0}</span></span>} key="3">
            <div className="space-y-6">

              {/* ─── ตั้งค่าเวลาอาหารเฉลี่ยของลูกค้า ─── */}
              <div className="bg-white rounded-2xl border-2 border-amber-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 border-b border-amber-100">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">🕐</div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">ตั้งค่าเวลาอาหารเฉลี่ย</h3>
                    <p className="text-xs text-slate-500">ระบบจะคำนวณเวลาแจ้งเตือนยาอัตโนมัติจากเวลาเหล่านี้</p>
                  </div>
                  {notifId && (
                    <span className="ml-auto px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">ดูอย่างเดียว (History)</span>
                  )}
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {[
                      { key: 'morning', label: 'เช้า',     icon: '🌅', hint: 'เวลาอาหารเช้า' },
                      { key: 'lunch',   label: 'เที่ยง',   icon: '☀️', hint: 'เวลาอาหารกลางวัน' },
                      { key: 'evening', label: 'เย็น',     icon: '🌆', hint: 'เวลาอาหารเย็น' },
                      { key: 'bedtime', label: 'ก่อนนอน', icon: '🌙', hint: 'เวลาเข้านอน (ไม่ offset)' },
                    ].map(slot => (
                      <div key={slot.key} className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-black text-slate-500 flex items-center gap-1">
                          <span>{slot.icon}</span>{slot.label}
                        </label>
                        <input
                          type="time"
                          value={mealTimes[slot.key]}
                          onChange={e => setMealTimes(prev => ({ ...prev, [slot.key]: e.target.value }))}
                          disabled={!!notifId}
                          title={slot.hint}
                          className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-amber-300 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    ))}
                  </div>

                  {/* คำอธิบาย offset */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-[11px]">
                    <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 rounded-xl text-rose-700 font-bold">
                      <span>💊➡️🍽️</span> ก่อนอาหาร: แจ้งเตือน 30 นาทีก่อนถึงเวลา
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl text-emerald-700 font-bold">
                      <span>🍽️➡️💊</span> หลังอาหาร: แจ้งเตือน 30 นาทีหลังเวลา
                    </div>
                    <div className="flex items-center gap-2 bg-sky-50 px-3 py-2 rounded-xl text-sky-700 font-bold">
                      <span>🍽️💊</span> พร้อมอาหาร: แจ้งเตือนตรงเวลา
                    </div>
                  </div>

                  {!notifId && (
                    <button
                      onClick={handleSaveMealTimes}
                      disabled={savingMealTimes}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {savingMealTimes ? '⏳ กำลังบันทึก...' : '💾 บันทึกเวลาอาหาร & อัปเดตตารางแจ้งเตือน'}
                    </button>
                  )}
                </div>
              </div>

              {/* แสดงรายการยาที่กำหนดแล้วในรูปแบบ Card Layout */}
              {customer.prescribed_drugs && customer.prescribed_drugs.length > 0 ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      <span>💊</span> รายการยาที่ต้องใช้
                    </h2>
                    <button 
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200 hover:shadow-xl'}`}
                      onClick={staffWorkStatus.prepared ? undefined : handleOpenAddDrugModal}
                      disabled={staffWorkStatus.prepared}
                      title={staffWorkStatus.prepared ? 'พนักงานจัดยาแล้ว — ไม่สามารถเพิ่มยาใหม่ได้' : 'เพิ่มยา'}
                    >
                      ➕ เพิ่มยา
                    </button>
                  </div>

                  {/* Grid Layout สำหรับยา */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {customer.prescribed_drugs.map((drugItem, index) => {
                      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                      const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                      const isOutOfStock = (
                        Array.isArray(outOfStockIds) && outOfStockIds.includes(drugId)
                      ) || (
                        Array.isArray(staffWorkStatus?.outOfStock) && staffWorkStatus.outOfStock.includes(drugId)
                      );
                      return (
                        <div
                          key={drugId}
                          className={`relative bg-white rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-lg ${isOutOfStock ? 'border-rose-200 bg-rose-50/30 border-l-4 border-l-rose-500' : 'border-slate-100 hover:border-indigo-200'}`}
                        >
                          {/* Quantity Badge */}
                          <div className="absolute -top-2 -right-2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-black rounded-full shadow-lg">
                            จำนวน {quantity}
                          </div>

                          {/* Drug Header */}
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-indigo-600 text-sm font-black shrink-0 shadow-inner">
                              Rx
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base font-black text-slate-800 mb-1 truncate">
                                {drug ? drug.name_th : 'กำลังโหลด...'}
                              </h4>
                              {isOutOfStock && (
                                <span className="inline-block px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full mb-1">หมดสต็อก</span>
                              )}
                              <p className="text-slate-500 text-xs truncate">
                                {drug ? drug.name_en : '-'}
                              </p>
                              {drug && drug.manufacturer && (
                                <p className="text-indigo-600 text-xs font-bold mt-1">📦 {drug.manufacturer}</p>
                              )}
                              {drug && drug.price && (
                                <p className="text-emerald-600 text-xs font-bold mt-0.5">💰 {drug.price} บาท</p>
                              )}
                            </div>
                          </div>

                          {/* Drug Description */}
                          {drug && drug.description && (
                            <div className="p-3 bg-slate-50 rounded-xl mb-4 text-xs text-slate-600">
                              {drug.description}
                            </div>
                          )}

                          {/* Batch Details */}
                          {drug && drug.drug_batches && drug.drug_batches.length > 0 && (
                            <details className="mb-4 bg-slate-50 rounded-xl overflow-hidden">
                              <summary className="px-4 py-2 cursor-pointer font-bold text-xs text-indigo-600 hover:bg-slate-100 transition-colors">
                                🏷️ Lots ({drug.drug_batches.length})
                              </summary>
                              <div className="px-4 pb-3 space-y-2">
                                {drug.drug_batches.map((batch, idx) => (
                                  <div key={batch.documentId || idx} className="p-2 bg-white rounded-lg text-[10px]">
                                    <div className="text-slate-700">Lot: <strong>{batch.lot_number}</strong></div>
                                    <div className="text-slate-700">สต็อก: <strong>{batch.quantity}</strong></div>
                                    {batch.date_produced && <div className="text-slate-500">วันผลิต: {batch.date_produced}</div>}
                                    {batch.expiry_date && <div className="text-rose-600 font-bold">หมดอายุ: {batch.expiry_date}</div>}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                          {/* Reminder Time Input */}
                          <div className="mt-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 p-4 space-y-4 mb-4">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                                🥣 ช่วงเวลาที่ทาน
                              </label>
                              <select
                                value={drugItem.meal_relation || drug?.meal_relation || 'after'}
                                onChange={async (e) => {
                                  const newRelation = e.target.value;
                                  const newDrugs = [...customer.prescribed_drugs];
                                  if (typeof newDrugs[index] === 'string') {
                                    newDrugs[index] = { drugId: drugId, quantity: quantity, meal_relation: newRelation };
                                  } else {
                                    newDrugs[index] = { ...newDrugs[index], meal_relation: newRelation };
                                  }
                                  
                                  if (notifId) {
                                    setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                    return;
                                  }
                                  
                                  try {
                                    const token = localStorage.getItem('jwt');
                                    await fetch(API.customerProfiles.update(customerDocumentId), {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ data: { prescribed_drugs: newDrugs } })
                                    });
                                    setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                    toast.success('อัปเดตวิธีการทานยาแล้ว');
                                  } catch (err) {
                                    toast.error('บันทึกไม่สำเร็จ');
                                  }
                                }}
                                disabled={staffWorkStatus.prepared}
                                className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-[10px] font-black text-indigo-700 outline-none"
                              >
                                <option value="before">ก่อนอาหาร</option>
                                <option value="after">หลังอาหาร</option>
                                <option value="with_meal">พร้อมอาหาร</option>
                                <option value="none">ไม่ระบุ</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { id: 'take_morning', label: 'เช้า', icon: '🌅' },
                                { id: 'take_lunch', label: 'เที่ยง', icon: '☀️' },
                                { id: 'take_evening', label: 'เย็น', icon: '🌆' },
                                { id: 'take_bedtime', label: 'นอน', icon: '🌙' },
                              ].map(slot => {
                                const isSelected = drugItem[slot.id] !== undefined ? !!drugItem[slot.id] : !!drug?.[slot.id];
                                return (
                                  <button
                                    key={slot.id}
                                    onClick={async () => {
                                      if (staffWorkStatus.prepared) return;
                                      const newDrugs = [...customer.prescribed_drugs];
                                      const updatedValue = !isSelected;
                                      
                                      if (typeof newDrugs[index] === 'string') {
                                        newDrugs[index] = { drugId: drugId, quantity: quantity, [slot.id]: updatedValue };
                                      } else {
                                        newDrugs[index] = { ...newDrugs[index], [slot.id]: updatedValue };
                                      }

                                      if (notifId) {
                                        setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                        return;
                                      }

                                      try {
                                        const token = localStorage.getItem('jwt');
                                        await fetch(API.customerProfiles.update(customerDocumentId), {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                          body: JSON.stringify({ data: { prescribed_drugs: newDrugs } })
                                        });
                                        setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                      } catch (err) {
                                        toast.error('บันทึกไม่สำเร็จ');
                                      }
                                    }}
                                    disabled={staffWorkStatus.prepared}
                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-100 text-slate-400 opacity-60'}`}
                                  >
                                    <span className="text-sm">{slot.icon}</span>
                                    <span className="text-[8px] font-black uppercase">{slot.label}</span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="relative border-t border-indigo-100 pt-3">
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                หรือระบุเวลาแจ้งเตือนระบุเฉพาะ (Manual)
                              </label>
                              <div className="relative">
                                <input
                                  type="time"
                                  defaultValue={drugItem.reminder_time || (drug?.suggested_time ? drug.suggested_time.slice(0, 5) : "")}
                                  onChange={async (e) => {
                                    const newTime = e.target.value;
                                    const newDrugs = [...customer.prescribed_drugs];
                                    if (typeof newDrugs[index] === 'string') {
                                      newDrugs[index] = { drugId: drugId, quantity: quantity, reminder_time: newTime };
                                    } else {
                                      newDrugs[index] = { ...newDrugs[index], reminder_time: newTime };
                                    }

                                    if (notifId) {
                                      setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                      return;
                                    }

                                    try {
                                      const token = localStorage.getItem('jwt');
                                      await fetch(API.customerProfiles.update(customerDocumentId), {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ data: { prescribed_drugs: newDrugs } })
                                      });
                                      setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                    } catch (err) {
                                      toast.error('บันทึกเวลาไม่สำเร็จ');
                                    }
                                  }}
                                  disabled={staffWorkStatus.prepared}
                                  className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none transition-all cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Dosage & Frequency Controls */}
                          <div className="bg-violet-50/50 rounded-2xl border border-violet-100 p-4 space-y-3 mb-4">
                            {/* Frequency */}
                            <div className="flex items-center justify-between gap-3">
                              <label className="text-[10px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                                🔄 ทานทุกกี่ชม.
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  defaultValue={drugItem.frequency_hours || drug?.frequency_hours || ''}
                                  onChange={async (e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const newDrugs = [...customer.prescribed_drugs];
                                    if (typeof newDrugs[index] === 'string') {
                                      newDrugs[index] = { drugId: drugId, quantity: quantity, frequency_hours: val };
                                    } else {
                                      newDrugs[index] = { ...newDrugs[index], frequency_hours: val };
                                    }
                                    if (notifId) {
                                      setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                      return;
                                    }
                                    try {
                                      const token = localStorage.getItem('jwt');
                                      await fetch(API.customerProfiles.update(customerDocumentId), {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ data: { prescribed_drugs: newDrugs } })
                                      });
                                      setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                    } catch (err) {
                                      toast.error('บันทึกไม่สำเร็จ');
                                    }
                                  }}
                                  disabled={staffWorkStatus.prepared}
                                  placeholder="0"
                                  className="w-16 bg-white border border-violet-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-violet-400 outline-none text-center"
                                />
                                <span className="text-[10px] font-bold text-slate-400">ชม.</span>
                              </div>
                            </div>
                            {(drugItem.frequency_hours > 0) && (
                              <p className="text-[10px] text-violet-500 font-bold">💡 ทานยาทุก {drugItem.frequency_hours} ชั่วโมง ({Math.floor(24 / drugItem.frequency_hours)} ครั้ง/วัน)</p>
                            )}

                            {/* Dosage per time */}
                            <div className="flex items-center justify-between gap-3 border-t border-violet-100 pt-3">
                              <label className="text-[10px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                                💊 ครั้งละ
                              </label>
                              <input
                                type="text"
                                defaultValue={drugItem.dosage_per_time || drug?.dosage_per_time || ''}
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  const newDrugs = [...customer.prescribed_drugs];
                                  if (typeof newDrugs[index] === 'string') {
                                    newDrugs[index] = { drugId: drugId, quantity: quantity, dosage_per_time: val };
                                  } else {
                                    newDrugs[index] = { ...newDrugs[index], dosage_per_time: val };
                                  }
                                  if (notifId) {
                                    setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                    return;
                                  }
                                  try {
                                    const token = localStorage.getItem('jwt');
                                    await fetch(API.customerProfiles.update(customerDocumentId), {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ data: { prescribed_drugs: newDrugs } })
                                    });
                                    setCustomer(prev => ({ ...prev, prescribed_drugs: newDrugs }));
                                  } catch (err) {
                                    toast.error('บันทึกไม่สำเร็จ');
                                  }
                                }}
                                disabled={staffWorkStatus.prepared}
                                placeholder="เช่น 1 เม็ด, 2 ช้อนชา"
                                className="w-40 bg-white border border-violet-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-violet-400 outline-none placeholder:font-medium placeholder:text-slate-300"
                              />
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                const newDrugs = customer.prescribed_drugs.filter(item => {
                                  const itemDrugId = typeof item === 'string' ? item : item.drugId;
                                  return itemDrugId !== drugId;
                                });
                                
                                if (notifId) {
                                  console.log('📝 Viewing old notification - removing drug from local state only');
                                  setCustomer(prev => ({
                                    ...prev,
                                    prescribed_drugs: newDrugs
                                  }));
                                  toast.success('ลบยาสำเร็จ (จะบันทึกเมื่อส่งข้อมูลให้พนักงาน)');
                                  return;
                                }
                                
                                try {
                                  const token = localStorage.getItem('jwt');
                                  const res = await fetch(API.customerProfiles.update(customerDocumentId), { method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      data: {
                                        prescribed_drugs: newDrugs
                                      }
                                    })
                                  });
                                  if (!res.ok) throw new Error('ลบยาไม่สำเร็จ');
                                  toast.success('ลบยาสำเร็จ');
                                  
                                  const customerRes = await fetch(
                                    API.customerProfiles.getByIdBasic(customerDocumentId),
                                    { headers: { Authorization: token ? `Bearer ${token}` : '' } }
                                  );
                                  const customerData = await customerRes.json();
                                  setCustomer(customerData.data);
                                } catch (err) {
                                  toast.error(err.message || 'เกิดข้อผิดพลาด');
                                }
                              }}
                              disabled={staffWorkStatus.prepared}
                              title={staffWorkStatus.prepared ? 'ไม่สามารถลบยา — พนักงานจัดส่งแล้ว' : 'ลบยา'}
                              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-100 hover:bg-rose-200 text-rose-700'}`}
                            >
                              🗑️ ลบ
                            </button>
                            {isOutOfStock ? (
                              <button
                                onClick={staffWorkStatus.prepared ? undefined : (e) => {
                                  e.stopPropagation();
                                  setAddDrugModal(prev => ({
                                    ...prev,
                                    open: true,
                                    selectedDrugs: [{ drugId: drugId, quantity }],
                                    filterBy: 'selected'
                                  }));
                                  setDrugQuantities(prev => ({ ...prev, [drugId]: quantity }));
                                  setActiveTab('2');
                                }}
                                disabled={staffWorkStatus.prepared}
                                title={staffWorkStatus.prepared ? 'ไม่สามารถเปลี่ยนยา — พนักงานจัดส่งแล้ว' : 'เปลี่ยนยา'}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}
                              >
                                🔄 เปลี่ยนยา
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDrugDetailModal({ open: true, drug });
                                }}
                                className="flex-1 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition-all"
                              >
                                📄 รายละเอียด
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      <span>💊</span> รายการยาที่ต้องใช้
                    </h2>
                    <button 
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${staffWorkStatus.prepared ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200 hover:shadow-xl'}`}
                      onClick={staffWorkStatus.prepared ? undefined : handleOpenAddDrugModal}
                      disabled={staffWorkStatus.prepared}
                      title={staffWorkStatus.prepared ? 'พนักงานจัดยาแล้ว — ไม่สามารถเพิ่มยาใหม่ได้' : 'เพิ่มยา'}
                    >
                      ➕ เพิ่มยา
                    </button>
                  </div>
                  <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="text-6xl mb-4">💊</div>
                    <h3 className="text-xl font-black text-slate-600 mb-2">ยังไม่มีรายการยาที่กำหนด</h3>
                    <p className="text-slate-400">คลิกปุ่ม "เพิ่มยา" เพื่อเริ่มเลือกยาสำหรับผู้ป่วย</p>
                  </div>
                </div>
              )}
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span className="flex items-center gap-2">⚡ ดำเนินการ</span>} key="4">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <button 
                  className="flex items-center justify-center gap-2 p-5 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all duration-200 group"
                  onClick={() => navigate(`/print_allergy_card/${customerDocumentId}?pharmacyId=${pharmacy?.documentId || pharmacyId}`)}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">🖨️</span>
                  <span className="font-bold text-slate-700">พิมพ์บัตรแพ้ยา</span>
                </button>

                <button 
                  className={`flex items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all duration-200 group ${staffWorkStatus.prepared ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100 hover:border-indigo-300 hover:shadow-lg'}`}
                  onClick={staffWorkStatus.prepared ? undefined : handleOpenAppointmentModal}
                  disabled={staffWorkStatus.prepared}
                  title={staffWorkStatus.prepared ? 'พนักงานจัดส่งยาแล้ว — ไม่สามารถแก้ไขวันนัดได้จากหน้านี้' : 'จัดการวันนัด'}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">📅</span>
                  <span className="font-bold text-slate-700">{customer.Follow_up_appointment_date ? 'แก้ไขวันนัดติดตามอาการ' : 'เพิ่มวันนัดติดตามอาการ'}</span>
                </button>

                <button 
                  className={`flex items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all duration-200 group ${staffWorkStatus.prepared ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-gradient-to-br from-violet-50 to-white border-violet-100 hover:border-violet-300 hover:shadow-lg'}`}
                  onClick={handleOpenStaffAssignModal}
                  disabled={staffWorkStatus.prepared}
                  title={staffWorkStatus.prepared ? 'ไม่สามารถส่งอัพเดต — พนักงานจัดส่งแล้ว' : 
                         (!newVisit && latestNotification && !staffWorkStatus.prepared) ? 'อัพเดตข้อมูลให้พนักงาน (กระดาษแผ่นเดิม)' : 
                         'ส่งข้อมูลให้พนักงาน (กระดาษแผ่นใหม่)'}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">📤</span>
                  <span className="font-bold text-slate-700">
                    {staffWorkStatus.prepared ? 'พนักงานจัดส่งแล้ว' : 
                     (!newVisit && latestNotification && latestNotification.id && !staffWorkStatus.prepared) ? 'อัพเดตข้อมูล' : 
                     'ส่งข้อมูลให้พนักงาน'}
                  </span>
                </button>

                <button 
                  className="flex items-center justify-center gap-2 p-5 bg-gradient-to-br from-amber-50 to-white rounded-2xl border-2 border-amber-100 hover:border-amber-300 hover:shadow-lg transition-all duration-200 group"
                  onClick={() => navigate(`/print_transfer_form/${customerDocumentId}?pharmacyId=${pharmacy?.documentId || pharmacyId}`)}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
                  <span className="font-bold text-slate-700">ใบส่งต่อร้านยา</span>
                </button>

                <button 
                  className="flex items-center justify-center gap-2 p-5 bg-gradient-to-br from-sky-50 to-white rounded-2xl border-2 border-sky-100 hover:border-sky-300 hover:shadow-lg transition-all duration-200 group"
                  onClick={handleEdit}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">✏️</span>
                  <span className="font-bold text-slate-700">แก้ไข</span>
                </button>

                <button 
                  className="flex items-center justify-center gap-2 p-5 bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all duration-200 group"
                  onClick={handleBack}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">↩️</span>
                  <span className="font-bold text-slate-700">กลับ</span>
                </button>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </main>


      {/* Modal สำหรับเพิ่ม/แก้ไขวันนัดติดตามอาการ */}
      <Modal
        title={null}
        open={isAppointmentModalOpen}
        onOk={handleSaveAppointment}
        onCancel={() => setIsAppointmentModalOpen(false)}
        okText="บันทึก"
        cancelText="ยกเลิก"
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
        footer={null}
        width={420}
      >
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
              <span className="text-3xl">📅</span>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1">
              {customer?.Follow_up_appointment_date ? 'แก้ไขวันนัด' : 'กำหนดวันนัด'}
            </h3>
            <p className="text-sm text-slate-500">กรุณาเลือกวันที่ต้องการนัดติดตามอาการ</p>
          </div>
          
          <DatePicker
            value={appointmentDate ? dayjs(appointmentDate) : null}
            onChange={date => setAppointmentDate(date ? date.format('YYYY-MM-DD') : null)}
            className="w-full [&_.ant-picker]:rounded-xl [&_.ant-picker]:border-2 [&_.ant-picker]:border-slate-200 [&_.ant-picker]:py-3 [&_.ant-picker-focused]:border-indigo-400"
            placeholder="เลือกวันนัดติดตามอาการ"
            format="YYYY-MM-DD"
            size="large"
          />
          
          {appointmentDate && (
            <div className="mt-4 p-4 bg-indigo-50 rounded-xl text-center">
              <p className="text-sm text-indigo-600 font-bold">วันที่เลือก: {formatThaiDate(appointmentDate)}</p>
            </div>
          )}
          
          <div className="flex gap-3 mt-6">
            {customer?.Follow_up_appointment_date && (
              <button
                onClick={handleDeleteAppointment}
                className="px-4 py-3 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-sm font-bold transition-all"
              >
                🗑️ ลบวันนัด
              </button>
            )}
            <button
              onClick={() => setIsAppointmentModalOpen(false)}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveAppointment}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all"
            >
              บันทึก
            </button>
          </div>
        </div>
      </Modal>

      {/* Allergy Detail Modal */}
      <Modal
        title={null}
        open={allergyDetailModal.open}
        onCancel={() => setAllergyDetailModal({ open: false, allergies: [] })}
        footer={null}
        centered
        width={600}
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-2xl">💊</div>
            <h3 className="text-xl font-black text-slate-800">รายละเอียดยาที่แพ้</h3>
          </div>
          
          {allergyDetailModal.allergies && allergyDetailModal.allergies.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {allergyDetailModal.allergies.map((allergy, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gradient-to-br from-rose-50 to-white rounded-2xl border border-rose-100 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <div className="text-base font-black text-rose-600 mb-2">
                        💊 {allergy.drug || 'ยาไม่ระบุชื่อ'}
                      </div>
                      {allergy.symptoms && (
                        <div className="text-sm text-slate-600 mb-1">
                          <span className="font-bold">อาการแพ้:</span> {allergy.symptoms}
                        </div>
                      )}
                      {allergy.date && (
                        <div className="text-xs text-slate-400">
                          <span className="font-bold">วันที่บันทึก:</span> {formatThaiDate(allergy.date)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✓</div>
              <p className="text-slate-500">ไม่มีข้อมูลยาที่แพ้</p>
            </div>
          )}
          
          <button
            onClick={() => setAllergyDetailModal({ open: false, allergies: [] })}
            className="w-full mt-6 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
          >
            ปิด
          </button>
        </div>
      </Modal>

      {/* Modal สำหรับดูรายละเอียดข้อมูลทางการแพทย์ */}
      <Modal
        title={null}
        open={medicalModal.open}
        onCancel={() => setMedicalModal({ ...medicalModal, open: false })}
        footer={null}
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <span className="text-3xl">{medicalModal.icon}</span>
            <h3 className="text-xl font-black text-slate-800">{medicalModal.title}</h3>
          </div>
          
          {medicalModal.title === 'อาการ' && medicalModal.extra ? (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 rounded-xl">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-2">
                  <span>🩺</span> อาการนำ
                </div>
                <div className="text-slate-700">{medicalModal.extra.main}</div>
              </div>
              <div className="p-4 bg-amber-50/50 rounded-xl">
                <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-2">
                  <span>📖</span> ประวัติการเจ็บป่วย
                </div>
                <div className="text-slate-700">{medicalModal.extra.history}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 font-bold text-sm mb-2">
                  <span>📝</span> รายละเอียดเพิ่มเติม
                </div>
                <div className="text-slate-700">{medicalModal.extra.note}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500 mb-2">ข้อมูล{medicalModal.title}ของลูกค้า</p>
              <p className="text-xl font-bold text-slate-800">{medicalModal.value}</p>
            </div>
          )}
          
          <button
            onClick={() => setMedicalModal({ ...medicalModal, open: false })}
            className="w-full mt-6 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
          >
            ปิด
          </button>
        </div>
      </Modal>

      {/* Modal สำหรับแก้ไขยาที่แพ้ (Allergy) - รองรับหลายรายการ */}
      <Modal
        title={null}
        open={allergyModal.open}
        onCancel={() => setAllergyModal({ open: false, allergies: [], availableDrugs: [] })}
        footer={null}
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
        width={700}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">⚠️</div>
            <div>
              <h3 className="text-xl font-black text-slate-800">แก้ไขยาที่แพ้</h3>
              <p className="text-sm text-slate-500">{allergyModal.allergies.length} รายการ</p>
            </div>
          </div>
          
          <div className="max-h-[50vh] overflow-y-auto space-y-4">
            {/* ปุ่มเพิ่มรายการแพ้ใหม่ */}
            <button
              onClick={() => {
                setAllergyModal(prev => ({
                  ...prev,
                  allergies: [...prev.allergies, { drug: '', symptoms: '', date: '' }]
                }));
              }}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <span>➕</span> เพิ่มรายการแพ้ใหม่
            </button>

            {/* รายการแพ้แต่ละตัว */}
            {allergyModal.allergies.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>ยังไม่มีรายการแพ้ ให้คลิก "เพิ่มรายการแพ้ใหม่" เพื่อเริ่มเพิ่มข้อมูล</p>
              </div>
            ) : (
              allergyModal.allergies.map((allergy, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-100"
                >
                  {/* ลำดับและปุ่มลบ */}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-indigo-600">รายการที่ {idx + 1}</span>
                    <button
                      onClick={() => {
                        setAllergyModal(prev => ({
                          ...prev,
                          allergies: prev.allergies.filter((_, i) => i !== idx)
                        }));
                      }}
                      className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-all"
                    >
                      ลบ
                    </button>
                  </div>

                  {/* ส่วนที่ 1: ตัวยา */}
                  <div className="mb-4">
                    <label className="block mb-2 text-xs font-black text-slate-600">💊 ตัวยา</label>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const drug = allergyModal.availableDrugs.find(d => d.documentId === e.target.value);
                          if (drug) {
                            setAllergyModal(prev => ({
                              ...prev,
                              allergies: prev.allergies.map((a, i) =>
                                i === idx ? { ...a, drug: drug.name_th || drug.name_en } : a
                              )
                            }));
                          }
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all"
                    >
                      <option value="">-- เลือกยาจากร้าน --</option>
                      {allergyModal.availableDrugs.map(drug => (
                        <option key={drug.documentId} value={drug.documentId}>
                          {drug.name_th} ({drug.name_en})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={allergy.drug}
                      onChange={(e) => {
                        setAllergyModal(prev => ({
                          ...prev,
                          allergies: prev.allergies.map((a, i) =>
                            i === idx ? { ...a, drug: e.target.value } : a
                          )
                        }));
                      }}
                      placeholder="พิมพ์ชื่อยา"
                      className="w-full mt-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all"
                    />
                  </div>

                  {/* ส่วนที่ 2: อาการที่เกิดขึ้น */}
                  <div className="mb-4">
                    <label className="block mb-2 text-xs font-black text-slate-600">🩺 อาการที่เกิดขึ้น</label>
                    <textarea
                      value={allergy.symptoms}
                      onChange={(e) => {
                        setAllergyModal(prev => ({
                          ...prev,
                          allergies: prev.allergies.map((a, i) =>
                            i === idx ? { ...a, symptoms: e.target.value } : a
                          )
                        }));
                      }}
                      placeholder="เช่น ผื่นแดง คัน หมาดๆ ไม่สามารถหายใจได้ เป็นต้น"
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all resize-none"
                    />
                  </div>

                  {/* ส่วนที่ 3: วันที่เข้ามาแจ้งอาการ */}
                  <div>
                    <label className="block mb-2 text-xs font-black text-slate-600">📅 วันที่เข้ามาแจ้งอาการ</label>
                    <DatePicker
                      value={allergy.date ? dayjs(allergy.date) : null}
                      onChange={(date) => {
                        setAllergyModal(prev => ({
                          ...prev,
                          allergies: prev.allergies.map((a, i) =>
                            i === idx ? { ...a, date: date ? date.format('YYYY-MM-DD') : '' } : a
                          )
                        }));
                      }}
                      className="w-full [&_.ant-picker]:w-full [&_.ant-picker]:rounded-xl [&_.ant-picker]:border-2 [&_.ant-picker]:border-slate-200"
                      placeholder="เลือกวันที่"
                      format="YYYY-MM-DD"
                    />
                    {allergy.date && (
                      <div className="mt-2 text-[11px] text-slate-500">
                        วันที่เลือก: {formatThaiDate(allergy.date)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            {customer?.Allergic_drugs && (
              <button
                onClick={handleClearAllergy}
                className="px-4 py-3 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-sm font-bold transition-all"
              >
                🗑️ ลบทั้งหมด
              </button>
            )}
            <button
              onClick={() => setAllergyModal({ open: false, allergies: [], availableDrugs: [] })}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveAllergy}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all"
            >
              บันทึก
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal สำหรับแก้ไขข้อมูลทางการแพทย์ (pharmacy) */}
      <Modal
        title={null}
        open={editMedicalModal.open}
        onCancel={() => setEditMedicalModal({ ...editMedicalModal, open: false })}
        footer={null}
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
      >
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
              <span className="text-3xl">✏️</span>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1">แก้ไข{editMedicalModal.label}</h3>
            <p className="text-sm text-slate-500">กรุณากรอกข้อมูล{editMedicalModal.label}ใหม่</p>
          </div>
          
          <textarea
            value={editMedicalModal.value}
            onChange={e => setEditMedicalModal({ ...editMedicalModal, value: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all resize-none"
            placeholder={`ระบุ${editMedicalModal.label}`}
          />
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setEditMedicalModal({ ...editMedicalModal, open: false })}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveEditMedical}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all"
            >
              บันทึก
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal สำหรับแก้ไขอาการ */}
      <Modal
        title={null}
        open={editSymptomModal.open}
        onCancel={() => setEditSymptomModal({ ...editSymptomModal, open: false })}
        footer={null}
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
        width={500}
      >
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
              <span className="text-3xl">🩺</span>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1">
              {editSymptomModal.main === '' && editSymptomModal.history === '' && editSymptomModal.note === '' ? 'เพิ่มอาการ' : 'แก้ไขอาการ'}
            </h3>
            <p className="text-sm text-slate-500">กรุณากรอกข้อมูลอาการ</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-xs font-black text-indigo-600">🩺 อาการนำ</label>
              <textarea
                value={editSymptomModal.main}
                onChange={e => setEditSymptomModal({ ...editSymptomModal, main: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all resize-none"
                placeholder="ระบุอาการนำ"
              />
            </div>
            <div>
              <label className="block mb-2 text-xs font-black text-amber-600">📖 ประวัติการเจ็บป่วย</label>
              <textarea
                value={editSymptomModal.history}
                onChange={e => setEditSymptomModal({ ...editSymptomModal, history: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all resize-none"
                placeholder="ระบุประวัติการเจ็บป่วย"
              />
            </div>
            <div>
              <label className="block mb-2 text-xs font-black text-slate-500">📝 รายละเอียดเพิ่มเติม</label>
              <textarea
                value={editSymptomModal.note}
                onChange={e => setEditSymptomModal({ ...editSymptomModal, note: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all resize-none"
                placeholder="ระบุรายละเอียดเพิ่มเติม"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            {(customer.Customers_symptoms || customer.symptom_history || customer.symptom_note || 
             currentNotification?.data?.data?.symptoms || currentNotification?.data?.symptoms) && (
              <button
                onClick={() => {
                  showConfirmation({
                    title: '🗑️ ยืนยันการลบอาการ',
                    message: 'คุณต้องการลบข้อมูลอาการทั้งหมดใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
                    onConfirm: handleDeleteSymptom,
                    confirmText: 'ลบข้อมูล',
                    type: 'danger'
                  });
                }}
                className="px-4 py-3 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-sm font-bold transition-all"
              >
                🗑️ ลบทั้งหมด
              </button>
            )}
            <button
              onClick={() => setEditSymptomModal({ ...editSymptomModal, open: false })}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveEditSymptom}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:shadow-xl transition-all"
            >
              บันทึก
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Modal สำหรับเพิ่มยา */}
      <Modal
        title={null}
        open={addDrugModal.open}
        onCancel={() => {
          setAddDrugModal(prev => ({ ...prev, open: false, filterBy: 'all' }));
          setSearchTerm('');
        }}
        footer={null}
        centered
        width={window.innerWidth <= 768 ? '95%' : window.innerWidth <= 1024 ? '85%' : 800}
        style={{ 
          maxWidth: window.innerWidth <= 768 ? '95vw' : '90vw',
          margin: window.innerWidth <= 768 ? '0 auto' : undefined
        }}
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-2xl text-white shadow-lg shadow-indigo-200">💊</div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-800">เพิ่มรายการยาให้ผู้ป่วย</h3>
              <p className="text-sm text-slate-400">เลือกยาที่มีอยู่ในร้าน {pharmacy?.name_th}</p>
            </div>
            <div className={`px-3 py-2 rounded-xl text-sm font-bold ${addDrugModal.selectedDrugs.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
              ✓ {addDrugModal.selectedDrugs.length} รายการ
            </div>
          </div>

          {/* Patient Info */}
          <div className="mb-4 p-3 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-800">👤 {user?.full_name}</span>
            </p>
          </div>

          {/* Search and Filter */}
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={window.innerWidth <= 768 ? "ค้นหายา..." : "ค้นหายา (ชื่อไทย, อังกฤษ หรือรายละเอียด)..."}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all"
              />
              <button
                onClick={() => setSearchTerm('')}
                disabled={!searchTerm}
                className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${searchTerm ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
              >
                ล้าง
              </button>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'ทั้งหมด', count: addDrugModal.availableDrugs.length },
                { key: 'selected', label: 'เลือกแล้ว', count: addDrugModal.selectedDrugs.length },
                { key: 'unselected', label: 'ยังไม่เลือก', count: addDrugModal.availableDrugs.length - addDrugModal.selectedDrugs.length }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setAddDrugModal(prev => ({ ...prev, filterBy: filter.key }))}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${addDrugModal.filterBy === filter.key ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' : 'bg-slate-100 text-slate-500 border-2 border-transparent hover:border-slate-200'}`}
                >
                  {window.innerWidth <= 768 ? filter.label : `${filter.label} (${filter.count})`}
                </button>
              ))}
            </div>
          </div>

          {/* Drug List */}
          <div className="max-h-[350px] overflow-y-auto rounded-2xl border border-slate-100">
            {addDrugModal.availableDrugs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50">
                <div className="text-5xl mb-3">📦</div>
                <h3 className="font-bold text-slate-700 mb-1">ไม่มียาในร้านนี้</h3>
                <p className="text-sm text-slate-400">กรุณาติดต่อเจ้าหน้าที่เพื่อเพิ่มข้อมูลยา</p>
              </div>
            ) : (
              (() => {
                // Prepare normalized allergy list from customer data (handles array of allergies)
                const allergyNames = (() => {
                  const raw = customer?.Allergic_drugs;
                  if (!raw) return [];
                  try {
                    if (Array.isArray(raw)) {
                      // New format: array of { drug, symptoms, date } or just strings
                      return raw.map(item => {
                        const allergyDrug = typeof item === 'string' ? item : (item?.drug || '');
                        return String(allergyDrug).toLowerCase();
                      }).filter(Boolean);
                    }
                    if (typeof raw === 'object') {
                      // Old format: single object with `drug` field
                      if (raw.drug) return [String(raw.drug).toLowerCase()];
                      // Fallback: collect string values
                      return Object.values(raw).flat().map(v => String(v).toLowerCase()).filter(Boolean);
                    }
                    if (typeof raw === 'string') {
                      const s = raw.trim();
                      if (s.startsWith('[')) {
                        // JSON array
                        const parsed = JSON.parse(s);
                        return parsed.map(item => {
                          const allergyDrug = typeof item === 'string' ? item : (item?.drug || '');
                          return String(allergyDrug).toLowerCase();
                        }).filter(Boolean);
                      }
                      if (s.startsWith('{')) {
                        // Single JSON object
                        const parsed = JSON.parse(s);
                        if (parsed && parsed.drug) return [String(parsed.drug).toLowerCase()];
                      }
                      // Plain string
                      return s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
                    }
                  } catch (e) {
                    return [];
                  }
                  return [];
                })();

                const filteredDrugs = addDrugModal.availableDrugs
                  .filter(drug => {
                    const matchesSearch = searchTerm === '' || 
                      drug.name_th.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      drug.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (drug.description && drug.description.toLowerCase().includes(searchTerm.toLowerCase()));
                    
                    const matchesFilter = addDrugModal.filterBy === 'all' ||
                      (addDrugModal.filterBy === 'selected' && addDrugModal.selectedDrugs.some(item => {
                        const itemDrugId = typeof item === 'string' ? item : item.drugId;
                        return itemDrugId === drug.documentId;
                      })) ||
                      (addDrugModal.filterBy === 'unselected' && !addDrugModal.selectedDrugs.some(item => {
                        const itemDrugId = typeof item === 'string' ? item : item.drugId;
                        return itemDrugId === drug.documentId;
                      }));
                    
                    return matchesSearch && matchesFilter;
                  });

                return filteredDrugs.length === 0 ? (
                  <div className="drug-list-empty">
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
                    <h3>ไม่พบยาที่ค้นหา</h3>
                    <p>ลองเปลี่ยนคำค้นหาหรือเลือกตัวกรองอื่น</p>
                  </div>
                ) : (
                  <div className="drug-list-container">
                    {filteredDrugs.map(drug => {
                      const isSelected = addDrugModal.selectedDrugs.some(item => {
                        const itemDrugId = typeof item === 'string' ? item : item.drugId;
                        return itemDrugId === drug.documentId;
                      });
                      // Disable if staff reported out of stock for this drug
                      const isOutOfStock = Array.isArray(staffWorkStatus?.outOfStock) && staffWorkStatus.outOfStock.includes(drug.documentId);
                      // Determine if this drug matches any allergy entry (by name or id)
                      const dNameTh = (drug.name_th || '').toString().toLowerCase();
                      const dNameEn = (drug.name_en || '').toString().toLowerCase();
                      const dId = (drug.documentId || drug.id || '').toString().toLowerCase();
                      const isAllergic = allergyNames.length > 0 && (
                        allergyNames.includes(dId) ||
                        allergyNames.some(a => (dNameTh && dNameTh.includes(a)) || (dNameEn && dNameEn.includes(a)) || a === dNameTh || a === dNameEn)
                      );
                      return (
                        <div 
                          key={drug.documentId} 
                          className={`p-4 rounded-2xl border-2 transition-all duration-200 relative ${isSelected ? 'border-emerald-400 bg-gradient-to-r from-emerald-50 to-blue-50 shadow-lg shadow-emerald-100' : 'border-slate-100 bg-white shadow-sm hover:border-indigo-200'} ${isAllergic || isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          onClick={() => {
                            if (isAllergic) {
                              // Optionally show a quick toast to explain why disabled
                              toast.warn('ไม่สามารถเลือกยานี้ได้ เนื่องจากลูกค้าแพ้ยา');
                              return;
                            }
                            if (isOutOfStock) {
                              toast.warn('ไม่สามารถเลือกยานี้ได้ เนื่องจากพนักงานแจ้งว่ายาหมดสต็อก');
                              return;
                            }
                            
                            // เช็คสต๊อกก่อนเลือกยา (เฉพาะตอนเพิ่มยาใหม่ ไม่เช็คตอนลบออก)
                            if (!isSelected) {
                              // คำนวณจำนวนยาทั้งหมดในสต๊อกจาก drug_batches
                              const totalStock = drug.drug_batches && Array.isArray(drug.drug_batches)
                                ? drug.drug_batches.reduce((sum, batch) => sum + (parseInt(batch.quantity) || 0), 0)
                                : 0;
                              
                              console.log('Checking stock for drug:', drug.name_th, 'Total stock:', totalStock);
                              
                              // ถ้าไม่มีสต๊อกหรือสต๊อก = 0
                              if (totalStock <= 0) {
                                toast.error(`ยา "${drug.name_th}" หมดสต๊อก กรุณาเพิ่มสต๊อกก่อนเลือก`, {
                                  autoClose: 4000
                                });
                                
                                // Navigate ไปหน้า DrugList พร้อมชี้ไปยังยานั้น
                                setTimeout(() => {
                                  navigate(`/drug_store_pharmacy/${pharmacyId}/drugs`, {
                                    state: { 
                                      highlightDrugId: drug.documentId,
                                      highlightDrugName: drug.name_th,
                                      fromOutOfStock: true
                                    }
                                  });
                                }, 500);
                                return;
                              }
                            }
                            
                            if (isSelected) {
                              // ลบออกจาก selectedDrugs
                              setAddDrugModal(prev => ({
                                ...prev,
                                selectedDrugs: prev.selectedDrugs.filter(item => {
                                  const itemDrugId = typeof item === 'string' ? item : item.drugId;
                                  return itemDrugId !== drug.documentId;
                                })
                              }));
                              // ลบออกจาก quantities
                              setDrugQuantities(prev => {
                                const newQuantities = { ...prev };
                                delete newQuantities[drug.documentId];
                                return newQuantities;
                              });
                            } else {
                              // เปิด Modal ตั้งค่าเวลาทาน (Notification Settings)
                              const _defaults = {
                                take_morning: !!drug.take_morning,
                                take_lunch: !!drug.take_lunch,
                                take_evening: !!drug.take_evening,
                                take_bedtime: !!drug.take_bedtime,
                                meal_relation: drug.meal_relation || 'after',
                                reminder_time: drug.suggested_time ? drug.suggested_time.slice(0, 5) : '',
                                dosage_per_time: drug.dosage_per_time || '',
                                frequency_hours: drug.frequency_hours || 0
                              };
                              setDrugNotificationModal({
                                open: true,
                                drug,
                                drugId: drug.documentId,
                                ...Object.fromEntries(Object.entries(_defaults)),
                                quantity: 1,
                                useDefaults: true,
                                drugDefaults: _defaults
                              });
                            }
                          }}
                        >
                          {/* Selection Status */}
                          <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${isSelected ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            {isSelected ? '✓' : '+'}
                          </div>

                          {/* Drug Info */}
                          <div className="pr-10">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-indigo-600 font-bold">Rx</span>
                              <h4 className={`font-bold ${isSelected ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                {drug.name_th}
                              </h4>
                              {isAllergic && (
                                <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">แพ้</span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-2 text-xs">
                              <span className="text-slate-500">{drug.name_en}</span>
                              {drug && drug.manufacturer && (
                                <span className="px-2 py-0.5 bg-indigo-600 text-white font-bold rounded">
                                  📦 {drug.manufacturer}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 font-bold rounded ${isSelected ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
                                {drug.price} บาท
                              </span>
                            </div>

                            {drug.description && (
                              <p className="text-xs text-slate-500 leading-relaxed mb-2">{drug.description}</p>
                            )}
                            
                            {/* Additional Info */}
                            <div className="flex gap-3 text-[10px] text-slate-400">
                              {drug.lot_number && <span>Lot: {drug.lot_number}</span>}
                              {drug.expiry_date && <span>หมดอายุ: {drug.expiry_date}</span>}
                            </div>
                            
                            {/* Quantity Input - แสดงเฉพาะเมื่อเลือกยาแล้ว */}
                            {isSelected && (
                              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="block text-xs font-bold text-slate-700 mb-2">จำนวน:</label>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentQty = drugQuantities[drug.documentId] || 1;
                                      if (currentQty > 1) {
                                        setDrugQuantities(prev => ({
                                          ...prev,
                                          [drug.documentId]: currentQty - 1
                                        }));
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-100 transition-all"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    max="999"
                                    value={drugQuantities[drug.documentId] || 1}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const value = parseInt(e.target.value) || 1;
                                      setDrugQuantities(prev => ({
                                        ...prev,
                                        [drug.documentId]: Math.max(1, Math.min(999, value))
                                      }));
                                    }}
                                    className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-center text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentQty = drugQuantities[drug.documentId] || 1;
                                      if (currentQty < 999) {
                                        setDrugQuantities(prev => ({
                                          ...prev,
                                          [drug.documentId]: currentQty + 1
                                        }));
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-100 transition-all"
                                  >
                                    +
                                  </button>
                                  <span className="text-xs text-slate-500 ml-2">
                                    {drug.price && `รวม ${((drugQuantities[drug.documentId] || 1) * parseFloat(drug.price)).toLocaleString()} บาท`}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          {/* Summary */}
          {addDrugModal.selectedDrugs.length > 0 && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <h4 className="text-sm font-black text-emerald-700 mb-3">✓ สรุปยาที่เลือก ({addDrugModal.selectedDrugs.length} รายการ)</h4>
              <div className="flex flex-wrap gap-2">
                {addDrugModal.selectedDrugs.map(drugItem => {
                  const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                  const quantity = drugQuantities[drugId] || (typeof drugItem === 'object' ? drugItem.quantity : 1) || 1;
                  const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                  return drug ? (
                    <span key={drugId} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm font-medium text-emerald-800">
                      {drug.name_th} (×{quantity})
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddDrugModal(prev => ({
                            ...prev,
                            selectedDrugs: prev.selectedDrugs.filter(item => {
                              const itemDrugId = typeof item === 'string' ? item : item.drugId;
                              return itemDrugId !== drugId;
                            })
                          }));
                          setDrugQuantities(prev => {
                            const newQuantities = { ...prev };
                            delete newQuantities[drugId];
                            return newQuantities;
                          });
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 transition-all text-xs font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setAddDrugModal(prev => ({ ...prev, open: false, filterBy: 'all' }));
                setSearchTerm('');
              }}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveAddDrug}
              disabled={addDrugModal.selectedDrugs.length === 0}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all ${addDrugModal.selectedDrugs.length > 0 ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-200 hover:shadow-xl' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              บันทึกรายการยา
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        title={null}
        open={confirmModal.open}
        onCancel={closeConfirmModal}
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
        footer={null}
        width={400}
      >
        <div className="p-6">
          <div className="text-center mb-6">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${confirmModal.type === 'danger' ? 'bg-rose-100' : confirmModal.type === 'warning' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
              <span className="text-3xl">{confirmModal.type === 'danger' ? '⚠️' : confirmModal.type === 'warning' ? '⚡' : 'ℹ️'}</span>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-slate-500">{confirmModal.message}</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={closeConfirmModal}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              {confirmModal.cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all ${confirmModal.type === 'danger' ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-200' : confirmModal.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200' : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200'}`}
            >
              {confirmModal.confirmText}
            </button>
          </div>
        </div>
      </Modal>

      {/* Staff Assignment Modal */}
      <Modal
        title={null}
        open={staffAssignModal.open}
        onCancel={() => setStaffAssignModal({ ...staffAssignModal, open: false, selectedStaffId: null, assignNote: '' })}
        footer={null}
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
        width={600}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-2xl">👥</div>
            <h3 className="text-xl font-black text-slate-800">ส่งข้อมูลผู้ป่วยให้พนักงาน</h3>
          </div>
          
          {/* ข้อมูลผู้ป่วย */}
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl">
            <h4 className="text-sm font-black text-slate-600 mb-3 flex items-center gap-2"><span>👤</span> ข้อมูลผู้ป่วย</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">ชื่อ:</span>
                <span className="font-bold text-slate-700">{user?.full_name || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">เบอร์:</span>
                <span className="font-bold text-slate-700">{user?.phone || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">อาการ:</span>
                <span className="font-bold text-slate-700">{customer.Customers_symptoms || 'ไม่ระบุ'}</span>
              </div>
            </div>
          </div>

          {/* รายชื่อพนักงาน */}
          <div className="mb-6">
            <h4 className="text-sm font-black text-slate-600 mb-3 flex items-center gap-2"><span>💼</span> เลือกพนักงาน</h4>
            {staffAssignModal.loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-3"></div>
                <p className="text-slate-500 text-sm">กำลังโหลดข้อมูลพนักงาน...</p>
              </div>
            ) : staffAssignModal.availableStaff.length === 0 ? (
              <div className="text-center py-8 bg-rose-50/50 rounded-2xl">
                <div className="text-4xl mb-3">🚨</div>
                <h4 className="font-bold text-slate-700 mb-1">ไม่มีพนักงานออนไลน์</h4>
                <p className="text-slate-500 text-sm">ขณะนี้ไม่มีพนักงานที่เข้าสู่ระบบหรือออนไลน์</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {staffAssignModal.availableStaff.map(staff => {
                  const staffUser = staff.users_permissions_user;
                  const isSelected = staffAssignModal.selectedStaffId === staff.documentId;
                  return (
                    <div
                      key={staff.documentId}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${isSelected ? 'bg-indigo-50 border-indigo-300 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                      onClick={() => setStaffAssignModal(prev => ({ 
                        ...prev, 
                        selectedStaffId: staff.documentId 
                      }))}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black ${isSelected ? 'bg-gradient-to-br from-indigo-500 to-violet-500' : 'bg-slate-300'}`}>
                          {staffUser?.full_name?.charAt(0) || 'S'}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-slate-800 text-sm">{staffUser?.full_name || 'ไม่ระบุชื่อ'}</h5>
                          <p className="text-xs text-slate-400">พนักงานขายยา</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">• ออนไลน์</span>
                      </div>
                      {staffUser?.phone && (
                        <p className="mt-2 text-xs text-slate-500">📞 {staffUser.phone}</p>
                      )}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-indigo-200 text-center">
                          <span className="text-xs font-bold text-indigo-600">✔️ เลือกแล้ว</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* หมายเหตุ */}
          {staffAssignModal.selectedStaffId && (
            <div className="mb-6">
              <label className="block text-sm font-black text-slate-600 mb-2">📝 หมายเหตุ (ส่งถึงพนักงาน)</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:border-indigo-400 focus:outline-none transition-all resize-none"
                placeholder="ระบุข้อมูลเพิ่มเติม หรือคำแนะนำสำหรับพนักงาน..."
                rows={3}
                value={staffAssignModal.assignNote}
                onChange={(e) => setStaffAssignModal(prev => ({ 
                  ...prev, 
                  assignNote: e.target.value 
                }))}
              />
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => setStaffAssignModal({ ...staffAssignModal, open: false, selectedStaffId: null, assignNote: '' })}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => handleAssignToStaff(null, false)}
              disabled={!staffAssignModal.selectedStaffId}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all ${staffAssignModal.selectedStaffId ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-200 hover:shadow-xl' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              ส่งข้อมูล
            </button>
          </div>
        </div>
      </Modal>

      {/* Out of Stock Drugs Modal */}
      <Modal
        title={null}
        open={outOfStockModal.open}
        onCancel={() => {
          setOutOfStockModal({ open: false, drugs: [] });
          setOutOfStockIds([]);
        }}
        footer={null}
        centered
        width={500}
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-2xl">🚨</div>
            <div>
              <h3 className="text-xl font-black text-rose-600">ยาที่หมดสต็อก</h3>
              <p className="text-sm text-slate-500">{outOfStockModal.drugs.length} รายการ</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 mb-4">
            รายชื่อยาที่ {assignedByStaff?.users_permissions_user?.full_name || 'พนักงาน'} แจ้งว่าหมดสต็อก:
          </p>
          
          <div className="max-h-[400px] overflow-y-auto rounded-2xl border border-slate-100">
            {outOfStockModal.drugs.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/50">
                <div className="text-5xl mb-3">📦</div>
                <p className="text-slate-400">ไม่มีข้อมูลยาหมดสต็อก</p>
              </div>
            ) : (
              outOfStockModal.drugs.map((drug, index) => (
                <div 
                  key={drug.documentId || index} 
                  className={`flex items-center gap-4 p-4 bg-rose-50/50 ${index < outOfStockModal.drugs.length - 1 ? 'border-b border-rose-100' : ''}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white text-lg flex-shrink-0">
                    💊
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-rose-600 text-sm mb-0.5">{drug.name_th}</h4>
                    <p className="text-xs text-slate-500">{drug.name_en}</p>
                    {drug.price && (
                      <p className="text-xs text-slate-400 mt-1">ราคา: {drug.price} บาท</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <span className="text-xl">💡</span>
            <p className="text-xs text-emerald-700 font-medium">เภสัชกรควรตรวจสอบสต็อกและสั่งซื้อยาเหล่านี้</p>
          </div>
        </div>
      </Modal>

      {/* Drug Detail Modal - opens when clicking 'รายละเอียด' on a prescribed drug */}
      <Modal
        title={null}
        open={drugDetailModal.open}
        onCancel={() => setDrugDetailModal({ open: false, drug: null })}
        footer={null}
        centered
        className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
      >
        {drugDetailModal.drug ? (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl">💊</div>
              <div>
                <h3 className="text-xl font-black text-slate-800">{drugDetailModal.drug.name_th}</h3>
                <p className="text-sm text-slate-400">{drugDetailModal.drug.name_en || '-'}</p>
              </div>
            </div>
            
            {drugDetailModal.drug.description && (
              <p className="text-sm text-slate-600 mb-4 p-3 bg-slate-50 rounded-xl">{drugDetailModal.drug.description}</p>
            )}
            
            {(() => {
              const d = drugDetailModal.drug || {};
              const price = d.price || (d.attributes && d.attributes.price);
              const lot = d.lot_number || d.lotNumber || (d.attributes && (d.attributes.lot_number || d.attributes.lotNumber));
              const quantity = d.quantity || d.qty || (d.attributes && (d.attributes.quantity || d.attributes.qty));
              const dateProduced = d.date_produced || d.dateProduced || (d.attributes && (d.attributes.date_produced || d.attributes.dateProduced));
              const expiry = d.expiry_date || d.expiryDate || (d.attributes && (d.attributes.expiry_date || d.attributes.expiryDate));

              // Prefer showing batch list when available to match the card view
              const rawBatches = d.drug_batches || (d.attributes && d.attributes.drug_batches) || null;
              const batches = Array.isArray(rawBatches) ? rawBatches.map(b => (b && b.attributes) ? { id: b.id, ...b.attributes } : b) : [];

              if (batches.length > 0) {
                return (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">📦</span>
                      <span className="text-sm font-black text-slate-600">รายการ Lot ({batches.length})</span>
                    </div>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {batches.map((batch, i) => (
                        <div key={batch.documentId || batch.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-slate-500">Lot:</span>
                            <span className="font-bold text-indigo-600">{batch.lot_number || '-'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">สต็อก:</span>
                            <span className="font-bold text-slate-700">{batch.quantity || 0}</span>
                            {batch.date_produced && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500">ผลิต:</span>
                                <span className="font-medium text-slate-700">{formatThaiDate(batch.date_produced)}</span>
                              </>
                            )}
                          </div>
                          {batch.expiry_date && (
                            <div className="mt-2 text-xs">
                              <span className="text-slate-500">หมดอายุ:</span>
                              <span className="ml-1 font-medium text-amber-600">{formatThaiDate(batch.expiry_date)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              const hasLotInfo = !!(lot || quantity || dateProduced || expiry || price);

              if (!hasLotInfo) {
                return (
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl mb-4">
                    <div className="text-3xl">📦</div>
                    <div>
                      <h4 className="font-bold text-slate-700">ไม่มีข้อมูล Lot</h4>
                      <p className="text-xs text-slate-500">ไม่มีรายละเอียด Lot, จำนวน หรือวันที่ผลิต/หมดอายุ สำหรับรายการยานี้</p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {price !== undefined && price !== null && (
                    <div className="p-3 bg-emerald-50 rounded-xl">
                      <span className="text-xs text-slate-500">ราคา</span>
                      <p className="font-bold text-emerald-600">{price} ฿</p>
                    </div>
                  )}
                  {lot && (
                    <div className="p-3 bg-indigo-50 rounded-xl">
                      <span className="text-xs text-slate-500">Lot</span>
                      <p className="font-bold text-indigo-600">{lot}</p>
                    </div>
                  )}
                  {quantity !== undefined && quantity !== null && (
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <span className="text-xs text-slate-500">จำนวน</span>
                      <p className="font-bold text-blue-600">{quantity} แผง</p>
                    </div>
                  )}
                  {dateProduced && (
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-xs text-slate-500">ผลิต</span>
                      <p className="font-bold text-slate-700">{formatThaiDate(dateProduced)}</p>
                    </div>
                  )}
                  {expiry && (
                    <div className="p-3 bg-amber-50 rounded-xl">
                      <span className="text-xs text-slate-500">หมดอายุ</span>
                      <p className="font-bold text-amber-600">{formatThaiDate(expiry)}</p>
                    </div>
                  )}
                </div>
              );
            })()}
            
            <button
              onClick={() => setDrugDetailModal({ open: false, drug: null })}
              className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              ปิด
            </button>
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="text-5xl mb-4">💊</div>
            <p className="text-slate-400">ไม่พบข้อมูลยา</p>
          </div>
        )}
      </Modal>

      {/* Modal สำหรับตั้งค่าเวลาทานยา (Notification Settings) - Extracted to component */}
      <DrugNotificationModal
        drugNotificationModal={drugNotificationModal}
        setDrugNotificationModal={setDrugNotificationModal}
        addDrugModal={addDrugModal}
        setAddDrugModal={setAddDrugModal}
        setDrugQuantities={setDrugQuantities}
      />

      {/* Staff Work Status Update Modal - REMOVED: Pharmacy should not update staff status, only view it */}
      {/* Modal removed because pharmacy view should only display status, not update it */}
    </div>
  );
}

export default CustomerDetail;


