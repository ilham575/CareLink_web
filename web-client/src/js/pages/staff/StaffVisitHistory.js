import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Modal, Tabs, Tag } from 'antd';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { API } from '../../../utils/apiConfig';
import HomeHeader from '../../components/HomeHeader';
// Footer is rendered globally in App.js

dayjs.locale('th');

// Format Thai date
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
  const time = d.format('HH:mm');
  return `${day} ${month} ${year} เวลา ${time} น.`;
}

function StaffVisitHistory() {
  const { customerDocumentId, pharmacyId: paramPharmacyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  
  // pharmacyId can come either from the path params or from the query string.
  const pharmacyId = paramPharmacyId || new URLSearchParams(location.search).get('pharmacyId');

  useEffect(() => {
    loadData();
  }, [customerDocumentId, paramPharmacyId, location]);

  // Reload visits when returning to this page (e.g., after editing in detail page)
  useEffect(() => {
    const handleFocus = () => {
      console.log('[StaffVisitHistory] Window focused - reloading visits');
      loadData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [customerDocumentId, pharmacyId]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const userDocumentId = localStorage.getItem('user_documentId');
      
      if (!userDocumentId) {
        toast.error('ไม่พบข้อมูลผู้ใช้');
        return;
      }
      
      // Load customer profile
      const customerRes = await fetch(
        API.customerProfiles.getByIdBasic(customerDocumentId),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
      
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
      
      // Load pharmacy info
      if (pharmacyId) {
        const pharmacyRes = await fetch(
          API.drugStores.getByDocumentId(pharmacyId),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (pharmacyRes.ok) {
          const pharmacyData = await pharmacyRes.json();
          const store = pharmacyData.data?.find(item => item.documentId === pharmacyId);
          setPharmacy(store);
        }
      }
      
      // Load staff profile for filtering notifications
      const staffRes = await fetch(
        API.staffProfiles.list(`filters[users_permissions_user][documentId][$eq]=${userDocumentId}&filters[drug_store][documentId][$eq]=${pharmacyId}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      let staffDocumentId = null;
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        const staffProfile = staffData.data?.[0];
        staffDocumentId = staffProfile?.documentId;
      }
      
      // Load all visits (notifications) assigned to this staff for this customer
      // รวม type 'message' ด้วยเพื่อแสดงประวัติการบันทึกยา/อาการ
      let notifUrl = `filters[customer_profile][documentId][$eq]=${customerDocumentId}` +
                    `&filters[type][$in][0]=customer_assignment` +
                    `&filters[type][$in][1]=customer_assignment_update` +
                    `&filters[type][$in][2]=message` +
                    `&populate=*` +
                    `&sort[0]=createdAt:desc`;
      
      // Filter by staff if we have staff document ID (to show only notifications assigned to this staff)
      if (staffDocumentId) {
        notifUrl = `filters[staff_profile][documentId][$eq]=${staffDocumentId}&` + notifUrl;
      } else if (pharmacyId) {
        // Fallback: filter by pharmacy if no staff profile
        notifUrl = `filters[drug_store][documentId][$eq]=${pharmacyId}&` + notifUrl;
      }
      
      const notifRes = await fetch(
        API.notifications.list(notifUrl),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const notifications = notifData.data || [];
        
        // แต่ละ notification คือ 1 visit
        const visits = notifications.map(notif => ({
          id: notif.id,
          notifications: [notif],
          latestNotification: notif,
          createdAt: notif.createdAt,
          updatedAt: notif.updatedAt
        }));
        
        // Sort visits by createdAt desc
        visits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setVisits(visits);
      }
      
    } catch (error) {
      console.error('Error loading staff visit history:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (visit) => {
    const latestNotif = visit.latestNotification;
    const notifId = latestNotif?.documentId || latestNotif?.id;
    const targetNotif = notifId ? `&notifId=${encodeURIComponent(notifId)}` : '';
    navigate(`/staff/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}${targetNotif}`);
  };

  const handleCreateNewAssignment = () => {
    // Redirect back to customer list to create new assignment
    navigate(`/drug_store_staff/${pharmacyId}/customers`);
  };

  if (loading) {
    return (
      <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mb-4"></div>
            <p className="text-gray-600 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
            <div className="text-6xl mb-4 grayscale opacity-20">👥</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">ไม่พบข้อมูลลูกค้า</h2>
            <button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition duration-200"
              onClick={() => {
                if (pharmacyId) {
                  navigate(`/drug_store_staff/${pharmacyId}/customers`);
                } else {
                  navigate(-1);
                }
              }}
            >
              กลับ
            </button>
          </div>
        </main>
      </div>
    );
  }

  const user = customer.users_permissions_user;

  // Derived vars for modal details
  const latestNotifForModal = selectedVisit?.latestNotification || selectedVisit?.notifications?.[0] || null;
  const modalNotifData = latestNotifForModal?.data || {};
  const rawModalSymptoms = modalNotifData?.symptoms || latestNotifForModal?.customer_profile?.Customers_symptoms || 'ไม่ระบุอาการ';
  const modalSymptoms = typeof rawModalSymptoms === 'object' ? (rawModalSymptoms.main || rawModalSymptoms.symptom || 'ไม่ระบุอาการ') : rawModalSymptoms;
  const modalDrugs = modalNotifData?.prescribed_drugs || latestNotifForModal?.customer_profile?.prescribed_drugs || [];
  const modalStatus = latestNotifForModal?.staff_work_status || selectedVisit?.staff_work_status || {};

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      
      <main className="flex-1 w-full px-6 py-4 overflow-y-auto">
        {/* Modern Header Section */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 mb-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" /></svg>
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="h-24 w-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center text-3xl text-white font-bold shadow-lg shadow-emerald-200 ring-4 ring-white">
                {(user?.full_name?.charAt(0) || 'C').toUpperCase()}
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">
                  {user?.full_name || 'ไม่พบชื่อ'}
                </h2>
                <div className="text-emerald-600 font-bold text-sm tracking-wider uppercase mb-4">
                  @{user?.username || 'user'}
                </div>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                    <span className="text-sm">📱</span>
                    <span className="text-sm font-bold text-gray-700">{user?.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                    <span className="text-sm">⚠️</span>
                    <span className="text-sm font-bold text-gray-700">แพ้ยา:</span>
                    <Tag color={customer.Allergic_drugs ? 'red' : 'green'} className="m-0 rounded-full font-bold border-none px-3">
                      {customer.Allergic_drugs ? 'มีประวัติ' : 'ไม่มี'}
                    </Tag>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                    <span className="text-sm">🏥</span>
                    <span className="text-sm font-bold text-gray-700">โรคประจำตัว:</span>
                    <Tag color="blue" className="m-0 rounded-full font-bold border-none px-3">
                      {customer.congenital_disease || 'ไม่มี'}
                    </Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visit History Timeline */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📋 ประวัติการบริการ
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                {visits.length} ครั้ง
              </span>
            </h3>
          </div>
          
          <div className="p-6">
            {visits.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4 grayscale opacity-10">📋</div>
                <p className="text-gray-400 text-lg mb-6">ยังไม่มีการคัดกรองสำหรับลูกค้านี้</p>
                <button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-2xl transition duration-200 shadow-md"
                  onClick={handleCreateNewAssignment}
                >
                  กลับไปเพื่อสร้างการคัดกรองใหม่
                </button>
              </div>
            ) : (
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gray-100">
                  {visits.map((visit, index) => {
                    const latestNotif = visit.latestNotification;
                    const visitData = latestNotif.data || {};
                    const innerData = visitData.data || {};
                    const rawSymptoms = innerData.symptoms || visitData.symptoms || latestNotif.customer_profile?.Customers_symptoms || 'ไม่ระบุอาการ';
                    const symptoms = typeof rawSymptoms === 'object' ? (rawSymptoms.main || rawSymptoms.symptom || 'ไม่ระบุอาการ') : rawSymptoms;
                    const staffWorkStatus = latestNotif.staff_work_status || {};
                    
                    let statusColor = 'default';
                    let statusText = 'รอดำเนินการ';
                    let statusClasses = 'bg-gray-100 text-gray-500';
                    
                    if (staffWorkStatus.cancelled) {
                      statusColor = 'red';
                      statusText = 'ยกเลิก';
                      statusClasses = 'bg-red-100 text-red-600';
                    } else if (staffWorkStatus.prepared) {
                      statusColor = 'green';
                      statusText = 'จัดส่งแล้ว';
                      statusClasses = 'bg-emerald-100 text-emerald-600';
                    } else if (staffWorkStatus.received) {
                      statusColor = 'blue';
                      statusText = 'รับข้อมูลแล้ว';
                      statusClasses = 'bg-blue-100 text-blue-600';
                    }
                    
                    return (
                      <div key={visit.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        {/* Dot with Icon */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-gray-200 group-hover:bg-emerald-500 transition-colors duration-300 text-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/></svg>
                        </div>
                        
                        {/* Content Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300 cursor-pointer"
                             onClick={() => handleViewDetail(visit)}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                             <div className="font-bold text-gray-400 text-xs tracking-wide">{formatThaiDate(visit.createdAt)}</div>
                             <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full ${statusClasses}`}>
                               {statusText}
                             </span>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg group-hover:text-emerald-600 transition-colors">📦 คัดกรองครั้งที่ {visits.length - index}</h4>
                              <p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{symptoms}</p>
                            </div>
                            
                            <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                              <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                                รายละเอียดการจัดยา
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center mt-12 mb-8">
          <button
            className="px-8 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 flex items-center gap-2"
            onClick={() => {
              if (pharmacyId) {
                navigate(`/drug_store_staff/${pharmacyId}/customers`);
              } else {
                navigate(-1);
              }
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            กลับหน้าหลัก
          </button>
        </div>
      </main>

      {/* Visit Detail Modal (Simple Version for Staff) */}
      <Modal
        title={
          <div className="flex items-center gap-3 text-xl font-bold py-2">
            <span className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-lg">📋</span>
            รายละเอียดการจัดยา
          </div>
        }
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <button
            key="close"
            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-2xl transition duration-200 shadow-lg mt-2"
            onClick={() => setDetailModal(false)}
          >
            ปิด
          </button>
        ]}
        width={700}
        centered
        className="modern-modal"
      >
        {selectedVisit && (
          <div className="py-4 space-y-6">
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">วันที่มอบหมายงาน</div>
                <div className="text-gray-900 font-bold text-lg">
                  {formatThaiDate(selectedVisit.createdAt)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">รหัสการมอบหมาย</div>
                <div className="text-gray-500 font-mono font-bold text-sm">#{selectedVisit.id}</div>
              </div>
            </div>

            <div className="bg-emerald-50/30 p-5 rounded-3xl border border-emerald-100/50">
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">อาการที่บันทึก</div>
              <div className="text-gray-900 text-lg leading-relaxed font-bold">{modalSymptoms}</div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <span className="h-1 w-4 bg-emerald-500 rounded-full"></span>
                รายการยา
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                {Array.isArray(modalDrugs) && modalDrugs.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {modalDrugs.map((drug, i) => {
                      const drugName = drug.drugName || drug.name || (typeof drug === 'string' ? drug : 'ยา');
                      const quantity = drug.quantity || 1;
                      return (
                        <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-emerald-50/10 transition-colors">
                          <div className="flex items-center gap-4 font-bold text-gray-800">
                             <div className="h-8 w-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-xs">💊</div>
                            {drugName}
                          </div>
                          <div className="text-emerald-600 font-black text-lg">
                            × {quantity}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-10 text-center text-gray-400 font-medium italic">ไม่มีรายการยา</div>
                )}
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-3">
               <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">สถานะปัจจุบัน:</div>
               <div className="flex flex-wrap gap-2">
                {modalStatus?.received && <Tag color="blue" className="rounded-full px-4 py-1 border-none font-black text-[11px] uppercase shadow-sm">✅ รับงานแล้ว</Tag>}
                {modalStatus?.prepared && <Tag color="green" className="rounded-full px-4 py-1 border-none font-black text-[11px] uppercase shadow-sm">📦 จัดส่งเรียบร้อย</Tag>}
                {modalStatus?.cancelled && <Tag color="red" className="rounded-full px-4 py-1 border-none font-black text-[11px] uppercase shadow-sm">❌ ยกเลิก</Tag>}
                {!modalStatus?.received && !modalStatus?.prepared && !modalStatus?.cancelled && (
                  <Tag color="default" className="rounded-full px-4 py-1 border-none font-black text-[11px] uppercase shadow-sm">⏳ รอมอบหมาย</Tag>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StaffVisitHistory;
