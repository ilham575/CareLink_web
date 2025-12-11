import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/pharmacy/detail_customer.css';
import 'react-toastify/dist/ReactToastify.css';
import { Modal, Tabs } from 'antd';
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
    note: ''
  });
  const [addDrugModal, setAddDrugModal] = useState({ 
    open: false, 
    availableDrugs: []
  });
  const [activeTab, setActiveTab] = useState('1');
  // Track selected batch (lot) for each drug: { drugId: batchDocumentId }
  const [selectedBatches, setSelectedBatches] = useState({});
  
  // Get pharmacyId from URL params
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');

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

  // Computed: Check if lots have been saved (from staffStatus.batches_selected)
  const lotsSaved = !!(staffStatus?.batches_selected && Object.keys(staffStatus.batches_selected).length > 0);

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
          let full_name = d.full_name || d.name || d.patient_name || d.patient_full_name || 'ไม่ระบุ';
          if (full_name === 'ไม่ระบุ' && notif.message) {
            const match = notif.message.match(/ได้รับมอบหมายดูแลผู้ป่วย:\s*([^\n]+)/);
            if (match) {
              full_name = match[1].trim();
            }
          }

          const userObj = {
            full_name: full_name,
            phone: d.phone || d.tel || d.mobile || '',
            email: d.email || ''
          };

          const tempCustomer = {
            documentId: customerDocumentId,
            users_permissions_user: userObj,
            Customers_symptoms: d.symptoms || '',
            Allergic_drugs: d.allergy || '',
            congenital_disease: d.disease || '',
            Follow_up_appointment_date: d.follow_up_date || d.appointment_date || null,
            prescribed_drugs: d.prescribed_drugs || [],
            _fromNotificationOnly: true
          };

          setCustomer(tempCustomer);
          setNotification(notif);

          // อ่านสถานะจาก notification data
          if (notif?.staff_work_status) {
            setStaffStatus(notif.staff_work_status);
            // ดึง selected batches จากที่เก็บไว้ใน notification
            if (notif.staff_work_status.batches_selected) {
              setSelectedBatches(notif.staff_work_status.batches_selected);
            }
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
              const notifRes = await fetch(
                API.notifications.getStaffAssignments(staffProfile.documentId, customerDocumentId),
                { headers: { Authorization: token ? `Bearer ${token}` : '' } }
              );

              if (notifRes.ok) {
                const notifData = await notifRes.json();
                const notif = notifData.data?.[0];
                setNotification(notif);

                // อ่านสถานะจาก notification staff_work_status
                if (notif?.staff_work_status) {
                  setStaffStatus(notif.staff_work_status);
                  // ดึง selected batches จากที่เก็บไว้ใน notification
                  if (notif.staff_work_status.batches_selected) {
                    setSelectedBatches(notif.staff_work_status.batches_selected);
                  }
                }
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
  // Smart Polling: ใช้ exponential backoff + ETag caching + change detection
  const { resetInterval: resetNotificationPoll } = useSmartPolling(
    notification?.documentId
      ? API.notifications.getByDocumentId(notification.documentId)
      : null,
    {
      initialInterval: 2000, // เริ่มต้น 2 วินาที
      maxInterval: 30000, // สูงสุด 30 วินาที
      backoffMultiplier: 1.3,
      enabled: !!notification?.documentId,
      onDataChange: (newData) => {
        // เมื่อมีข้อมูลใหม่
        const updatedNotif = newData.data;
        if (updatedNotif?.staff_work_status) {
          // Check if status changed from pharmacy end
          const hasChanges = JSON.stringify(staffStatus) !== JSON.stringify(updatedNotif.staff_work_status);
          if (hasChanges) {
            setStaffStatus(updatedNotif.staff_work_status);
            setNotification(updatedNotif);
            toast.info('🔄 เภสัชกรได้ส่งข้อมูลอัพเดต');
          }
        }
      },
      onError: (error) => {
        console.error('Error in smart polling:', error);
      }
    }
  );

  const handleBack = () => {
    if (pharmacyId) {
      navigate(`/drug_store_staff/${pharmacyId}/customers`);
    } else {
      navigate(-1);
    }
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

      if (res.ok) {
        setStaffStatus(updatedStatus);
        setNotification(prev => ({ ...prev, staff_work_status: updatedStatus, is_read: true }));
        toast.success('อัปเดตสถานะสำเร็จ');
        setStatusModal({ open: false, type: '', note: '' });
        
        // Broadcast update event ให้ pharmacy detail page ทราบเพื่อให้อัพเดตแบบ real-time
        window.dispatchEvent(new CustomEvent('staffStatusUpdated', { 
          detail: { 
            customerDocumentId, 
            staffStatus: updatedStatus,
            notificationId: notifIdentifier
          } 
        }));
        
        // Also store in localStorage for cross-tab communication
        localStorage.setItem(`staffStatus_${customerDocumentId}`, JSON.stringify({
          updatedAt: new Date().toISOString(),
          staffStatus: updatedStatus,
          notificationId: notifIdentifier
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

  return (
    <div className="customer-detail-page">
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <HomeHeader 
        pharmacyName={pharmacy?.name_th || pharmacy?.attributes?.name_th || ''}
        pharmacistName={getPharmacistName(pharmacy)}
      />
      
      <main className="customer-detail-main">
        {/* Header summary: patient info only */}
        <div className="detail-header-summary">
          <div className="detail-header-left">
            <div className="detail-header-name">{user?.full_name || 'ไม่พบชื่อ'}</div>
            <div className="detail-header-meta">
              <span>{user?.phone || '-'}</span>
              <span className="dot">•</span>
              <span>{customer.Follow_up_appointment_date ? formatThaiDate(customer.Follow_up_appointment_date) : 'ไม่มีวันนัด'}</span>
            </div>
          </div>
          <div className="detail-header-right">
            <div className="detail-header-badges">
              <div className="pill-badge">💊 {customer.prescribed_drugs ? customer.prescribed_drugs.length : 0}</div>
            </div>
          </div>
        </div>

        {/* สถานะการทำงานของ Staff */}
        <div className="staff-status-panel" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>📊 สถานะการดำเนินการ</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusModal({ open: true, type: 'received', note: '' })}
              disabled={staffStatus.received}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: staffStatus.received ? '#52c41a' : 'rgba(255,255,255,0.2)',
                color: 'white',
                cursor: staffStatus.received ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {staffStatus.received ? '✅ ได้รับข้อมูลแล้ว' : '📥 ยืนยันรับข้อมูล'}
            </button>
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'prepared', note: '' })}
              disabled={staffStatus.prepared || !staffStatus.received || !lotsSaved}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: staffStatus.prepared ? '#52c41a' : (staffStatus.received && lotsSaved) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: staffStatus.prepared || !staffStatus.received || !lotsSaved ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                opacity: (!staffStatus.received || !lotsSaved) ? 0.5 : 1
              }}
              title={!lotsSaved ? 'กรุณาบันทึก Lot ยาก่อน' : staffStatus.prepared ? 'จัดยาส่งแล้ว' : ''}
            >
              {staffStatus.prepared ? '✅ จัดยาส่งแล้ว' : '📦 จัดยาส่งไปแล้ว'}
            </button>
            
            {staffStatus.prepared && (
              <button
                onClick={() => setStatusModal({ open: true, type: 'cancelDelivery', note: '' })}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '2px solid #ff4d4f',
                  background: 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 77, 79, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                title="ยกเลิกการจัดส่งและกู้คืนสต็อกยา"
              >
                ⏮️ ยกเลิกการจัดส่ง
              </button>
            )}
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'outOfStock', note: '', selectedDrugs: [] })}
              disabled={staffStatus.prepared}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: staffStatus.prepared ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                color: 'white',
                cursor: staffStatus.prepared ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                opacity: staffStatus.prepared ? 0.5 : 1
              }}
              title={staffStatus.prepared ? 'ปิดปุ่มนี้หลังจากจัดส่งยา' : ''}
            >
              🚨 แจ้งยาหมดสต็อก
            </button>
          </div>
          
          {notifData.staff_note && (
            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <strong>📝 หมายเหตุ:</strong> {notifData.staff_note}
            </div>
          )}

          {notifData.note && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px' }}>
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
        >
          <Tabs.TabPane tab={<span>📋 ข้อมูลพื้นฐาน</span>} key="1">
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
                    <div className="info-row">
                      <label>ยาที่แพ้:</label>
                      <span className="text-warning">{customer.Allergic_drugs || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="info-row">
                      <label>โรคประจำตัว:</label>
                      <span>{customer.congenital_disease || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane tab={<span>🩺 อาการและการติดตาม</span>} key="2">
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
                      <p>{customer.Allergic_drugs || 'ไม่มีข้อมูล'}</p>
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

          <Tabs.TabPane tab={<span>💊 รายการยา <span className="tab-badge">{customer?.prescribed_drugs?.length || 0}</span></span>} key="3">
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
                            <div style={{
                              position: 'absolute',
                              top: '10px',
                              left: '10px',
                              background: '#0050b3',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              🔒 ล็อก
                            </div>
                          )}
                          {/* Quantity Badge */}
                          <div className="prescribed-drug-quantity-badge">
                            จำนวน {quantity}
                          </div>

                          {isOutOfStock && (
                            <div style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              background: '#ff4d4f',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
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
                            <div className="prescribed-drug-meta" style={{ marginTop: '12px', opacity: staffStatus.prepared ? 0.6 : 1 }}>
                              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#0050b3' }}>
                                🏷️ เลือก Lot ที่ใช้:
                              </div>
                              <select
                                disabled={staffStatus.prepared}
                                value={selectedBatches[drugId] || ''}
                                onChange={(e) => {
                                  setSelectedBatches(prev => ({
                                    ...prev,
                                    [drugId]: e.target.value
                                  }));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  border: '1px solid #d9d9d9',
                                  fontSize: '12px',
                                  cursor: staffStatus.prepared ? 'not-allowed' : 'pointer',
                                  background: staffStatus.prepared ? '#f5f5f5' : 'white',
                                  color: '#000'
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
                                <div style={{ marginTop: '8px', padding: '8px', background: '#f6ffed', borderRadius: '4px', fontSize: '12px', color: '#52c41a', border: staffStatus.prepared ? '2px solid #52c41a' : 'none', fontWeight: staffStatus.prepared ? 'bold' : 'normal' }}>
                                  {staffStatus.prepared ? '🔒 ล็อกแล้ว - ' : '✅ '}เลือก Lot: <strong>{drug.drug_batches.find(b => b.documentId === selectedBatches[drugId] || b.id === selectedBatches[drugId])?.lot_number}</strong>
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
          </Tabs.TabPane>

          <Tabs.TabPane tab={<span>📋 ดำเนินการ</span>} key="4">
            <div className="customer-actions-panel responsive">
              <div className="actions-grid responsive">
                <button className="action-btn green responsive" onClick={handleBack}>
                  <span>← กลับ</span>
                </button>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
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
                    const isSelected = statusModal.selectedDrugs.includes(drugId);
                    
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
                          checked={isSelected}
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
    </div>
  );
}

export default CustomerDetailStaff;

