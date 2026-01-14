import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Tag, Empty, Spin } from 'antd';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { API } from '../../../utils/apiConfig';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';

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

// Helper to safely render text that might be an object
const renderSafeText = (val) => {
  if (typeof val === 'object' && val !== null) {
    if (val.main) return val.main;
    if (val.history) return val.history;
    return JSON.stringify(val);
  }
  return val;
};

function CustomerVisitHistory() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');

  useEffect(() => {
    loadData();
  }, [customerDocumentId, pharmacyId]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('jwt');
      
      // Load customer profile
      const customerRes = await fetch(
        API.customerProfiles.getByIdBasic(customerDocumentId),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลได้');
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
      
      // Load all visits (notifications) for this customer
      // Filter by pharmacy if pharmacyId is provided
      let filter = `filters[customer_profile][documentId][$eq]=${customerDocumentId}`;
      if (pharmacyId) {
        filter += `&filters[drug_store][documentId][$eq]=${pharmacyId}`;
      }
      
      // We want the main assignment, updates, or messages
      filter += `&filters[type][$in][0]=customer_assignment&filters[type][$in][1]=customer_assignment_update&filters[type][$in][2]=message`;
      
      const notifRes = await fetch(
        API.notifications.list(`${filter}&populate=*&sort[0]=createdAt:desc`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setVisits(notifData.data || []);
      }
      
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (notif) => {
    const notifId = notif.documentId || notif.id;
    const storeId = notif.drug_store?.documentId || notif.drug_store?.id;
    navigate(`/customer_detail_view/${customerDocumentId}?notifId=${notifId}${storeId ? `&pharmacyId=${storeId}` : ''}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeHeader />
        <main className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
            <div className="relative h-20 w-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-orange-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-900 font-bold text-lg">กำลังโหลดประวัติการรักษา...</p>
            <p className="text-gray-400 text-sm mt-2">กรุณารอสักครู่</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const user = customer?.attributes?.users_permissions_user?.data?.attributes || customer?.users_permissions_user;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeHeader />
      <main className="flex-grow max-w-6xl mx-auto w-full px-4 py-8">
        {/* Customer Header */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 mb-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6">
            <div className="h-48 w-48 bg-orange-50 rounded-full opacity-50"></div>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
              <span className="h-1 w-8 bg-orange-500 rounded-full"></span>
              Service History
            </h2>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="h-20 w-20 bg-gradient-to-br from-orange-400 to-rose-500 rounded-2xl flex items-center justify-center text-3xl text-white font-black shadow-lg shadow-orange-200">
                {(user?.full_name || user?.username || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                 <div className="text-3xl md:text-4xl font-black text-gray-900 mb-1 leading-tight">
                   {user?.full_name || user?.username}
                 </div>
                 <div className="text-gray-500 font-medium">
                   ข้อมูลการเข้ารับบริการทั้งหมดของคุณที่บันทึกในระบบ
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          {visits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visits.map((visit) => (
                <div key={visit.id} 
                     className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col" 
                     onClick={() => handleViewDetail(visit)}>
                  <div className="p-6 flex-grow">
                    <div className="flex items-start justify-between mb-6">
                      <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 flex items-center gap-2">
                        <span className="text-sm">📅</span>
                        <span className="text-xs font-bold text-gray-600">{formatThaiDate(visit.createdAt)}</span>
                      </div>
                      <Tag color={visit.type === 'customer_assignment' ? 'blue' : (visit.type === 'message' ? 'green' : 'orange')}
                           className="m-0 rounded-full border-none px-3 font-black text-[10px] uppercase shadow-sm">
                        {visit.type === 'customer_assignment' ? 'รับบริการ' : (visit.type === 'message' ? 'ติดตาม' : 'อัพเดต')}
                      </Tag>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">สถานพยาบาล / ร้านยา</div>
                        <div className="text-gray-900 font-bold flex items-center gap-2">
                          <span className="text-lg">📍</span> {visit.drug_store?.name_th || 'ไม่ระบุ'}
                        </div>
                      </div>
                      
                      {(visit.data?.symptoms || visit.data?.Customers_symptoms || visit.data?.data?.symptoms) && (
                        <div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">สรุปอาการ</div>
                          <div className="text-gray-600 text-sm line-clamp-3 leading-relaxed font-medium">
                            {renderSafeText(visit.data?.symptoms?.main || visit.data?.symptoms || visit.data?.Customers_symptoms || visit.data?.data?.symptoms)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between group-hover:bg-orange-500 transition-colors duration-300">
                    <span className="text-xs font-bold text-gray-500 group-hover:text-white transition-colors capitalize">
                      แตะเพื่อดูรายละเอียด
                    </span>
                    <span className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-orange-500 shadow-sm group-hover:scale-110 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-20 text-center">
              <div className="text-7xl mb-6 opacity-20 grayscale">📜</div>
              <h3 className="text-xl font-bold text-gray-400 mb-2">ยังไม่มีประวัติการเข้ารับบริการ</h3>
              <p className="text-gray-400 max-w-xs mx-auto">ประวัติการรักษาของคุณจะปรากฏที่นี่เมื่อคุณเข้ารับบริการกับร้านยาในเครือข่าย</p>
            </div>
          )}
        </div>
        
        <div className="flex justify-center mt-4 mb-12">
           <button 
             className="px-10 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95 flex items-center gap-3"
             onClick={() => navigate(-1)}
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
             กลับหน้าหลัก
           </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default CustomerVisitHistory;
