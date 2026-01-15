import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Tag, Empty, Spin } from 'antd';
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
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');
  
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
      
      // Load pharmacy name if pharmacyId is provided
      if (pharmacyId) {
        try {
          const storeRes = await fetch(API.drugStores.getByDocumentId(pharmacyId), {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (storeRes.ok) {
            const storeData = await storeRes.json();
            const store = storeData.data?.[0] || storeData.data;
            if (store) {
              const name = store.attributes?.name_th || store.name_th || '';
              setPharmacyName(name);
              
              // Try to find lead pharmacist name
              const profiles = store.attributes?.pharmacy_profiles?.data || store.pharmacy_profiles;
              if (profiles && profiles.length > 0) {
                const leadPharmacist = profiles[0].attributes || profiles[0];
                const pharmacistUser = leadPharmacist.users_permissions_user?.data?.attributes || leadPharmacist.users_permissions_user;
                if (pharmacistUser?.full_name) {
                  setPharmacistName(pharmacistUser.full_name);
                }
              }
            }
          }
        } catch (err) {
          console.error('Error loading pharmacy info:', err);
        }
      }
      
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
      <div className="h-full flex flex-col bg-[#f8fafc] font-prompt overflow-hidden">
        <HomeHeader pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
        <main className="flex-1 w-full px-4 flex flex-col items-center justify-center overflow-hidden">
          <div className="flex flex-col items-center justify-center animate-in fade-in duration-700">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-4 bg-indigo-50 rounded-full flex items-center justify-center text-2xl">📜</div>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">กำลังดึงข้อมูลประวัติการรักษา</h3>
            <p className="text-slate-400 font-medium mt-2">กรุณารอสักครู่ ระบบกำลังสื่อสารกับฐานข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  const user = customer?.attributes?.users_permissions_user?.data?.attributes || customer?.users_permissions_user;

  return (
    <div className="h-full flex flex-col bg-[#f1f5f9] font-prompt text-slate-900 overflow-hidden">
      <HomeHeader pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
      
      <main className="flex-1 w-full px-6 py-4 overflow-y-auto">
        {/* Profile Premium Card */}
        <div className="mb-8 relative group">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-400/10 blur-[80px] rounded-full group-hover:bg-indigo-400/15 transition-colors"></div>
          
          <div className="relative overflow-hidden p-6 md:p-8 bg-white/70 backdrop-blur-3xl border border-white/60 rounded-[2.5rem] shadow-2xl shadow-indigo-100/40">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-indigo-200 shrink-0">
                {(user?.full_name || user?.username || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                   <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded-full uppercase tracking-widest leading-none">
                     ประวัติสุขภาพ
                   </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-1">
                  {user?.full_name || user?.username}
                </h1>
                <p className="text-slate-500 font-medium text-sm leading-relaxed">
                  รวบรวมข้อมูลการเข้ารับบริการ{pharmacyId ? ' ณ ร้านยานี้' : 'ทั้งหมดของคุณ'}
                </p>
              </div>
              <div className="shrink-0 bg-white/50 border border-slate-100 rounded-3xl p-6 text-center">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">จำนวนการรับบริการ</div>
                 <div className="text-4xl font-black text-indigo-600">{visits.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-12">
          {visits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
              {visits.map((visit) => (
                <div 
                  key={visit.id} 
                  className="group relative bg-white/80 backdrop-blur-xl rounded-[3rem] border border-white p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer flex flex-col justify-between overflow-hidden" 
                  onClick={() => handleViewDetail(visit)}
                >
                  {/* Hover Decoration */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] group-hover:bg-indigo-500/10 transition-colors"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                        <span className="text-base">📅</span>
                        <span className="text-[10px] md:text-xs font-black text-slate-600">{formatThaiDate(visit.createdAt)}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg ${
                        visit.type === 'customer_assignment' 
                          ? 'bg-blue-500 text-white shadow-blue-100' 
                          : (visit.type === 'message' ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-orange-500 text-white shadow-orange-100')
                      }`}>
                        {visit.type === 'customer_assignment' ? 'รับบริการใหม่' : (visit.type === 'message' ? 'ติดตามผล' : 'อัปเดตข้อมูล')}
                      </span>
                    </div>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-50 shadow-sm group-hover:border-indigo-100 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shrink-0">🏥</div>
                        <div className="min-w-0">
                          <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ชื่อสถานบริการ</div>
                          <div className="text-base font-black text-slate-800 leading-tight truncate">
                            {visit.drug_store?.attributes?.name_th || visit.drug_store?.name_th || 'ไม่ระบุชื่อร้านยา'}
                          </div>
                        </div>
                      </div>
                      
                      {(visit.data?.symptoms || visit.data?.Customers_symptoms || visit.data?.data?.symptoms) && (
                        <div className="px-4">
                          <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                             <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                             บันทึกอาการ
                          </div>
                          <div className="text-slate-600 text-xs line-clamp-2 leading-relaxed font-bold italic">
                            "{renderSafeText(visit.data?.symptoms?.main || visit.data?.symptoms || visit.data?.Customers_symptoms || visit.data?.data?.symptoms)}"
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative z-10 flex items-center justify-between p-1 mt-auto">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 group-hover:bg-indigo-600 text-white rounded-lg transition-all duration-300 transform group-hover:translate-x-1">
                        <span className="text-[10px] font-black uppercase tracking-widest">ดูรายละเอียด</span>
                        <span className="text-xs font-black">→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/40 backdrop-blur rounded-[3rem] border-2 border-dashed border-white p-16 text-center">
              <div className="text-7xl mb-8 filter grayscale opacity-20 transform -rotate-12">🗂️</div>
              <h3 className="text-2xl font-black text-slate-400 mb-2 tracking-tight">ไม่พบประวัติการเข้ารับบริการ</h3>
              <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed text-sm">ข้อมูลการรักษาและคำแนะนำจากร้านยาจะรวบรวมไว้ที่นี่ เมื่อคุณเริ่มเข้ารับการปรึกษา</p>
            </div>
          )}
        </div>
        
        <div className="flex justify-center mt-6 mb-4">
           <button 
             className="group px-8 py-3.5 bg-white border border-slate-200 text-slate-800 font-black rounded-2xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-lg hover:shadow-xl hover:shadow-slate-200 active:scale-95 flex items-center gap-3"
             onClick={() => navigate(-1)}
           >
             <span className="text-xl transition-transform group-hover:-translate-x-1">←</span>
             <span className="text-sm">กลับหน้าก่อนหน้า</span>
           </button>
        </div>
      </main>
    </div>
  );
}

export default CustomerVisitHistory;
