import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/pharmacy/detail_customer.css';
import 'react-toastify/dist/ReactToastify.css';
import { Modal, DatePicker, Tabs } from 'antd';
import dayjs from 'dayjs';
import { API, fetchWithAuth } from '../../../utils/apiConfig';
import useSmartPolling from '../../../hooks/useSmartPolling';

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
  
  // Get pharmacyId from URL params
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');

  useEffect(() => {
    console.log('useEffect triggered with customerDocumentId:', customerDocumentId, 'pharmacyId:', pharmacyId);
    const loadCustomerData = async () => {
      console.log('loadCustomerData function called');
      
      // Validate customerDocumentId before making API call
      if (!customerDocumentId) {
        console.log('customerDocumentId is null or undefined, skipping load');
        setLoading(false);
        return;
      }
      
      try {
        const token = localStorage.getItem('jwt');
        console.log('Token exists:', !!token);
        
        // Load customer data using getByDocumentId instead of getById
        const customerRes = await fetch(
          API.customerProfiles.getByDocumentId(customerDocumentId),
          {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          }
        );
        
        if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
        
        const customerData = await customerRes.json();
        console.log('Customer data loaded:', customerData);
        const customer = Array.isArray(customerData.data) ? customerData.data[0] : customerData.data;
        setCustomer(customer);
        
        // โหลด assigned_by_staff ถ้ามีและมี documentId ให้ถือว่าเป็นข้อมูลที่สมบูรณ์
        if (customer?.assigned_by_staff && customer.assigned_by_staff.documentId) {
          console.log('Customer has assigned_by_staff:', customer.assigned_by_staff);
          setAssignedByStaff(customer.assigned_by_staff);
        } else {
          console.log('Customer does NOT have assigned_by_staff or it is incomplete');
          setAssignedByStaff(null);
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
          
          // โหลด staff work status จาก latest notification
          if (customer?.assigned_by_staff?.documentId) {
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
                const errorData = await notificationRes.json().catch(() => ({}));
                console.log('Notification API failed with status:', notificationRes.status, 'Error:', errorData);
              }
            } catch (err) {
              console.error('Error loading staff work status:', err);
            }
          } else {
            console.log('No assigned_by_staff.documentId found, skipping notification load');
            setLatestNotification(null);
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
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
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
      toast.warning('⚠️ Connection to real-time server lost, falling back to polling');
    });

    // Handle disconnect
    socketRef.current.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from server:', reason);
    });

    // Listen for notification updates from staff
    socketRef.current.on('notification:update', (updatedNotif) => {
      console.log('[Socket] Received staff status update:', updatedNotif);
      
      if (!updatedNotif) return;

      // Update notification and staff work status
      setLatestNotification(updatedNotif);
      
      if (updatedNotif.staff_work_status) {
        const hasChanges = JSON.stringify(staffWorkStatus) !== JSON.stringify(updatedNotif.staff_work_status);
        if (hasChanges) {
          setStaffWorkStatus(updatedNotif.staff_work_status);
          toast.info('🔄 พนักงานได้อัพเดตสถานะ');
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

  // Smart Polling: fallback when socket is not available (keep as backup)
  const { resetInterval: resetNotificationPoll } = useSmartPolling(
    !socketRef.current?.connected && latestNotification?.documentId ? API.notifications.getByDocumentId(latestNotification.documentId) : null,
    {
      initialInterval: 2000, // เริ่มต้น 2 วินาที
      maxInterval: 30000, // สูงสุด 30 วินาที
      backoffMultiplier: 1.3,
      enabled: !!latestNotification?.documentId,
      onDataChange: (newData) => {
        // newData is the direct response from API: { data: {...} }
        const updatedNotif = newData?.data || newData;
        console.log('[DetailCustomer] Polling data changed:', updatedNotif);
        
        if (updatedNotif?.staff_work_status) {
          const hasChanges = JSON.stringify(staffWorkStatus) !== JSON.stringify(updatedNotif.staff_work_status);
          if (hasChanges) {
            setStaffWorkStatus(updatedNotif.staff_work_status);
            setLatestNotification(updatedNotif);
            toast.info('🔄 เภสัชกรได้ส่งข้อมูลอัพเดต');
          }
        }
      },
      onError: (error) => {
        console.error('Error in smart polling for notifications:', error);
        // Don't show toast on every error to avoid spam
      }
    }
  );

  // Force refresh เมื่อ window ได้ focus (user switch tab กลับมา)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && customerDocumentId && assignedByStaff?.documentId) {
        // Reset interval เพื่อ poll ทันที
        resetNotificationPoll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [customerDocumentId, assignedByStaff?.documentId, resetNotificationPoll]);

  // Listen for staff status update events from staff detail page
  useEffect(() => {
    const handleStaffStatusUpdate = (event) => {
      const { customerDocumentId: updatedCustomerId, staffStatus } = event.detail;
      
      // Only update if this is the same customer
      if (updatedCustomerId === customerDocumentId && staffStatus) {
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
          const { staffStatus } = JSON.parse(event.newValue);
          if (staffStatus) {
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
  }, [customerDocumentId]);

  const handleEdit = () => {
    navigate(`/form_customer?documentId=${customerDocumentId}&pharmacyId=${pharmacy?.documentId || pharmacyId}`);
  };

  const handleBack = () => {
    if (pharmacy?.documentId || pharmacyId) {
      navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/followup-customers`);
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
    if (!appointmentDate) {
      toast.error('กรุณาเลือกวันนัดติดตามอาการ');
      return;
    }
    try {
      const token = localStorage.getItem('jwt');
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
      toast.success('บันทึกวันนัดติดตามอาการสำเร็จ');
      setIsAppointmentModalOpen(false);
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

  const handleDeleteAppointment = async () => {
    try {
      const token = localStorage.getItem('jwt');
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
    if (customer?.assigned_by_staff && customer.assigned_by_staff.documentId) {
      setAssignedByStaff(customer.assigned_by_staff);
    } else {
      setAssignedByStaff(null);
    }
  }, [customer]);

  const handleSaveAddDrug = async () => {
    try {
      const token = localStorage.getItem('jwt');
      
      // แปลงข้อมูลให้เป็นรูปแบบ array ของ object ที่มี drugId และ quantity
      const prescribedDrugs = addDrugModal.selectedDrugs.map(item => {
        if (typeof item === 'string') {
          return { drugId: item, quantity: drugQuantities[item] || 1 };
        }
        return { drugId: item.drugId, quantity: drugQuantities[item.drugId] || item.quantity || 1 };
      });
      
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
      toast.success('บันทึกยาสำเร็จ');
      setAddDrugModal(prev => ({ ...prev, open: false }));
      setDrugQuantities({});
      
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
      
      // reload notification ด้วยเพื่อให้ staff work status ทำงานต่อ
      if (customer?.assigned_by_staff?.documentId) {
        try {
          const notifRes = await fetch(
            API.notifications.list(`filters[staff_profile][documentId][$eq]=${customer.assigned_by_staff.documentId}&filters[customer_profile][documentId][$eq]=${customerDocumentId}&sort=createdAt:desc&pagination[limit]=1`),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );
          if (notifRes.ok) {
            const notifData = await notifRes.json();
            if (notifData.data?.length > 0) {
              setLatestNotification(notifData.data[0]);
              // รีเซ็ต polling interval เพื่อให้ค้นหาข้อมูลใหม่
              resetNotificationPoll();
            }
          }
        } catch (err) {
          console.warn('Could not reload notification:', err);
        }
      }
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
    setEditSymptomModal({
      open: true,
      main: customer.Customers_symptoms || '',
      history: customer.symptom_history || '',
      note: customer.symptom_note || ''
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
    try {
      const token = localStorage.getItem('jwt');
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

  // ฟังก์ชันลบอาการ
  const handleDeleteSymptom = async () => {
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
    // If we already have a previous notification for this customer/staff, send update directly
    if (latestNotification && latestNotification.id) {
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
      
      // เตรียมข้อมูลสำหรับ notification
      const safeNotificationData = {
        data: {
          // Relations - ใช้ชื่อ field ตามใน schema.json
          staff_profile: targetStaffId, // staff-profile documentId
          pharmacy_profile: pharmacyProfileId, // pharmacy-profile documentId (ถ้าไม่มีจะเป็น null)
          customer_profile: customerDocumentId, // customer-profile documentId
          drug_store: pharmacyId, // drug-store documentId
          
          // Basic fields
          // Use distinct types: initial assignment vs update (backend enum now includes 'customer_assignment_update')
          type: isUpdate ? 'customer_assignment_update' : 'customer_assignment',
          title: isUpdate ? 'อัพเดตข้อมูลผู้ป่วย' : 'ได้รับมอบหมายข้อมูลผู้ป่วย',
          message: `${isUpdate ? 'ได้รับอัพเดต' : 'ได้รับมอบหมายดูแล'}ผู้ป่วย: ${user?.full_name || 'ผู้ป่วย'}\nอาการ: ${customer.Customers_symptoms || 'ไม่ระบุ'}\n${staffAssignModal.assignNote ? `หมายเหตุ: ${staffAssignModal.assignNote}` : ''}`,
          
          // Additional data in JSON
          data: {
            customer_name: user?.full_name || '',
            customer_phone: user?.phone || '',
            symptoms: customer.Customers_symptoms || '',
            prescribed_drugs: (customer.prescribed_drugs || []).map(drug => typeof drug === 'string' ? drug : drug.drugId || drug),
            assigned_at: isUpdate ? new Date().toISOString() : undefined,
            updated_at: isUpdate ? new Date().toISOString() : undefined,
            note: staffAssignModal.assignNote || '',
            allergy: customer.Allergic_drugs || '',
            disease: customer.congenital_disease || ''
          },
          
          // Initialize staff_work_status.
          // For normal assignments create fresh defaults. For updates, reset all statuses
          // except keep any `outOfStock` entries reported by staff.
          staff_work_status: (function() {
            const existingOOS = Array.isArray(staffWorkStatus?.outOfStock) ? [...new Set([...staffWorkStatus.outOfStock])] : [];
            if (!isUpdate) {
              return {
                received: false,
                prepared: false,
                received_at: null,
                prepared_at: null,
                prepared_note: '',
                outOfStock: existingOOS
              };
            }
            // For updates: reset actionable flags but preserve outOfStock
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
      console.log('isUpdate:', isUpdate, 'latestNotification?.id:', latestNotification?.id);

      // ถ้าเป็นการอัพเดต ให้อัพเดต notification เดิม ไม่ใช่สร้างใหม่
      const notificationEndpoint = isUpdate && latestNotification?.id
        ? API.notifications.updateByDocumentId(latestNotification.documentId)
        : API.notifications.create();
      
      const notificationMethod = isUpdate && latestNotification?.id ? 'PUT' : 'POST';

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
                return JSON.stringify(safeNotificationData);
              } catch (e) {
                console.error('Error serializing notification data:', e);
                // Return a safe fallback
                return JSON.stringify({
                  data: {
                    type: isUpdate ? 'customer_assignment_update' : 'customer_assignment',
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
        console.log('Notification ' + (isUpdate ? 'updated' : 'created') + ':', result);
        console.log('✅ Success - documentId:', result.data?.documentId);
        console.log('✅ Type:', result.data?.type);
      } else {
        const errorData = await notificationRes.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || notificationRes.statusText;
        console.error('❌ Notification ' + (isUpdate ? 'update' : 'create') + ' failed:', {
          status: notificationRes.status,
          method: notificationMethod,
          endpoint: notificationEndpoint,
          error: errorMsg
        });
        toast.error('❌ ส่งข้อมูล' + (isUpdate ? 'อัพเดต' : '') + 'ไม่สำเร็จ: ' + errorMsg);
        return;
      }

      // ใช้ result ที่ได้มาแล้ว ไม่ต้อง read json อีกครั้ง
      console.log('Processing notification result...');
      
          // Also update customer profile with assigned_by_staff (only on first assign)
      if (!isUpdate) {
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

      toast.success(isUpdate ? '✅ ส่งข้อมูลอัพเดตให้พนักงานสำเร็จ' : '✅ ส่งข้อมูลให้พนักงานสำเร็จ');
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
      <div className="staff-cust-detail-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="staff-cust-detail-main">
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
      <div className="staff-cust-detail-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="staff-cust-detail-main">
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

  return (
    <div className="staff-cust-detail-page">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} pharmacistName={getPharmacistName(pharmacy)} />
      
      <main className="staff-cust-detail-main">
        {/* Modern Header Section */}
        <div className="modern-detail-header">
          <div className="header-backdrop" />
          <div className="header-content">
            <div className="header-left">
              <div className="header-avatar">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div className="header-info">
                <h1 className="header-name">{user?.full_name || 'ไม่พบชื่อ'}</h1>
                <p className="header-phone">📞 {user?.phone || 'ไม่ระบุเบอร์'}</p>
                {customer?.Follow_up_appointment_date && (
                  <p className="header-appointment">
                    <span className="appointment-icon">📅</span>
                    นัดครั้งถัดไป: {formatThaiDate(customer.Follow_up_appointment_date)}
                  </p>
                )}
                {assignedByStaff && assignedByStaff.documentId && (
                  <p className="header-assigned">
                    <span className="assigned-icon">👤</span>
                    จัดส่งโดย: {assignedByStaff.users_permissions_user?.full_name || 'ไม่ระบุชื่อ'}
                  </p>
                )}
              </div>
            </div>
            <div className="header-right">
              <div className="header-actions" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button
                  onClick={() => navigate(`/drug_store_pharmacy/${pharmacy?.documentId}/customer/${customerDocumentId}/history?pharmacyId=${pharmacy?.documentId}`)}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #1890ff, #0050b3)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(24, 144, 255, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.3)';
                  }}
                  title="ดูประวัติการมาใช้บริการทั้งหมดของลูกค้าคนนี้"
                >
                  📋 ดูประวัติการมา
                </button>
              </div>
              <div className="header-stats">
                <div className="stat-item">
                  <span className="stat-label">รายการยา</span>
                  <span className="stat-value">{customer?.prescribed_drugs?.length || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">สถานะ</span>
                  <span className={`stat-badge ${assignedByStaff ? 'assigned' : 'pending'}`}>
                    {assignedByStaff ? '✓ จัดส่งแล้ว' : 'รอดำเนินการ'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Work Status Panel */}
        {assignedByStaff && assignedByStaff.documentId && latestNotification && latestNotification.id ? (
          <div className="staff-work-status-panel">
            <div className="status-panel-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <h3>📊 สถานะการดำเนินการ</h3>
                  <span className="status-panel-subtitle">ของ {assignedByStaff.users_permissions_user?.full_name || assignedByStaff.documentId || 'พนักงาน'}</span>
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
                  style={{
                    background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🔄 รีเฟรซ
                </button>
              </div>
            </div>
            
            <div className="status-buttons-group">
              <button
                className={`status-btn ${staffWorkStatus.received ? 'completed' : 'pending'}`}
                disabled={true}
                title="รอพนักงานอัปเดตสถานะ"
              >
                <span className="status-icon">{staffWorkStatus.received ? '✅' : '📥'}</span>
                <span className="status-text">ได้รับข้อมูล</span>
                {staffWorkStatus.received_at && (
                  <span className="status-time">{formatThaiDate(staffWorkStatus.received_at)}</span>
                )}
              </button>
              
              <button
                className={`status-btn ${staffWorkStatus.prepared && !staffWorkStatus.cancelled ? 'completed' : staffWorkStatus.received ? 'pending' : 'disabled'}`}
                disabled={true}
                title={staffWorkStatus.cancelled ? 'พนักงานยกเลิกการจัดส่ง - รอจัดส่งใหม่' : 'รอพนักงานอัปเดตสถานะ'}
              >
                <span className="status-icon">{staffWorkStatus.prepared && !staffWorkStatus.cancelled ? '✅' : '📦'}</span>
                <span className="status-text">จัดยาส่งแล้ว</span>
                {staffWorkStatus.prepared_at && !staffWorkStatus.cancelled && (
                  <span className="status-time">{formatThaiDate(staffWorkStatus.prepared_at)}</span>
                )}
              </button>

              {staffWorkStatus.cancelled && (
                <button
                  className={`status-btn cancelled`}
                  disabled={true}
                  title="ยกเลิกการจัดส่งแล้ว"
                >
                  <span className="status-icon">⏮️</span>
                  <span className="status-text">ยกเลิกการจัดส่ง</span>
                  {staffWorkStatus.cancelled_at && (
                    <span className="status-time">{formatThaiDate(staffWorkStatus.cancelled_at)}</span>
                  )}
                </button>
              )}
              
              <button
                className={`status-btn ${staffWorkStatus.outOfStock.length > 0 ? 'warning' : 'pending'}`}
                disabled={staffWorkStatus.outOfStock.length === 0}
                title={staffWorkStatus.outOfStock.length > 0 ? 'คลิกเพื่อดูรายชื่อยาที่หมด' : 'ยังไม่มีข้อมูลยาหมดสต็อก'}
                onClick={() => {
                  if (staffWorkStatus.outOfStock.length > 0) {
                    // แปลง drugIds เป็น drug objects
                    const outOfStockDrugs = staffWorkStatus.outOfStock.map(drugId => {
                      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                      return drug ? drug : { documentId: drugId, name_th: 'ไม่พบข้อมูลยา', name_en: '-' };
                    });
                    // Update modal and also update tab view
                    setOutOfStockModal({ open: true, drugs: outOfStockDrugs });
                    setOutOfStockIds(Array.isArray(staffWorkStatus.outOfStock) ? staffWorkStatus.outOfStock : []);
                  }
                }}
              >
                <span className="status-icon">🚨</span>
                <span className="status-text">ยาหมดสต็อก</span>
                {staffWorkStatus.outOfStock.length > 0 && (
                  <span className="status-count">{staffWorkStatus.outOfStock.length} รายการ</span>
                )}
              </button>
            </div>

            {staffWorkStatus.prepared_note && (
              <div className="status-note">
                <span className="note-icon">📝</span>
                <span className="note-text">{staffWorkStatus.prepared_note}</span>
              </div>
            )}

            {staffWorkStatus.cancelled_note && (
              <div className="status-note" style={{ background: '#fff7e6', borderLeft: '4px solid #ffc53d' }}>
                <span className="note-icon">⏮️</span>
                <span className="note-text" style={{ color: '#ad6800' }}>การยกเลิก: {staffWorkStatus.cancelled_note}</span>
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
          className="staff-cust-detail-tabs responsive"
        >
          <Tabs.TabPane tab={<span>ข้อมูลพื้นฐาน</span>} key="1">
            <div className="staff-cust-info-form responsive">
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
                        style={{
                          display: 'inline-block',
                          padding: '8px 16px',
                          background: customer.Allergic_drugs ? '#ff7875' : '#f5f5f5',
                          color: customer.Allergic_drugs ? 'white' : '#666',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: customer.Allergic_drugs ? 'pointer' : 'not-allowed',
                          fontSize: '13px',
                          fontWeight: '500',
                          transition: 'all 0.3s ease',
                          boxShadow: customer.Allergic_drugs ? '0 2px 8px rgba(255, 120, 117, 0.3)' : 'none'
                        }}
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
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="edit-btn-allergy" onClick={() => openEditMedicalModal('allergy')}>✏️ แก้ไข</button>
                          {customer.Allergic_drugs && (
                            <button 
                              className="edit-btn-allergy delete" 
                              onClick={handleClearAllergy}
                              style={{
                                background: '#ff4d4f',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}
                            >
                              🗑️ ลบ
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="info-row">
                      <label>โรคประจำตัว:</label>
                      <span>{customer.congenital_disease || 'ไม่มีข้อมูล'}</span>
                      {userRole === 'pharmacy' && (
                        <button className="edit-btn-small" onClick={() => openEditMedicalModal('disease')}>แก้ไข</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span>อาการและการติดตาม <span className="tab-badge">{customer.Follow_up_appointment_date ? 'มีนัด' : 'ไม่มีนัด'}</span></span>} key="2">
            <div className="symptoms-followup-panel responsive">
              {/* อาการปัจจุบัน */}
              <div className="symptom-section">
                <div className="symptom-section-header">
                  <h3 className="section-title">🩺 อาการปัจจุบัน</h3>
                  {userRole === 'pharmacy' && (
                    <div className="symptom-action-buttons">
                      {(customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) ? (
                        <>
                          <button className="btn-symptom-edit" onClick={openEditSymptomModal}>
                            ✏️ แก้ไข
                          </button>
                          <button className="btn-symptom-delete" onClick={() => {
                            showConfirmation({
                              title: '🗑️ ยืนยันการลบอาการ',
                              message: 'คุณต้องการลบข้อมูลอาการทั้งหมดใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
                              onConfirm: handleDeleteSymptom,
                              confirmText: 'ลบข้อมูล',
                              type: 'danger'
                            });
                          }}>
                            🗑️ ลบ
                          </button>
                        </>
                      ) : (
                        <button className="btn-symptom-add" onClick={openAddSymptomModal}>
                          ➕ เพิ่มอาการ
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="symptom-card">
                  {(customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) ? (
                    <>
                      <div className="symptom-main">
                        <label>อาการหลัก:</label>
                        <div className="symptom-display">
                          {customer.Customers_symptoms || '-'}
                        </div>
                      </div>
                      {customer.symptom_history && (
                        <div className="symptom-history">
                          <label>ประวัติการเจ็บป่วย:</label>
                          <div className="symptom-display">{customer.symptom_history}</div>
                        </div>
                      )}
                      {customer.symptom_note && (
                        <div className="symptom-note">
                          <label>หมายเหตุ:</label>
                          <div className="symptom-display">{customer.symptom_note}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="symptom-empty">
                      <div className="symptom-empty-icon">📝</div>
                      <h4>ยังไม่มีข้อมูลอาการ</h4>
                      <p>คลิกปุ่ม "เพิ่มอาการ" เพื่อเริ่มบันทึกข้อมูลอาการของผู้ป่วย</p>
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
                    <div className="appointment-actions">
                      <button className="btn-set-appointment" onClick={handleOpenAppointmentModal}>
                        {customer.Follow_up_appointment_date ? '⚡ แก้ไขวันนัด' : '📅 กำหนดวันนัด'}
                      </button>
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
                            <div>
                              {allergies.map((allergy, idx) => (
                                <div key={idx}>
                                  <p style={{ margin: '4px 0', fontWeight: 'bold' }}>💊 {allergy.drug || 'ไม่ระบุชื่อยา'}</p>
                                  {allergy.symptoms && <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>🩺 อาการ: {allergy.symptoms}</p>}
                                  {allergy.date && <p style={{ margin: '4px 0', fontSize: '12px', color: '#999' }}>📅 {formatThaiDate(allergy.date)}</p>}
                                </div>
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
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span>ยาและการดำเนินการ <span className="tab-badge">{customer?.prescribed_drugs?.length || 0}</span></span>} key="3">
            <div className="staff-cust-actions-panel responsive">
              {/* แสดงรายการยาที่กำหนดแล้วในรูปแบบ Card Layout */}
              {customer.prescribed_drugs && customer.prescribed_drugs.length > 0 ? (
                <div className="pharm-prescribed-drugs-container">
                  <div className="pharm-prescribed-drugs-toolbar">
                    <h2>รายการยาที่ต้องใช้</h2>
                    <button 
                      className="btn-add" 
                      onClick={staffWorkStatus.prepared ? undefined : handleOpenAddDrugModal}
                      disabled={staffWorkStatus.prepared}
                      title={staffWorkStatus.prepared ? 'พนักงานจัดยาแล้ว — ไม่สามารถเพิ่มยาใหม่ได้' : 'เพิ่มยา'}
                    >
                      เพิ่มยา
                    </button>
                  </div>

                  {/* Grid Layout สำหรับยา */}
                  <div className="prescribed-drugs-grid">
                    {customer.prescribed_drugs.map((drugItem, index) => {
                      // รองรับทั้งรูปแบบเก่า (string) และใหม่ (object)
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
                        className="pharm-prescribed-drug-card-individual"
                        style={{
                          opacity: isOutOfStock ? 0.85 : 1,
                          background: isOutOfStock ? '#fff7f6' : undefined,
                          border: isOutOfStock ? '1px dashed #ff4d4f' : undefined,
                          borderLeft: isOutOfStock ? '4px solid #ff4d4f' : undefined
                        }}
                      >
                        {/* Quantity Badge */}
                        <div className="pharm-prescribed-drug-quantity-badge">
                          จำนวน {quantity}
                        </div>

                        {/* Drug Icon และ Badge */}
                        <div className="prescribed-drug-header">
                          <div className="prescribed-drug-icon">
                            Rx
                          </div>
                          <div className="prescribed-drug-info">
                            <h4 className="prescribed-drug-name">
                              {drug ? drug.name_th : 'กำลังโหลด...'}
                            </h4>
                            {isOutOfStock && (
                              <div style={{ marginTop: '6px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  background: '#ff4d4f',
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}>หมดสต็อก</span>
                              </div>
                            )}
                            <p className="prescribed-drug-name-en">
                              {drug ? drug.name_en : '-'}
                            </p>
                            {drug && drug.manufacturer && (
                              <div className="prescribed-drug-manufacturer" style={{ fontSize: '12px', color: '#0050b3', fontWeight: '500', marginTop: '4px' }}>
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

                        {/* Additional Info - Batch Details */}
                        {drug && drug.drug_batches && drug.drug_batches.length > 0 && (
                          <div className="prescribed-drug-meta">
                            <details style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                              <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#0050b3' }}>
                                🏷️ Lots ({drug.drug_batches.length})
                              </summary>
                              <div style={{ marginTop: '8px', marginLeft: '16px' }}>
                                {drug.drug_batches.map((batch, idx) => (
                                  <div key={batch.documentId || idx} style={{ marginBottom: '6px', padding: '6px', background: 'white', borderRadius: '3px', fontSize: '12px' }}>
                                    <div>Lot: <strong>{batch.lot_number}</strong></div>
                                    <div>สต็อก: <strong>{batch.quantity}</strong></div>
                                    {batch.date_produced && <div>วันผลิต: {batch.date_produced}</div>}
                                    {batch.expiry_date && <div>หมดอายุ: <span style={{ color: '#ff4d4f', fontWeight: '600' }}>{batch.expiry_date}</span></div>}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="prescribed-drug-actions">
                          <button
                            onClick={async () => {
                              // ลบยาออกจากรายการ
                              const newDrugs = customer.prescribed_drugs.filter(item => {
                                const itemDrugId = typeof item === 'string' ? item : item.drugId;
                                return itemDrugId !== drugId;
                              });
                              
                              // อัปเดตข้อมูลในเซิร์ฟเวอร์
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
                            }}
                            disabled={staffWorkStatus.prepared}
                            title={staffWorkStatus.prepared ? 'ไม่สามารถลบยา — พนักงานจัดส่งแล้ว' : 'ลบยา'}
                            style={{
                              background: staffWorkStatus.prepared ? '#d9d9d9' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                              color: staffWorkStatus.prepared ? '#999' : 'white',
                              border: 'none',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: staffWorkStatus.prepared ? 'not-allowed' : 'pointer',
                              fontWeight: 'bold',
                              transition: 'all 0.3s ease',
                              opacity: staffWorkStatus.prepared ? 0.6 : 1
                            }}
                            onMouseEnter={e => {
                              if (!staffWorkStatus.prepared) {
                                e.target.style.transform = 'scale(1.05)';
                              }
                            }}
                            onMouseLeave={e => {
                              e.target.style.transform = 'scale(1)';
                            }}
                          >
                            🗑️ ลบ
                          </button>
                            {isOutOfStock ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Open add-drug modal and pre-select this drug so pharmacist can change it
                                  setAddDrugModal(prev => ({
                                    ...prev,
                                    open: true,
                                    selectedDrugs: [{ drugId: drugId, quantity }],
                                    filterBy: 'selected'
                                  }));
                                  setDrugQuantities(prev => ({ ...prev, [drugId]: quantity }));
                                  setActiveTab('2');
                                }}
                                style={{
                                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                  color: 'white',
                                  border: 'none',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={e => { e.target.style.transform = 'scale(1.05)'; }}
                                onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
                              >
                                เปลี่ยนยา
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDrugDetailModal({ open: true, drug });
                                }}
                                style={{
                                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                  color: 'white',
                                  border: 'none',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={e => { e.target.style.transform = 'scale(1.05)'; }}
                                onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
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
              <div className="pharm-prescribed-drugs-container">
                <div className="pharm-prescribed-drugs-toolbar">
                  <h2>รายการยาที่ต้องใช้</h2>
                  <button 
                    className="btn-add" 
                    onClick={staffWorkStatus.prepared ? undefined : handleOpenAddDrugModal}
                    disabled={staffWorkStatus.prepared}
                    title={staffWorkStatus.prepared ? 'พนักงานจัดยาแล้ว — ไม่สามารถเพิ่มยาใหม่ได้' : 'เพิ่มยา'}
                  >
                    เพิ่มยา
                  </button>
                </div>
                <div className="no-drugs-placeholder">
                  <div className="no-drugs-placeholder-icon">💊</div>
                  <h3>
                    ยังไม่มีรายการยาที่กำหนด
                  </h3>
                  <p>
                    คลิกปุ่ม "เพิ่มยา" เพื่อเริ่มเลือกยาสำหรับผู้ป่วย
                  </p>
                </div>
              </div>
            )}
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span>ดำเนินการ</span>} key="4">
            <div className="staff-cust-actions-panel responsive">
              <div className="actions-grid responsive">
                <button 
                  className="action-btn green responsive"
                  onClick={() => navigate(`/print_allergy_card/${customerDocumentId}?pharmacyId=${pharmacy?.documentId || pharmacyId}`)}
                >
                  <span>พิมพ์บัตรแพ้ยา</span>
                </button>

                <button className="action-btn green responsive" onClick={handleOpenAppointmentModal}>
                  <span>{customer.Follow_up_appointment_date ? 'แก้ไขวันนัดติดตามอาการ' : 'เพิ่มวันนัดติดตามอาการ'}</span>
                </button>

                <button 
                  className="action-btn green responsive" 
                  onClick={handleOpenStaffAssignModal}
                  disabled={staffWorkStatus.prepared}
                  title={staffWorkStatus.prepared ? 'ไม่สามารถส่งอัพเดต — พนักงานจัดส่งแล้ว' : 'ส่งข้อมูลให้พนักงาน'}
                  style={{
                    opacity: staffWorkStatus.prepared ? 0.5 : 1,
                    cursor: staffWorkStatus.prepared ? 'not-allowed' : 'pointer'
                  }}
                >
                  <span>{latestNotification && latestNotification.id ? 'ส่งข้อมูลอัพเดต' : 'ส่งข้อมูลให้พนักงาน'}</span>
                </button>

                <button 
                  className="action-btn green responsive" 
                  onClick={() => navigate(`/print_transfer_form/${customerDocumentId}?pharmacyId=${pharmacy?.documentId || pharmacyId}`)}
                >
                  <span>ใบส่งต่อร้านยา</span>
                </button>

                <button className="action-btn green responsive" onClick={handleEdit}>
                  <span>แก้ไข</span>
                </button>

                <button className="action-btn green responsive" onClick={handleBack}>
                  <span>กลับ</span>
                </button>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </main>

      <Footer />

      {/* Modal สำหรับเพิ่ม/แก้ไขวันนัดติดตามอาการ */}
      <Modal
        title={customer?.Follow_up_appointment_date ? 'แก้ไขวันนัดติดตามอาการ' : 'เพิ่มวันนัดติดตามอาการ'}
        open={isAppointmentModalOpen}
        onOk={handleSaveAppointment}
        onCancel={() => setIsAppointmentModalOpen(false)}
        okText="บันทึก"
        cancelText="ยกเลิก"
        centered
        className="modal-appointment"
        footer={[
          <button
            key="delete"
            className="btn-appointment-delete"
            style={{
              display: customer?.Follow_up_appointment_date ? 'inline-block' : 'none'
            }}
            onClick={handleDeleteAppointment}
          >
            ลบวันนัด
          </button>,
          <button
            key="cancel"
            className="btn-appointment-cancel"
            onClick={() => setIsAppointmentModalOpen(false)}
          >
            ยกเลิก
          </button>,
          <button
            key="ok"
            className="btn-appointment-ok"
            onClick={handleSaveAppointment}
          >
            บันทึก
          </button>
        ]}
      >
        <div className="modal-appointment-header">
          <div className="modal-appointment-title">
            <span role="img" aria-label="calendar">📅</span>
            {customer?.Follow_up_appointment_date ? 'เลือกวันใหม่' : 'เลือกวันนัด'}
          </div>
          <div className="modal-appointment-desc">
            กรุณาเลือกวันที่ต้องการนัดติดตามอาการของลูกค้า
          </div>
        </div>
        <DatePicker
          value={appointmentDate ? dayjs(appointmentDate) : null}
          onChange={date => setAppointmentDate(date ? date.format('YYYY-MM-DD') : null)}
          className="modal-appointment-datepicker"
          placeholder="เลือกวันนัดติดตามอาการ"
          format="YYYY-MM-DD"
          size="large"
        />
        {appointmentDate && (
          <div className="modal-appointment-selected">
            วันที่เลือก: {formatThaiDate(appointmentDate)}
          </div>
        )}
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
            style={{
              padding: '8px 24px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={e => {
              e.target.style.backgroundColor = '#e6e6e6';
              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={e => {
              e.target.style.backgroundColor = '#f5f5f5';
              e.target.style.boxShadow = 'none';
            }}
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
                style={{
                  background: 'linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%)',
                  border: '1px solid #ffb3b3',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 4px 12px rgba(255, 120, 117, 0.15)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 120, 117, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 120, 117, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
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

      {/* Modal สำหรับดูรายละเอียดข้อมูลทางการแพทย์ */}
      <Modal
        title={
          <div className="modal-medical-title">
            <span role="img" aria-label="icon">{medicalModal.icon}</span>{medicalModal.title}
          </div>
        }
        open={medicalModal.open}
        onCancel={() => setMedicalModal({ ...medicalModal, open: false })}
        footer={null}
        centered
        className="modal-medical"
      >
        {medicalModal.title === 'อาการ' && medicalModal.extra ? (
          <div className="modal-medical-symptom">
            <div className="modal-medical-symptom-section">
              <div className="modal-medical-symptom-label main">
                <span role="img" aria-label="main">🩺</span> อาการนำ
              </div>
              <div className="modal-medical-symptom-value main">{medicalModal.extra.main}</div>
            </div>
            <div className="modal-medical-symptom-section">
              <div className="modal-medical-symptom-label history">
                <span role="img" aria-label="history">📖</span> ประวัติการเจ็บป่วย
              </div>
              <div className="modal-medical-symptom-value history">{medicalModal.extra.history}</div>
            </div>
            <div className="modal-medical-symptom-section">
              <div className="modal-medical-symptom-label note">
                <span role="img" aria-label="note">📝</span> รายละเอียดเพิ่มเติม
              </div>
              <div className="modal-medical-symptom-value note">{medicalModal.extra.note}</div>
            </div>
          </div>
        ) : (
          <div className="modal-medical-content">
            <div className="modal-medical-desc">
              ข้อมูล{medicalModal.title}ของลูกค้า
            </div>
            <div className="modal-medical-value">
              {medicalModal.value}
            </div>
          </div>
        )}
        <button
          className="btn-medical-close"
          onClick={() => setMedicalModal({ ...medicalModal, open: false })}
        >
          ปิด
        </button>
      </Modal>

      {/* Modal สำหรับแก้ไขยาที่แพ้ (Allergy) - รองรับหลายรายการ */}
      <Modal
        title={
          <div className="modal-editmedical-title">
            <span role="img" aria-label="warning">⚠️</span>แก้ไขยาที่แพ้ ({allergyModal.allergies.length} รายการ)
          </div>
        }
        open={allergyModal.open}
        onCancel={() => setAllergyModal({ open: false, allergies: [], availableDrugs: [] })}
        footer={[
          customer?.Allergic_drugs ? (
            <button
              key="clear"
              onClick={handleClearAllergy}
              style={{
                background: '#ff4d4f',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                marginRight: '8px'
              }}
            >
              🗑️ ลบข้อมูลทั้งหมด
            </button>
          ) : null,
          <button
            key="cancel"
            onClick={() => setAllergyModal({ open: false, allergies: [], availableDrugs: [] })}
            style={{
              background: '#f5f5f5',
              border: '1px solid #d9d9d9',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ยกเลิก
          </button>,
          <button
            key="ok"
            onClick={handleSaveAllergy}
            style={{
              background: '#1890ff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              marginLeft: '8px'
            }}
          >
            บันทึก
          </button>
        ]}
        centered
        className="modal-allergy"
        width={700}
      >
        <div className="modal-allergy-content" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* ปุ่มเพิ่มรายการแพ้ใหม่ */}
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => {
                setAllergyModal(prev => ({
                  ...prev,
                  allergies: [...prev.allergies, { drug: '', symptoms: '', date: '' }]
                }));
              }}
              style={{
                background: '#1890ff',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              + เพิ่มรายการแพ้ใหม่
            </button>
          </div>

          {/* รายการแพ้แต่ละตัว */}
          {allergyModal.allergies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              ยังไม่มีรายการแพ้ ให้คลิก "เพิ่มรายการแพ้ใหม่" เพื่อเริ่มเพิ่มข้อมูล
            </div>
          ) : (
            allergyModal.allergies.map((allergy, idx) => (
              <div
                key={idx}
                style={{
                  border: '2px solid #f0f0f0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '12px',
                  background: '#fafafa'
                }}
              >
                {/* ลำดับและปุ่มลบ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: '#1890ff' }}>รายการที่ {idx + 1}</span>
                  <button
                    onClick={() => {
                      setAllergyModal(prev => ({
                        ...prev,
                        allergies: prev.allergies.filter((_, i) => i !== idx)
                      }));
                    }}
                    style={{
                      background: '#ff4d4f',
                      color: 'white',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ลบ
                  </button>
                </div>

                {/* ส่วนที่ 1: ตัวยา */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                    💊 ตัวยา
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
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
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #d9d9d9',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- เลือกยาจากร้าน --</option>
                      {allergyModal.availableDrugs.map(drug => (
                        <option key={drug.documentId} value={drug.documentId}>
                          {drug.name_th} ({drug.name_en})
                        </option>
                      ))}
                    </select>
                  </div>
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
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #d9d9d9',
                      fontSize: '13px',
                      marginTop: '4px'
                    }}
                  />
                </div>

                {/* ส่วนที่ 2: อาการที่เกิดขึ้น */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                    🩺 อาการที่เกิดขึ้น
                  </label>
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
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #d9d9d9',
                      fontSize: '13px',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* ส่วนที่ 3: วันที่เข้ามาแจ้งอาการ */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                    📅 วันที่เข้ามาแจ้งอาการ
                  </label>
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
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}
                    placeholder="เลือกวันที่"
                    format="YYYY-MM-DD"
                  />
                  {allergy.date && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                      วันที่เลือก: {formatThaiDate(allergy.date)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Modal สำหรับแก้ไขข้อมูลทางการแพทย์ (pharmacy) */}
      <Modal
        title={
          <div className="modal-editmedical-title">
            <span role="img" aria-label="edit">✏️</span>แก้ไข{editMedicalModal.label}
          </div>
        }
        open={editMedicalModal.open}
        onCancel={() => setEditMedicalModal({ ...editMedicalModal, open: false })}
        onOk={handleSaveEditMedical}
        okText="บันทึก"
        cancelText="ยกเลิก"
        centered
        className="modal-editmedical"
      >
        <div className="modal-editmedical-content">
          <div className="modal-editmedical-desc">
            กรุณากรอกข้อมูล{editMedicalModal.label}ใหม่
          </div>
          <textarea
            value={editMedicalModal.value}
            onChange={e => setEditMedicalModal({ ...editMedicalModal, value: e.target.value })}
            rows={4}
            className="modal-editmedical-textarea"
            placeholder={`ระบุ${editMedicalModal.label}`}
          />
        </div>
      </Modal>

      {/* Modal สำหรับแก้ไขอาการ */}
      <Modal
        title={
          <div className="modal-editmedical-title">
            <span role="img" aria-label="edit">✏️</span>{editSymptomModal.main === '' && editSymptomModal.history === '' && editSymptomModal.note === '' ? 'เพิ่มอาการ' : 'แก้ไขอาการ'}
          </div>
        }
        open={editSymptomModal.open}
        onCancel={() => setEditSymptomModal({ ...editSymptomModal, open: false })}
        onOk={handleSaveEditSymptom}
        okText="บันทึก"
        cancelText="ยกเลิก"
        centered
        className="modal-editmedical"
        footer={[
          (customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) && (
            <button
              key="delete"
              className="btn-symptom-delete-modal"
              onClick={() => {
                showConfirmation({
                  title: '🗑️ ยืนยันการลบอาการ',
                  message: 'คุณต้องการลบข้อมูลอาการทั้งหมดใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
                  onConfirm: handleDeleteSymptom,
                  confirmText: 'ลบข้อมูล',
                  type: 'danger'
                });
              }}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                marginRight: 'auto'
              }}
            >
              🗑️ ลบทั้งหมด
            </button>
          ),
          <button
            key="cancel"
            onClick={() => setEditSymptomModal({ ...editSymptomModal, open: false })}
            style={{
              background: '#f5f5f5',
              color: '#666',
              border: '1px solid #d9d9d9',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            ยกเลิก
          </button>,
          <button
            key="ok"
            onClick={handleSaveEditSymptom}
            style={{
              background: 'linear-gradient(135deg, #52c41a, #73d13d)',
              color: 'white',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            บันทึก
          </button>
        ]}
      >
        <div className="modal-editmedical-content">
          <div className="modal-editmedical-desc">กรุณากรอกข้อมูลอาการ</div>
          <div className="form-group">
            <label>อาการนำ</label>
            <textarea
              value={editSymptomModal.main}
              onChange={e => setEditSymptomModal({ ...editSymptomModal, main: e.target.value })}
              rows={2}
              className="modal-editmedical-textarea"
              placeholder="ระบุอาการนำ"
            />
          </div>
          <div className="form-group">
            <label>ประวัติการเจ็บป่วย</label>
            <textarea
              value={editSymptomModal.history}
              onChange={e => setEditSymptomModal({ ...editSymptomModal, history: e.target.value })}
              rows={3}
              className="modal-editmedical-textarea"
              placeholder="ระบุประวัติการเจ็บป่วย"
            />
          </div>
          <div className="form-group">
            <label>รายละเอียดเพิ่มเติม</label>
            <textarea
              value={editSymptomModal.note}
              onChange={e => setEditSymptomModal({ ...editSymptomModal, note: e.target.value })}
              rows={3}
              className="modal-editmedical-textarea"
              placeholder="ระบุรายละเอียดเพิ่มเติม"
            />
          </div>
        </div>
      </Modal>
      
      {/* Modal สำหรับเพิ่มยา */}
      <Modal
        title={
          <div className="drug-modal-title">
            <span>💊</span>
            <span>เพิ่มรายการยาให้ผู้ป่วย</span>
          </div>
        }
        open={addDrugModal.open}
        onOk={handleSaveAddDrug}
        onCancel={() => {
          setAddDrugModal(prev => ({ ...prev, open: false, filterBy: 'all' }));
          setSearchTerm('');
        }}
        okText="บันทึกรายการยา"
        cancelText="ยกเลิก"
        centered
        width={window.innerWidth <= 768 ? '95%' : window.innerWidth <= 1024 ? '85%' : 800}
        style={{ 
          maxWidth: window.innerWidth <= 768 ? '95vw' : '90vw',
          margin: window.innerWidth <= 768 ? '0 auto' : undefined
        }}
        styles={{ body: {
          maxHeight: window.innerWidth <= 768 ? '70vh' : '600px', 
          overflowY: 'auto',
          padding: window.innerWidth <= 768 ? '15px' : '24px'
        } }}
        okButtonProps={{ 
          disabled: addDrugModal.selectedDrugs.length === 0,
          style: { 
            background: addDrugModal.selectedDrugs.length > 0 ? 'linear-gradient(90deg, #52c41a, #73d13d)' : undefined,
            borderColor: addDrugModal.selectedDrugs.length > 0 ? '#52c41a' : undefined,
            fontSize: window.innerWidth <= 768 ? '14px' : '16px'
          }
        }}
        cancelButtonProps={{
          style: {
            fontSize: window.innerWidth <= 768 ? '14px' : '16px'
          }
        }}
        className="drug-modal"
      >
        <div style={{ padding: window.innerWidth <= 768 ? '5px 0' : '10px 0' }}>
          {/* Header Info */}
          <div className="drug-modal-header">
            <div className="drug-modal-header-content">
              <div className="drug-modal-patient-info">
                <h4>เลือกยาสำหรับ: {user?.full_name}</h4>
                <p>
                  เลือกยาที่มีอยู่ในร้าน {pharmacy?.name_th}
                </p>
              </div>
              <div>
                <div className={`drug-selected-badge ${addDrugModal.selectedDrugs.length > 0 ? '' : 'pending'}`}>
                  ✓ เลือกแล้ว {addDrugModal.selectedDrugs.length} รายการ
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="drug-search-section">
            <div className="drug-search-container">
              <input
                type="text"
                placeholder={window.innerWidth <= 768 ? "ค้นหายา..." : "ค้นหายา (ชื่อไทย, อังกฤษ หรือรายละเอียด)..."}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="drug-search-input"
                style={{ 
                  padding: window.innerWidth <= 768 ? '10px 12px' : '12px 15px', 
                  fontSize: window.innerWidth <= 768 ? '14px' : '14px'
                }}
              />
              <button
                onClick={() => setSearchTerm('')}
                className="drug-search-clear"
                style={{
                  padding: window.innerWidth <= 768 ? '10px 20px' : '12px 15px',
                  fontSize: window.innerWidth <= 768 ? '14px' : '14px',
                  minWidth: window.innerWidth <= 768 ? 'auto' : '60px'
                }}
                disabled={!searchTerm}
              >
                ล้าง
              </button>
            </div>
            
            {/* Filter Buttons */}
            <div className="drug-filter-container">
              {[
                { key: 'all', label: 'ทั้งหมด', count: addDrugModal.availableDrugs.length },
                { key: 'selected', label: 'เลือกแล้ว', count: addDrugModal.selectedDrugs.length },
                { key: 'unselected', label: 'ยังไม่เลือก', count: addDrugModal.availableDrugs.length - addDrugModal.selectedDrugs.length }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setAddDrugModal(prev => ({ ...prev, filterBy: filter.key }))}
                  className={`drug-filter-btn ${addDrugModal.filterBy === filter.key ? 'active' : ''}`}
                  style={{
                    padding: window.innerWidth <= 768 ? '6px 10px' : '8px 12px',
                    fontSize: window.innerWidth <= 768 ? '11px' : '12px',
                    flex: window.innerWidth <= 768 ? '1' : 'none'
                  }}
                >
                  {window.innerWidth <= 768 ? filter.label : `${filter.label} (${filter.count})`}
                </button>
              ))}
            </div>
          </div>

          {/* Drug List */}
          <div className="drug-list-container">
            {addDrugModal.availableDrugs.length === 0 ? (
              <div className="drug-list-empty">
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                <h3>ไม่มียาในร้านนี้</h3>
                <p>กรุณาติดต่อเจ้าหน้าที่เพื่อเพิ่มข้อมูลยา</p>
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
                        const drug = typeof item === 'string' ? item : (item?.drug || '');
                        return String(drug).toLowerCase();
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
                          const drug = typeof item === 'string' ? item : (item?.drug || '');
                          return String(drug).toLowerCase();
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
                          style={{ 
                            border: '2px solid',
                            borderColor: isSelected ? '#52c41a' : '#e8e8e8',
                            padding: '16px', 
                            borderRadius: '12px',
                            background: isSelected ? 'linear-gradient(90deg, #f6ffed, #f0f9ff)' : '#fff',
                            cursor: isAllergic || isOutOfStock ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            boxShadow: isSelected ? '0 4px 12px rgba(82, 196, 26, 0.15)' : '0 2px 8px rgba(0,0,0,0.06)',
                            opacity: isAllergic || isOutOfStock ? 0.55 : 1
                          }}
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
                              // เพิ่มเข้า selectedDrugs
                              setAddDrugModal(prev => ({
                                ...prev,
                                selectedDrugs: [...prev.selectedDrugs, { drugId: drug.documentId, quantity: 1 }]
                              }));
                              // เพิ่มเข้า quantities
                              setDrugQuantities(prev => ({ ...prev, [drug.documentId]: 1 }));
                            }
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.target.style.borderColor = '#1890ff';
                              e.target.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.15)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.target.style.borderColor = '#e8e8e8';
                              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                            }
                          }}
                        >
                          {/* Selection Status */}
                          <div style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: isSelected ? '#52c41a' : '#d9d9d9',
                            color: 'white',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {isSelected ? '✓' : '+'}
                          </div>

                          {/* Drug Info */}
                          <div style={{ paddingRight: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '16px', marginRight: '8px', color: '#1890ff' }}>Rx</span>
                              <h4 style={{ 
                                margin: 0, 
                                color: isSelected ? '#52c41a' : '#1890ff',
                                fontSize: '16px',
                                fontWeight: 'bold'
                              }}>
                                {drug.name_th}
                              </h4>
                                {isAllergic && (
                                  <span style={{
                                    marginLeft: '8px',
                                    background: '#ff4d4f',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                  }}>
                                    แพ้
                                  </span>
                                )}
                            </div>
                            
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ 
                                background: '#f0f0f0', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '12px',
                                color: '#666',
                                marginRight: '8px'
                              }}>
                                {drug.name_en}
                              </span>
                              {drug && drug.manufacturer && (
                                <span style={{ 
                                  background: '#0050b3', 
                                  color: 'white',
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  marginRight: '8px'
                                }}>
                                  📦 {drug.manufacturer}
                                </span>
                              )}
                              <span style={{ 
                                background: isSelected ? '#52c41a' : '#faad14', 
                                color: 'white',
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {drug.price} บาท
                              </span>
                            </div>

                            {drug.description && (
                              <p style={{ 
                                margin: '8px 0 0 0', 
                                color: '#666', 
                                fontSize: '13px',
                                lineHeight: '1.4'
                              }}>
                                {drug.description}
                              </p>
                            )}
                            
                            {/* Additional Info */}
                            <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '11px', color: '#999' }}>
                              {drug.lot_number && <span>Lot: {drug.lot_number}</span>}
                              {drug.expiry_date && <span>หมดอายุ: {drug.expiry_date}</span>}
                            </div>
                            
                            {/* Quantity Input - แสดงเฉพาะเมื่อเลือกยาแล้ว */}
                            {isSelected && (
                              <div style={{ 
                                marginTop: '12px', 
                                padding: '10px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0'
                              }}>
                                <label style={{ 
                                  display: 'block',
                                  marginBottom: '5px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  color: '#374151'
                                }}>
                                  จำนวน:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                    style={{
                                      background: '#f3f4f6',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      width: '30px',
                                      height: '30px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: 'bold'
                                    }}
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
                                    style={{
                                      width: '60px',
                                      padding: '5px 8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      textAlign: 'center',
                                      fontSize: '14px'
                                    }}
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
                                    style={{
                                      background: '#f3f4f6',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      width: '30px',
                                      height: '30px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    +
                                  </button>
                                  <span style={{ 
                                    fontSize: '12px', 
                                    color: '#6b7280',
                                    marginLeft: '8px'
                                  }}>
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
            <div className="drug-summary">
              <h4>สรุปยาที่เลือก ({addDrugModal.selectedDrugs.length} รายการ)</h4>
              <div className="drug-summary-list">
                {addDrugModal.selectedDrugs.map(drugItem => {
                  const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                  const quantity = drugQuantities[drugId] || (typeof drugItem === 'object' ? drugItem.quantity : 1) || 1;
                  const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                  return drug ? (
                    <span key={drugId} className="drug-summary-item">
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
                        className="drug-summary-remove"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        title={
          <div className={`confirm-modal-title ${confirmModal.type}`}>
            {confirmModal.title}
          </div>
        }
        open={confirmModal.open}
        onCancel={closeConfirmModal}
        centered
        className="confirm-modal"
        footer={[
          <button
            key="cancel"
            className="confirm-modal-btn cancel"
            onClick={closeConfirmModal}
          >
            {confirmModal.cancelText}
          </button>,
          <button
            key="confirm"
            className={`confirm-modal-btn confirm ${confirmModal.type}`}
            onClick={handleConfirm}
          >
            {confirmModal.confirmText}
          </button>
        ]}
      >
        <div className="confirm-modal-content">
          <div className={`confirm-modal-icon ${confirmModal.type}`}>
            {confirmModal.type === 'danger' ? '⚠️' : confirmModal.type === 'warning' ? '⚡' : 'ℹ️'}
          </div>
          <p className="confirm-modal-message">{confirmModal.message}</p>
        </div>
      </Modal>

      {/* Staff Assignment Modal */}
      <Modal
        title={
          <div className="staff-assign-modal-title">
            <span>👥</span>
            <span>ส่งข้อมูลผู้ป่วยให้พนักงาน</span>
          </div>
        }
        open={staffAssignModal.open}
        onCancel={() => setStaffAssignModal({ ...staffAssignModal, open: false, selectedStaffId: null, assignNote: '' })}
        onOk={() => handleAssignToStaff(null, false)}
        okText="ส่งข้อมูล"
        cancelText="ยกเลิก"
        centered
        className="staff-assign-modal"
        width={600}
        okButtonProps={{
          disabled: !staffAssignModal.selectedStaffId,
          style: {
            background: staffAssignModal.selectedStaffId ? 'linear-gradient(135deg, #52c41a, #73d13d)' : undefined
          }
        }}
      >
        <div className="staff-assign-modal-content">
          {/* ข้อมูลผู้ป่วย */}
          <div className="staff-assign-patient-info">
            <h4>👤 ข้อมูลผู้ป่วย</h4>
            <div className="patient-info-card">
              <div className="patient-info-row">
                <span className="label">ชื่อ:</span>
                <span className="value">{user?.full_name || '-'}</span>
              </div>
              <div className="patient-info-row">
                <span className="label">เบอร์:</span>
                <span className="value">{user?.phone || '-'}</span>
              </div>
              <div className="patient-info-row">
                <span className="label">อาการ:</span>
                <span className="value">{customer.Customers_symptoms || 'ไม่ระบุ'}</span>
              </div>
            </div>
          </div>

          {/* รายชื่อพนักงาน */}
          <div className="staff-list-section">
            <h4>💼 เลือกพนักงาน</h4>
            {staffAssignModal.loading ? (
              <div className="staff-loading">
                <div className="loading-spinner"></div>
                <p>กำลังโหลดข้อมูลพนักงาน...</p>
              </div>
            ) : staffAssignModal.availableStaff.length === 0 ? (
              <div className="no-staff-available">
                <div className="no-staff-icon">🚨</div>
                <h4>ไม่มีพนักงานออนไลน์</h4>
                <p>ขณะนี้ไม่มีพนักงานที่เข้าสู่ระบบหรือออนไลน์</p>
              </div>
            ) : (
              <div className="staff-list">
                {staffAssignModal.availableStaff.map(staff => {
                  const staffUser = staff.users_permissions_user;
                  const isSelected = staffAssignModal.selectedStaffId === staff.documentId;
                  return (
                    <div
                      key={staff.documentId}
                      className={`staff-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setStaffAssignModal(prev => ({ 
                        ...prev, 
                        selectedStaffId: staff.documentId 
                      }))}
                    >
                      <div className="staff-card-header">
                        <div className="staff-avatar">
                          {staffUser?.full_name?.charAt(0) || 'S'}
                        </div>
                        <div className="staff-info">
                          <h5 className="staff-name">{staffUser?.full_name || 'ไม่ระบุชื่อ'}</h5>
                          <p className="staff-role">พนักงานขายยา</p>
                        </div>
                        <div className="staff-status">
                          <span className="status-badge online">• ออนไลน์</span>
                        </div>
                      </div>
                      {staffUser?.phone && (
                        <div className="staff-contact">
                          <span>📞 {staffUser.phone}</span>
                        </div>
                      )}
                      {isSelected && (
                        <div className="staff-selected-badge">
                          ✔️ เลือกแล้ว
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
            <div className="staff-note-section">
              <label>📝 หมายเหตุ (ส่งถึงพนักงาน)</label>
              <textarea
                className="staff-note-input"
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
        </div>
      </Modal>

      {/* Out of Stock Drugs Modal */}
      <Modal
        title={
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff4d4f' }}>
            <span>🚨</span>
            <span>ยาที่หมดสต็อก ({outOfStockModal.drugs.length} รายการ)</span>
          </div>
        }
        open={outOfStockModal.open}
        onCancel={() => {
          setOutOfStockModal({ open: false, drugs: [] });
          setOutOfStockIds([]);
        }}
        footer={null}
        centered
        width={500}
        className="out-of-stock-modal"
      >
        <div style={{ padding: '10px 0' }}>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            รายชื่อยาที่ {assignedByStaff?.users_permissions_user?.full_name || 'พนักงาน'} แจ้งว่าหมดสต็อก:
          </p>
          
          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto',
            border: '1px solid #f0f0f0',
            borderRadius: '6px'
          }}>
            {outOfStockModal.drugs.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: '#999'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                <p>ไม่มีข้อมูลยาหมดสต็อก</p>
              </div>
            ) : (
              outOfStockModal.drugs.map((drug, index) => (
                <div 
                  key={drug.documentId || index} 
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 15px',
                    borderBottom: index < outOfStockModal.drugs.length - 1 ? '1px solid #f0f0f0' : 'none',
                    background: '#fff2f0'
                  }}
                >
                  <div style={{ 
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#ff4d4f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '16px',
                    marginRight: '12px',
                    flexShrink: 0
                  }}>
                    💊
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: 'bold',
                      fontSize: '14px',
                      color: '#ff4d4f',
                      marginBottom: '2px'
                    }}>
                      {drug.name_th}
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: '#666'
                    }}>
                      {drug.name_en}
                    </div>
                    {drug.price && (
                      <div style={{ 
                        fontSize: '12px',
                        color: '#999',
                        marginTop: '2px'
                      }}>
                        ราคา: {drug.price} บาท
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{ 
            marginTop: '15px',
            padding: '10px',
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#52c41a'
          }}>
            💡 เภสัชกรควรตรวจสอบสต็อกและสั่งซื้อยาเหล่านี้
          </div>
        </div>
      </Modal>

      {/* Drug Detail Modal - opens when clicking 'รายละเอียด' on a prescribed drug */}
      <Modal
        title={drugDetailModal.drug ? drugDetailModal.drug.name_th : 'รายละเอียดยา'}
        open={drugDetailModal.open}
        onCancel={() => setDrugDetailModal({ open: false, drug: null })}
        footer={null}
        centered
        className="drug-detail-modal"
      >
        {drugDetailModal.drug ? (
          <div style={{ padding: '8px 0' }}>
            <h4 style={{ marginBottom: '6px' }}>{drugDetailModal.drug.name_en || '-'}</h4>
            {drugDetailModal.drug.description && (
              <p style={{ color: '#444', marginBottom: '8px' }}>{drugDetailModal.drug.description}</p>
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
                  <div className="drug-detail-batch-list">
                    <div className="batch-list-header">
                      <span className="batch-list-icon">📦</span>
                      <span className="batch-list-title">รายการ Lot ({batches.length})</span>
                    </div>
                    <div className="batch-list-container">
                      {batches.map((batch, i) => (
                        <div key={batch.documentId || batch.id || i} className="drug-detail-batch-item">
                          <div className="batch-item-row">
                            <span className="batch-label">Lot:</span>
                            <span className="batch-value batch-lot">{batch.lot_number || '-'}</span>
                            <span className="batch-divider">•</span>
                            <span className="batch-label">สต็อก:</span>
                            <span className="batch-value">{batch.quantity || 0}</span>
                            {batch.date_produced && (
                              <>
                                <span className="batch-divider">•</span>
                                <span className="batch-label">ผลิต:</span>
                                <span className="batch-value">{formatThaiDate(batch.date_produced)}</span>
                              </>
                            )}
                          </div>
                          {batch.expiry_date && (
                            <div className="batch-item-expiry">
                              <span className="expiry-label">หมดอายุ:</span>
                              <span className="expiry-date">{formatThaiDate(batch.expiry_date)}</span>
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
                  <div className="drug-detail-placeholder" style={{ marginBottom: 12 }}>
                    <div className="placeholder-icon">📦</div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#334155' }}>ไม่มีข้อมูล Lot</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>ไม่มีรายละเอียด Lot, จำนวน หรือวันที่ผลิต/หมดอายุ สำหรับรายการยานี้</div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="drug-detail-meta">
                  {price !== undefined && price !== null && <div className="meta-item">ราคา: <strong>{price} ฿</strong></div>}
                  {lot ? <div className="meta-item">Lot: <strong>{lot}</strong></div> : null}
                  {quantity !== undefined && quantity !== null ? <div className="meta-item">จำนวน: <strong>{quantity} แผง</strong></div> : null}
                  {dateProduced ? <div className="meta-item">ผลิต: <strong>{formatThaiDate(dateProduced)}</strong></div> : null}
                  {expiry ? <div className="meta-item">หมดอายุ: <strong>{formatThaiDate(expiry)}</strong></div> : null}
                </div>
              );
            })()}
            <div style={{ marginTop: '8px', textAlign: 'right' }}>
              <button
                onClick={() => setDrugDetailModal({ open: false, drug: null })}
                style={{
                  background: '#f5f5f5',
                  border: '1px solid #d9d9d9',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >ปิด</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>ไม่พบข้อมูลยา</div>
        )}
      </Modal>

      {/* Staff Work Status Update Modal - REMOVED: Pharmacy should not update staff status, only view it */}
      {/* Modal removed because pharmacy view should only display status, not update it */}
    </div>
  );
}

export default CustomerDetail;
