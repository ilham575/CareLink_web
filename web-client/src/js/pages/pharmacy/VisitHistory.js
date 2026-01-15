import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Modal, Tabs, Tag, Timeline } from 'antd';
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

function VisitHistory() {
  const { customerDocumentId, pharmacyId: paramPharmacyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    open: false,
    visit: null,
    loading: false
  });
  
  // pharmacyId can come either from the path params or from the query string.
  // Use path param first (when route is /drug_store_pharmacy/:pharmacyId/customer/:customerDocumentId/history),
  // otherwise fall back to ?pharmacyId= in the query string.
  const pharmacyId = paramPharmacyId || new URLSearchParams(location.search).get('pharmacyId');

  useEffect(() => {
    loadData();
  }, [customerDocumentId, paramPharmacyId, location]);

  // Reload visits when returning to this page (e.g., after editing in detail page)
  // This ensures new notifications appear in the list immediately
  useEffect(() => {
    const handleFocus = () => {
      console.log('[VisitHistory] Window focused - reloading visits');
      loadData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [customerDocumentId, pharmacyId]);

  // Also reload data on component mount to catch new visits created in detail page
  useEffect(() => {
    console.log('[VisitHistory] Component mounted/remounted - reloading visits');
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('jwt');
      
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
      
      // Load all visits (notifications) for this customer at this pharmacy
      // ⚠️ เฉพาะ customer_assignment (การมอบหมายใหม่) และ message (บันทึกข้อมูล)
      // ❌ ไม่รวม customer_assignment_update เพราะมันคือการอัพเดตของ visit เดียวกัน
      // (ถ้าใส่ customer_assignment_update มันจะแสดงสองครั้งในรายการ visit)
      const notifRes = await fetch(
        API.notifications.list(
          `filters[customer_profile][documentId][$eq]=${customerDocumentId}` +
          `&filters[drug_store][documentId][$eq]=${pharmacyId}` +
          `&filters[type][$in][0]=customer_assignment` +
          `&filters[type][$in][1]=message` +
          `&populate=*` +
          `&sort[0]=createdAt:desc`
        ),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const notifications = notifData.data || [];
        
        // แต่ละ notification คือ 1 visit (ไม่ group)
        // เพราะแต่ละครั้งที่ส่งข้อมูลให้พนักงาน ถือเป็นการมาใหม่
        const visits = notifications.map(notif => ({
          id: notif.id,
          notifications: [notif], // wrap ใน array เพื่อให้ compatible กับ UI
          latestNotification: notif,
          createdAt: notif.createdAt,
          updatedAt: notif.updatedAt
        }));
        
        // Sort visits by createdAt desc (ล่าสุดก่อน)
        visits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setVisits(visits);
      }
      
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (visit) => {
    // Navigate to CustomerDetail page and pass notifId so detail page can load specific visit
    const latestNotif = visit.latestNotification;
    const notifId = latestNotif?.documentId || latestNotif?.id;
    const targetNotif = notifId ? `&notifId=${encodeURIComponent(notifId)}` : '';
    // Use the app's CustomerDetail route: /customer_detail/:customerDocumentId
    navigate(`/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}${targetNotif}`);
  };

  const handleCreateNewVisit = () => {
    // Navigate to customer detail page to create new visit
    navigate(`/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}&newVisit=1`);
  };

  const handleDeleteVisit = (visit) => {
    setDeleteConfirmModal({
      open: true,
      visit: visit,
      loading: false
    });
  };

  const handleConfirmDeleteVisit = async () => {
    if (!deleteConfirmModal.visit) return;

    setDeleteConfirmModal(prev => ({ ...prev, loading: true }));

    try {
      const token = localStorage.getItem('jwt');
      const notifId = deleteConfirmModal.visit.latestNotification.documentId;

      const res = await fetch(API.notifications.delete(notifId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('ลบข้อมูลไม่สำเร็จ');

      toast.success('ลบประวัติการมาใช้บริการสำเร็จ');
      setDeleteConfirmModal({ open: false, visit: null, loading: false });

      // Reload data to update the list
      loadData();

    } catch (error) {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบข้อมูล');
      setDeleteConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <p className="text-gray-600 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
            <div className="text-6-xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">ไม่พบข้อมูลลูกค้า</h2>
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition duration-200 shadow-md hover:shadow-lg"
              onClick={() => {
                if (pharmacy?.documentId || pharmacyId) {
                  navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/followup-customers`);
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
  
  // Read from nested snapshot (innerData) first, then fallback to top-level
  const modalInnerData = modalNotifData?.data || {};
  const modalSymptoms = modalInnerData?.symptoms?.main || modalInnerData?.symptoms || modalNotifData?.symptoms?.main || modalNotifData?.symptoms || latestNotifForModal?.customer_profile?.Customers_symptoms || 'ไม่ระบุอาการ';
  const modalDrugs = modalInnerData?.prescribed_drugs || modalNotifData?.prescribed_drugs || latestNotifForModal?.customer_profile?.prescribed_drugs || [];
  const modalAppointmentDate = modalInnerData?.appointment_date || modalNotifData?.appointment_date || latestNotifForModal?.customer_profile?.Follow_up_appointment_date || null;
  
  const modalStatus = latestNotifForModal?.staff_work_status || selectedVisit?.staff_work_status || {};
  const modalStaff = selectedVisit?.staff_profile || latestNotifForModal?.staff_profile || null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      
      <main className="flex-grow max-w-5xl mx-auto w-full px-4 py-8">
        {/* Customer Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 md:p-8 shadow-lg text-white mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                  👤
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {user?.full_name || 'ไม่พบชื่อ'}
                  </h2>
                  <p className="text-blue-100/80 font-medium">ข้อมูลลูกค้า</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:bg-white/15 transition-colors">
                  <span className="text-xl">📱</span>
                  <span className="font-semibold">{user?.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:bg-white/15 transition-colors">
                  <span className="text-xl">⚠️</span>
                  <span className="font-semibold">แพ้ยา: {customer.Allergic_drugs ? 'มี' : 'ไม่มี'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:bg-white/15 transition-colors">
                  <span className="text-xl">🏥</span>
                  <span className="font-semibold line-clamp-1" title={customer.congenital_disease || 'ไม่มี'}>
                    โรคประจำตัว: {customer.congenital_disease || 'ไม่มี'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 min-w-[200px]">
              <button 
                className="w-full bg-white text-blue-700 hover:bg-blue-50 font-bold py-3 px-6 rounded-2xl transition-all duration-200 shadow-md transform hover:-translate-y-1"
                onClick={handleCreateNewVisit}
              >
                ➕ บันทึกการมาใหม่
              </button>
            </div>
          </div>
        </div>

        {/* Visit History Timeline */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📋 ประวัติการมาใช้บริการ
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                {visits.length} ครั้ง
              </span>
            </h3>
          </div>
          
          <div className="p-6">
            {visits.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 grayscale opacity-20">📝</div>
                <p className="text-gray-500 text-lg mb-6">ยังไม่มีประวัติการมาใช้บริการ</p>
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition duration-200 shadow-md"
                  onClick={handleCreateNewVisit}
                >
                  บันทึกการมาครั้งแรก
                </button>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {visits.map((visit, index) => {
                    const latestNotif = visit.latestNotification;
                    const visitData = latestNotif.data || {};
                    const innerData = visitData.data || {};
                    const rawSymptoms = innerData.symptoms || visitData.symptoms || latestNotif.customer_profile?.Customers_symptoms || null;
                    let symptoms = 'ไม่ระบุอาการ';
                    if (rawSymptoms) {
                      if (typeof rawSymptoms === 'string') {
                        symptoms = rawSymptoms;
                      } else if (typeof rawSymptoms === 'object') {
                        symptoms = rawSymptoms.main || rawSymptoms.history || rawSymptoms.note || JSON.stringify(rawSymptoms);
                      }
                    }
                    const drugs = innerData.prescribed_drugs || visitData.prescribed_drugs || latestNotif.customer_profile?.prescribed_drugs || [];
                    const staffWorkStatus = latestNotif.staff_work_status || {};
                    
                    let statusColor = 'bg-gray-100 text-gray-600';
                    let statusText = 'รอดำเนินการ';
                    
                    if (staffWorkStatus.cancelled) {
                      statusColor = 'bg-red-100 text-red-600';
                      statusText = 'ยกเลิก';
                    } else if (staffWorkStatus.prepared) {
                      statusColor = 'bg-green-100 text-green-600';
                      statusText = 'จัดส่งแล้ว';
                    } else if (staffWorkStatus.received) {
                      statusColor = 'bg-blue-100 text-blue-600';
                      statusText = 'รับข้อมูลแล้ว';
                    }
                    
                    return (
                      <div key={visit.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Dot */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 group-[.is-active]:bg-blue-600 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <svg className="fill-current w-4 h-4" viewBox="0 0 16 16">
                            <path d="M8 0a8 8 0 1 0 8 8 8.009 8.009 0 0 0-8-8Zm0 14a6 6 0 1 1 6-6 6.007 6.007 0 0 1-6 6Z" />
                            <circle cx="8" cy="8" r="3" />
                          </svg>
                        </div>
                        {/* Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group"
                             onClick={() => handleViewDetail(visit)}>
                          <div className="flex items-center justify-between space-x-2 mb-2">
                             <div className="font-bold text-gray-400 text-sm">{formatThaiDate(visit.createdAt)}</div>
                             <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${statusColor}`}>
                               {statusText}
                             </span>
                          </div>
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">🩺 การมาใช้บริการครั้งที่ {visits.length - index}</h4>
                              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{symptoms}</p>
                            </div>
                            <button
                              className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVisit(visit);
                              }}
                              title="ลบประวัติการมาใช้บริการ"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
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
            className="px-10 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow active:scale-95"
            onClick={() => {
              if (pharmacy?.documentId || pharmacyId) {
                navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/followup-customers`);
              } else {
                navigate(-1);
              }
            }}
          >
            ← กลับหน้าจัดยา
          </button>
        </div>
      </main>

      {/* <Footer /> */}

      {/* Visit Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3 text-xl font-bold py-2">
            <span className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">📋</span>
            รายละเอียดการมาใช้บริการ
          </div>
        }
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <button
            key="close"
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition duration-200 mt-2"
            onClick={() => setDetailModal(false)}
          >
            ปิดหน้าต่าง
          </button>
        ]}
        width={700}
        centered
        className="modern-modal"
      >
        {selectedVisit && (
          <div className="py-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">วันที่มาใช้บริการ</div>
                <div className="text-gray-900 font-semibold">
                  {formatThaiDate(selectedVisit.createdAt)}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">วันนัดติดตาม</div>
                <div className="text-gray-900 font-semibold">
                  {modalAppointmentDate ? formatThaiDate(modalAppointmentDate) : 'ยังไม่มีกำหนด'}
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100/50">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">อาการหลัก</div>
              <div className="text-gray-800 text-lg leading-relaxed font-medium">{modalSymptoms}</div>
            </div>

            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">ยาที่ได้รับ</div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {Array.isArray(modalDrugs) && modalDrugs.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {modalDrugs.map((drug, i) => {
                      const drugName = drug.drugName || drug.name || (typeof drug === 'string' ? drug : 'ยา');
                      const quantity = drug.quantity || 1;
                      return (
                        <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3 font-medium text-gray-800">
                            <span className="h-2 w-2 bg-blue-500 rounded-full"></span>
                            {drugName}
                          </div>
                          <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-sm font-bold">
                            × {quantity}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 italic">ไม่มีรายการยา</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
               <div className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">สถานะ:</div>
               <div className="flex flex-wrap gap-2">
                {modalStatus?.received && <Tag color="blue" className="rounded-full px-3 py-0.5 border-none font-bold">✅ รับข้อมูลแล้ว</Tag>}
                {modalStatus?.prepared && <Tag color="green" className="rounded-full px-3 py-0.5 border-none font-bold">📦 จัดส่งแล้ว</Tag>}
                {modalStatus?.cancelled && <Tag color="red" className="rounded-full px-3 py-0.5 border-none font-bold">❌ ยกเลิก</Tag>}
                {!modalStatus?.received && !modalStatus?.prepared && !modalStatus?.cancelled && (
                  <Tag color="default" className="rounded-full px-3 py-0.5 border-none font-bold font-bold">⏳ รอดำเนินการ</Tag>
                )}
              </div>
            </div>

            {modalStaff && (
              <div className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4">
                <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-lg">👤</div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase">เจ้าหน้าที่ผู้รับผิดชอบ</div>
                  <div className="text-gray-900 font-bold">{modalStaff.full_name || '-'}</div>
                </div>
              </div>
            )}

            <div className="mt-8">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 ml-1">ประวัติการอัปเดต ({selectedVisit.notifications.length} รายการ)</div>
              <div className="relative space-y-4">
                {selectedVisit.notifications.map((notif, idx) => (
                  <div key={notif.id} className="relative pl-8 pb-4 border-l-2 border-dashed border-gray-100 last:border-0 last:pb-0">
                    <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-white border-4 border-blue-500 shadow-sm"></div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900">
                          {notif.type === 'customer_assignment' ? '📝 การมอบหมาย' : 
                          notif.type === 'customer_assignment_update' ? '🔄 อัปเดต' : 
                          notif.type === 'message' ? '💊 บันทึกข้อมูล' : '📋 บันทึก'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded-lg">
                          {formatThaiDate(notif.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 leading-relaxed">
                        {notif.data?.symptoms && (
                          <div className="mb-2"><strong>อาการ:</strong> {notif.data.symptoms.main || notif.data.symptoms}</div>
                        )}
                        {notif.data?.prescribed_drugs && notif.data.prescribed_drugs.length > 0 && (
                          <div className="mb-2">
                            <strong>ยา:</strong> {notif.data.prescribed_drugs.map((d, i) => {
                              if (typeof d === 'string') return d;
                              if (d.drugName) return `${d.drugName} ${d.quantity ? `×${d.quantity}` : ''}`;
                              return d.name || 'ยา';
                            }).join(', ')}
                          </div>
                        )}
                        {notif.message && (
                          <div className="bg-gray-50 p-2 rounded-xl mt-2 italic text-gray-500 border-l-4 border-gray-200">
                            "{notif.message}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-red-600 font-bold py-2">
            ⚠️ ยืนยันการลบประวัติ
          </div>
        }
        open={deleteConfirmModal.open}
        onCancel={() => setDeleteConfirmModal({ open: false, visit: null, loading: false })}
        footer={[
          <div className="flex gap-3 mt-2" key="footer">
            <button
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition duration-200"
              onClick={() => setDeleteConfirmModal({ open: false, visit: null, loading: false })}
              disabled={deleteConfirmModal.loading}
            >
              ยกเลิก
            </button>
            <button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2"
              onClick={handleConfirmDeleteVisit}
              disabled={deleteConfirmModal.loading}
            >
              {deleteConfirmModal.loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>กำลังลบ...</span>
                </>
              ) : (
                'ยืนยันการลบ'
              )}
            </button>
          </div>
        ]}
        width={450}
        centered
      >
        <div className="py-4">
          <p className="text-gray-900 font-bold mb-2">
            คุณต้องการลบประวัติการมาใช้บริการนี้หรือไม่?
          </p>
          <p className="text-gray-500 text-sm mb-6">
            ข้อมูลการเข้ารับบริการนี้จะถูกลบออกจากฐานข้อมูลอย่างถาวรและไม่สามารถเรียกคืนได้
          </p>
          
          {deleteConfirmModal.visit && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-4">
              <div className="h-10 w-10 bg-white rounded-xl shadow-sm border border-red-50 flex items-center justify-center text-xl shrink-0">📅</div>
              <div>
                <div className="text-xs font-bold text-red-400 uppercase">วันที่เข้ารับบริการ</div>
                <div className="text-gray-900 font-bold">{formatThaiDate(deleteConfirmModal.visit.createdAt)}</div>
                <div className="mt-1 text-sm text-gray-600 line-clamp-1">
                  <strong>อาการ:</strong> {(() => {
                    const latestNotif = deleteConfirmModal.visit.latestNotification;
                    const visitData = latestNotif.data || {};
                    const innerData = visitData.data || {};
                    const rawSymptoms = innerData.symptoms || visitData.symptoms || latestNotif.customer_profile?.Customers_symptoms || null;
                    let symptoms = 'ไม่ระบุอาการ';
                    if (rawSymptoms) {
                      if (typeof rawSymptoms === 'string') {
                        symptoms = rawSymptoms;
                      } else if (typeof rawSymptoms === 'object') {
                        symptoms = rawSymptoms.main || rawSymptoms.history || rawSymptoms.note || JSON.stringify(rawSymptoms);
                      }
                    }
                    return symptoms;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default VisitHistory;
