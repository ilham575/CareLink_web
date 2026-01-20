import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
// Footer is rendered globally in App.js
import 'react-toastify/dist/ReactToastify.css';
import { Tabs, Modal, Tag } from 'antd';
import dayjs from 'dayjs';
import { API } from '../../../utils/apiConfig';

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

// Helper: Parse allergies to support both single and multiple allergies
function parseAllergies(val) {
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
}

function formatAllergy(val) {
  const allergies = parseAllergies(val);
  if (allergies.length === 0) return 'ไม่มีข้อมูล';
  return allergies.map(a => a.drug || a.allergy || 'ไม่ระบุชื่อยา').join(', ');
}

// Helper: Safely render text that might be an object
function renderSafeText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    // If it's the {main, note, history} structure
    const components = [];
    if (val.main) components.push(`อาการหลัก: ${val.main}`);
    if (val.history) components.push(`ประวัติ: ${val.history}`);
    if (val.note) components.push(`หมายเหตุ: ${val.note}`);
    if (val.followup_symptoms) components.push(`ติดตามอาการ: ${val.followup_symptoms}`);
    
    if (components.length > 0) return components.join('\n');
    
    // Fallback for other objects
    try {
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
}

function CustomerDetailCustomer() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableDrugs, setAvailableDrugs] = useState([]);
  const [drugsLoaded, setDrugsLoaded] = useState(false);
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');
  const [allergyDetailModal, setAllergyDetailModal] = useState({ 
    open: false, 
    allergies: [] 
  });
  const [notifData, setNotifData] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const notifId = searchParams.get('notifId');
  const pharmacyIdFromQuery = searchParams.get('pharmacyId');

  useEffect(() => {
    if (pharmacyIdFromQuery) {
      setPharmacyId(pharmacyIdFromQuery);
    }
    const loadCustomerData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        
        let currentNotifData = null;
        // Load Notification if notifId is present
        if (notifId) {
          try {
            const notifRes = await fetch(
              API.notifications.getById(notifId),
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (notifRes.ok) {
              const resJson = await notifRes.json();
              currentNotifData = resJson.data;
              setNotifData(currentNotifData);
            }
          } catch (err) {
            console.error('Failed to load notification:', err);
          }
        }

        // ดึงข้อมูล customer profile
        const customerRes = await fetch(
          API.customerProfiles.getByIdBasic(customerDocumentId),
          { headers: { Authorization: token ? `Bearer ${token}` : "" } }
        );
        
        if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
        
        const customerData = await customerRes.json();
        setCustomer(customerData.data);

        // ดึงชื่อร้านยาและเภสัชกรที่ติดตามอาการ
        const custAttrs = customerData.data?.attributes || customerData.data;
        
        // If we have notification, use its pharmacy info
        if (currentNotifData && currentNotifData.drug_store) {
          const store = currentNotifData.drug_store;
          setPharmacyName(store.name_th || '');
          setPharmacyId(store.documentId || store.id || '');
          if (store?.pharmacy_profiles && store.pharmacy_profiles.length > 0) {
             const profile = store.pharmacy_profiles[0];
             const user = profile?.users_permissions_user;
             const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : (profile?.full_name || '');
             setPharmacistName(name);
          }
        } else if (custAttrs?.drug_stores && custAttrs.drug_stores.length > 0) {
          const store = custAttrs.drug_stores[0].attributes || custAttrs.drug_stores[0];
          setPharmacyName(store.name_th || '');
          setPharmacyId(store.documentId || store.id || '');

          if (store?.pharmacy_profiles && store.pharmacy_profiles.length > 0) {
            const profile = store.pharmacy_profiles[0].attributes || store.pharmacy_profiles[0];
            const user = profile?.users_permissions_user?.data?.attributes || profile?.users_permissions_user;
            const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : (profile?.full_name || '');
            setPharmacistName(name);
          }
        }

        // ดึงรายการยาทั้งหมด
        const drugsRes = await fetch(
          API.drugs.listWithBatches(),
          { headers: { Authorization: token ? `Bearer ${token}` : "" } }
        );
        
        if (drugsRes.ok) {
          const drugsData = await drugsRes.json();
          const drugs = (drugsData.data || []).map(d => ({
            id: d.id,
            documentId: d.documentId,
            name_th: d.name_th,
            name_en: d.name_en,
            price: d.price,
            description: d.description,
            drug_batches: d.drug_batches,
            drug_store: d.drug_store
          }));
          setAvailableDrugs(drugs);
          setDrugsLoaded(true);
        }

      } catch (e) {
        console.error('❌ Error fetching data:', e);
        toast.error('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };

    loadCustomerData();
  }, [customerDocumentId, notifId]);

  const handleBack = () => {
    // If we have notification data, it means we came from History
    if (notifId) {
      navigate(-1);
    } else {
      navigate('/customerHome');
    }
  };

  const handleOpenEditSymptoms = () => {
    // กรองรายการยาที่สั่งจ่ายเพื่อส่งไปให้ลูกค้าเลือกในหน้าถัดไป
    const prescribed = displayData.prescribed_drugs || [];
    
    const prescribedDrugsOnly = prescribed.map(p => {
      const dId = p.drugId || p.documentId || p.id;
      // ค้นหาชื่อยาจากฐานข้อมูลยา (availableDrugs) เพื่อให้ได้ชื่อที่ถูกต้อง
      const masterDrug = availableDrugs.find(d => 
        String(d.id) === String(dId) || String(d.documentId) === String(dId)
      );

      return {
        id: dId,
        name_th: masterDrug?.name_th || p.name_th || p.name || p.drug || 'ไม่ระบุชื่อยา',
        name_en: masterDrug?.name_en || p.name_en || ''
      };
    });

    // Navigate the user to the Edit Symptoms page for this customer
    // Pass ONLY prescribed drugs and notifId (if exists) via state
    const stateData = { 
      availableDrugs: prescribedDrugsOnly,
      notifId,
      notificationData: notifData // Pass the entire notification data
    };
    
    navigate(`/customer/edit_symptoms/${customerDocumentId}`, { 
      state: stateData
    });
  };

  // Delete feature removed per request

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc] font-prompt">
        <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
        <main className="flex-1 w-full px-4 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center animate-in fade-in duration-700">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-4 bg-indigo-50 rounded-full flex items-center justify-center text-2xl">💊</div>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">กำลังโหลดข้อมูลสุขภาพของคุณ</h3>
            <p className="text-slate-400 font-medium mt-2">กรุณารอสักครู่ ระบบกำลังจัดเตรียมข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc] font-prompt">
        <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
        <main className="flex-1 w-full px-4 flex items-center justify-center">
          <div className="max-w-md mx-auto bg-white p-12 rounded-[3.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner shadow-rose-100/50">😔</div>
            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">ไม่พบข้อมูลลูกค้า</h3>
            <p className="text-slate-400 font-medium mb-10 leading-relaxed">ข้อมูลที่คุณค้นหาอาจถูกย้าย หรือคุณไม่มีสิทธิ์ในการเข้าถึงส่วนนี้</p>
            <button 
              onClick={() => navigate('/customerHome')}
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black transition-all hover:bg-black hover:-translate-y-1 active:scale-95 shadow-xl shadow-slate-200"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </main>
      </div>
    );
  }

  const customerData = customer.attributes || customer;
  const user = customerData.users_permissions_user;

  // Use data from notification if viewing history
  const displayData = notifData && notifData.data ? {
    ...customerData,
    Customers_symptoms: notifData.data.data?.followup_symptoms || notifData.data.followup_symptoms || notifData.data.data?.symptoms || notifData.data.symptoms || notifData.data.Customers_symptoms || customerData.Customers_symptoms,
    Allergic_drugs: notifData.data.data?.Allergic_drugs || notifData.data.Allergic_drugs || customerData.Allergic_drugs,
    prescribed_drugs: notifData.data.data?.prescribed_drugs || notifData.data.prescribed_drugs || customerData.prescribed_drugs,
    Follow_up_appointment_date: notifData.data.data?.appointment_date || notifData.data.appointment_date || notifData.data.Follow_up_appointment_date || customerData.Follow_up_appointment_date
  } : customerData;

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f5f9] font-prompt text-slate-900">
      <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
      
      <main className="flex-1 w-full px-4 py-4">
        {/* Archive Alert */}
        {notifData && (
          <div className="mb-6 group overflow-hidden relative p-5 bg-white/80 backdrop-blur-2xl border border-amber-200 rounded-[2rem] shadow-xl shadow-amber-100/30 transition-all hover:scale-[1.01]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 blur-[60px] -mr-12 -mt-12 group-hover:bg-amber-400/10 transition-colors"></div>
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl text-white shadow-lg shadow-amber-200 animate-pulse">
                  📜
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-amber-200">
                      ประวัติการรักษา
                    </span>
                    <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {dayjs(notifData.createdAt).format('DD/MM/YYYY HH:mm')}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">โหมดตรวจสอบข้อมูลย้อนหลัง</h3>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/customer_detail_view/${customerDocumentId}`)}
                className="w-full md:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-sm transition-all hover:bg-black hover:shadow-xl hover:-translate-y-0.5 active:scale-95 shadow-lg shadow-slate-200"
              >
                ดูข้อมูลปัจจุบัน →
              </button>
            </div>
          </div>
        )}

        {/* Profile Premium Card */}
        <div className="mb-8 relative group">
          {/* Subtle Background Decoration */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-400/10 blur-[80px] rounded-full group-hover:bg-indigo-400/15 transition-colors"></div>

          <div className="relative overflow-hidden p-6 md:p-8 bg-white/70 backdrop-blur-3xl border border-white/60 rounded-[2.5rem] shadow-2xl shadow-indigo-100/40">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
              {/* Avatar Section */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-400 p-1 shadow-xl shadow-indigo-200 group-hover:rotate-2 transition-transform duration-500">
                  <div className="w-full h-full rounded-[1.8rem] bg-white flex items-center justify-center text-4xl font-black text-indigo-600 shadow-inner overflow-hidden">
                    {user?.full_name?.charAt(0)?.toUpperCase() || displayData.full_name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Identity & Contacts */}
              <div className="flex-1 text-center lg:text-left">
                <div className="mb-4">
                  <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-2">
                    {user?.full_name || displayData.full_name || 'ไม่พบชื่อผู้ป่วย'}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg shadow-slate-200">
                      <span>📞</span> {user?.phone || displayData.phone || 'ไม่ระบุเบอร์'}
                    </span>
                    {displayData.Follow_up_appointment_date && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-200">
                        <span>📅</span> นัดถัดไป: {formatThaiDate(displayData.Follow_up_appointment_date)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  {pharmacyName && (
                    <div className="px-4 py-2 bg-white/80 border border-emerald-100 rounded-xl text-emerald-800 font-bold shadow-md shadow-emerald-50/50 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs">🏥</div>
                      <div>
                        <div className="text-[8px] text-emerald-500 uppercase tracking-widest font-black leading-none">ร้านยา</div>
                        <div className="text-xs">{pharmacyName}</div>
                      </div>
                    </div>
                  )}
                  {pharmacistName && (
                    <div className="px-4 py-2 bg-white/80 border border-violet-100 rounded-xl text-violet-800 font-bold shadow-md shadow-violet-50/50 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center text-xs">👨‍⚕️</div>
                      <div>
                        <div className="text-[8px] text-violet-500 uppercase tracking-widest font-black leading-none">เภสัชกร</div>
                        <div className="text-xs">{pharmacistName}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions / Stats */}
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => navigate(`/customer/visit-history/${customerDocumentId}${pharmacyId ? `?pharmacyId=${pharmacyId}` : ''}`)}
                  className="w-20 h-24 bg-white border border-slate-100 rounded-[1.8rem] flex flex-col items-center justify-center gap-1 transition-all hover:bg-slate-50 hover:shadow-lg shadow-md border-b-4 border-b-indigo-500"
                >
                  <div className="text-xl">🗂️</div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">การรับบริการ</div>
                  <div className="text-[10px] font-black text-indigo-600">ประวัติ</div>
                </button>
                <div className="w-20 h-24 bg-white border border-slate-100 rounded-[1.8rem] flex flex-col items-center justify-center gap-1 shadow-md border-b-4 border-b-emerald-500 relative">
                  <div className="text-xl">💊</div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">รายการยา</div>
                  <div className="text-base font-black text-emerald-600 leading-none">{displayData.prescribed_drugs?.length || 0}</div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section with Premium Tabs */}
        <div className="modern-premium-tabs">
          <Tabs
            defaultActiveKey="1"
            className="custom-luxury-tabs"
            items={[
              {
                key: '1',
                label: (
                  <div className="flex flex-col items-center py-2 px-1">
                    <span className="text-xl mb-1">📋</span>
                    <span className="text-xs uppercase tracking-widest font-black">ข้อมูลทั่วไป</span>
                  </div>
                ),
                children: (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <div className="group bg-white/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 shadow-lg hover:shadow-xl transition-all duration-500">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-xl text-indigo-600">👤</div>
                          <h3 className="text-xl font-black text-slate-800 tracking-tight">ข้อมูลผู้ป่วย</h3>
                        </div>
                        {/* Edit Profile Button */}
                        {!notifData && (
                          <button 
                            onClick={() => navigate('/customer/edit_profile')}
                            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 flex items-center gap-2"
                          >
                            <span>✏️</span> แก้ไข
                          </button>
                        )}
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: 'ชื่อ-นามสกุล', value: user?.full_name || displayData.full_name, icon: '🏷️' },
                          { label: 'เบอร์โทรศัพท์', value: user?.phone || displayData.phone, icon: '📱' },
                          { label: 'อีเมลที่ลงทะเบียน', value: user?.email || displayData.email, icon: '✉️' }
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-slate-50">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{item.icon}</span>
                              <span className="text-xs font-bold text-slate-400">{item.label}</span>
                            </div>
                            <span className="text-xs font-black text-slate-700">{item.value || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 shadow-lg overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-400/5 blur-[40px]"></div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-xl text-rose-600">⚠️</div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">ความเสี่ยง / แพ้ยา</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">ประวัติการแพ้ยา</label>
                          {displayData.Allergic_drugs ? (
                            (() => {
                              const allergies = parseAllergies(displayData.Allergic_drugs);
                              return (
                                <button
                                  onClick={() => setAllergyDetailModal({ open: true, allergies })}
                                  className={`w-full group p-4 rounded-2xl transition-all duration-300 ${
                                    allergies.length > 0 
                                      ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-200 hover:scale-[1.01]' 
                                      : 'bg-slate-50 text-slate-400 border border-slate-100'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-left">
                                      <div className="font-black text-base">{allergies.length > 0 ? `พบรายงาน ${allergies.length} รายการ` : 'ยังไม่มีประวัติแพ้ยา'}</div>
                                      <div className={`text-[10px] ${allergies.length > 0 ? 'text-rose-100' : 'text-slate-400'}`}>
                                        {allergies.length > 0 ? 'คลิกเพื่อดูรายละเอียด' : 'ยังไม่เคยบันทึกประวัติ'}
                                      </div>
                                    </div>
                                    {allergies.length > 0 && <span className="text-xl transition-transform group-hover:translate-x-1">→</span>}
                                  </div>
                                </button>
                              );
                            })()
                          ) : (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center text-slate-400 font-bold text-sm">
                              ไม่มีประวัติ
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">โรคประจำตัว</label>
                          <div className="p-4 bg-violet-50/50 border border-violet-100 rounded-2xl flex items-center gap-3">
                            <span className="text-xl">🧬</span>
                            <span className="text-sm font-black text-violet-800">{renderSafeText(displayData.congenital_disease) || 'ไม่มีระบุ'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: '2',
                label: (
                  <div className="flex flex-col items-center py-2 px-1">
                    <span className="text-xl mb-1">🩺</span>
                    <span className="text-xs uppercase tracking-widest font-black">อาการและนัดหมาย</span>
                  </div>
                ),
                children: (
                  <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <div className="bg-white/60 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white border-b-4 border-b-blue-500 shadow-xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl text-blue-600">🩺</div>
                        <div>
                          <h3 className="text-xl font-black text-slate-800 tracking-tight">อาการ{notifData ? 'ในรอบนี้' : 'ปัจจุบัน'}</h3>
                          <p className="text-slate-400 font-medium text-xs">รายละเอียดอาการป่วยที่บันทึกไว้</p>
                        </div>
                      </div>
                      <div className="p-6 bg-white/80 rounded-2xl border border-blue-50 shadow-inner">
                        {displayData.Customers_symptoms ? (
                          <div className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                            {renderSafeText(displayData.Customers_symptoms)}
                          </div>
                        ) : (
                          <div className="text-center py-6 opacity-40">
                            <div className="text-4xl mb-2 text-slate-300">📝</div>
                            <p className="font-bold text-slate-400 text-sm">ยังไม่ได้ระบุอาการ</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="group p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2rem] text-white shadow-lg shadow-emerald-200 transition-all hover:-translate-y-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-xl shadow-lg">📅</div>
                          <h4 className="text-lg font-black">วันนัดติดตามผล</h4>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">ข้อมูลนัดหมาย</div>
                            <div className="text-2xl font-black">
                              {displayData.Follow_up_appointment_date ? formatThaiDate(displayData.Follow_up_appointment_date) : 'ยังไม่มีนัด'}
                            </div>
                          </div>
                          {displayData.Follow_up_appointment_date && (
                             <div className="px-3 py-1 bg-white/20 backdrop-blur rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/30">
                                {new Date(displayData.Follow_up_appointment_date) > new Date() ? 'ในเร็วๆ นี้' : 'ถึงกำหนด'}
                             </div>
                          )}
                        </div>
                      </div>

                      <div className="p-6 bg-white/60 backdrop-blur-2xl rounded-[2rem] border border-white shadow-lg flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-indigo-500/10 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-indigo-600 leading-none">{displayData.prescribed_drugs?.length || 0}</span>
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1">รายการยา</span>
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-800 tracking-tight">การใช้ยาในรอบนี้</h4>
                          <p className="text-slate-400 font-medium text-xs">ยาที่ได้รับตามรายการรักษา</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: '3',
                label: (
                  <div className="flex flex-col items-center py-2 px-1">
                    <span className="text-xl mb-1">💊</span>
                    <span className="text-xs uppercase tracking-widest font-black">ยาที่ได้รับ</span>
                  </div>
                ),
                children: (
                  <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    {displayData.prescribed_drugs && displayData.prescribed_drugs.length > 0 ? (
                      <>
                        <div className="relative overflow-hidden p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-xl">
                          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 blur-[80px] -mr-24 -mt-24"></div>
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                            <div className="flex items-center gap-5">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30">💊</div>
                              <div>
                                <h3 className="text-2xl font-black tracking-tight mb-1 text-white">รายการยาประจำตัว</h3>
                                <p className="text-indigo-200/60 font-medium bg-indigo-500/10 inline-block px-3 py-0.5 rounded-full text-xs">
                                  รับประทานยาอย่างต่อเนื่องตามคำแนะนำ
                                </p>
                              </div>
                            </div>
                            <div className="text-center md:text-right px-6 py-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
                              <div className="text-[8px] text-indigo-300 font-black uppercase tracking-widest mb-0.5">จำนวนยา</div>
                              <div className="text-3xl font-black">{displayData.prescribed_drugs.length}</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                          {displayData.prescribed_drugs.map((drugItem, index) => {
                            const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                            const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                            const drug = availableDrugs.find(d => d.documentId === drugId || d.id === drugId);
                            
                            return (
                              <div key={drugId || index} className="group relative bg-white border border-white rounded-[2rem] p-5 shadow-lg hover:shadow-xl transition-all duration-500 hover:-translate-y-1 border-b-4 border-b-slate-100">
                                <div className="absolute -top-2 -right-2 w-10 h-10 bg-slate-900 text-white rounded-xl flex flex-col items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                                  <div className="text-[6px] font-black uppercase tracking-widest leading-none opacity-50">จำนวน</div>
                                  <div className="text-lg font-black leading-none">{quantity}</div>
                                </div>

                                <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-xl font-black text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                                    Rx
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-lg font-black text-slate-800 mb-0.5 leading-tight group-hover:text-indigo-600 transition-colors">
                                      {drug ? drug.name_th : 'กำลังโหลด...'}
                                    </h4>
                                    <p className="text-xs text-slate-400 font-bold tracking-tight mb-3">
                                      {drug ? drug.name_en : '-'}
                                    </p>
                                    
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {drug && (drug.price > 0) && (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black tracking-widest uppercase">
                                          ฿{drug.price} / หน่วย
                                        </span>
                                      )}
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[8px] font-black tracking-widest uppercase">
                                        ใช้งานปกติ
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {drug && drug.description && (
                                  <div className="mt-4 pt-4 border-t border-slate-50 italic">
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">"{drug.description}"</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-20 bg-white/60 backdrop-blur rounded-[3rem] border border-white border-dashed border-2">
                        <div className="text-6xl mb-4 opacity-20 filter grayscale">💊</div>
                        <h3 className="text-2xl font-black text-slate-400 mb-1">ไม่มีรายการยา</h3>
                        <p className="text-slate-400 font-medium text-sm">ยังไม่พบข้อมูลยาที่กำหนดให้</p>
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: '4',
                label: (
                  <div className="flex flex-col items-center py-2 px-1">
                    <span className="text-xl mb-1">⚡</span>
                    <span className="text-xs uppercase tracking-widest font-black">ดำเนินการ</span>
                  </div>
                ),
                children: (
                  <div className="pt-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <div className="bg-white/60 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white shadow-xl">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-2xl text-white">⚡</div>
                        <div>
                          <h3 className="text-xl font-black text-slate-800 tracking-tight">ดำเนินการจัดการข้อมูล</h3>
                          <p className="text-slate-400 font-medium text-xs">ปรับแต่งข้อมูลหรือจัดทำรายการ</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                          onClick={handleBack}
                          className="group p-6 bg-white border-2 border-slate-50 rounded-[1.8rem] text-left transition-all hover:border-slate-200 hover:shadow-lg hover:-translate-y-0.5"
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl mb-4 transition-colors group-hover:bg-slate-900 group-hover:text-white">←</div>
                          <h4 className="text-lg font-black text-slate-800 mb-1">{notifId ? 'กลับไปรายการประวัติ' : 'กลับไปที่หน้าหลัก'}</h4>
                          <p className="text-slate-400 font-medium text-xs">ย้อนกลับไปยังเมนูก่อนหน้า</p>
                        </button>

                        <button 
                          onClick={handleOpenEditSymptoms}
                          disabled={!drugsLoaded}
                          className={`group p-6 rounded-[1.8rem] text-left transition-all border-2 shadow-lg hover:-translate-y-0.5 ${
                            !drugsLoaded 
                              ? 'bg-slate-50 border-slate-50 cursor-not-allowed opacity-50' 
                              : 'bg-white border-indigo-50 hover:border-indigo-200 hover:shadow-indigo-50'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4 transition-all ${
                            !drugsLoaded ? 'bg-slate-200' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                          }`}>
                            {!drugsLoaded ? '⏳' : '✏️'}
                          </div>
                          <h4 className={`text-lg font-black mb-1 ${!drugsLoaded ? 'text-slate-400' : 'text-slate-800'}`}>
                            {drugsLoaded ? 'บันทึก/อัพเดตสุขภาพ' : 'กำลังโหลดข้อมูล...'}
                          </h4>
                          <p className="text-slate-400 font-medium text-xs">แจ้งข้อมูลสุขภาพเพิ่มเติมให้เภสัชกร</p>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }
            ]}
          />
        </div>
      </main>

      <>
        {/* Modernized Allergy Modal */}
        <Modal
        title={null}
        open={allergyDetailModal.open}
        onCancel={() => setAllergyDetailModal({ open: false, allergies: [] })}
        footer={null}
        centered
        width={480}
        styles={{ 
          content: { padding: 0, borderRadius: '2rem', overflow: 'hidden', border: 'none' },
          mask: { backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.4)' }
        }}
      >
        <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">💊</div>
            <button onClick={() => setAllergyDetailModal({ open: false, allergies: [] })} className="text-white/60 hover:text-white text-xl transition-colors">✕</button>
          </div>
          <h2 className="text-2xl font-black tracking-tightest">ประวัติการแพ้ยา</h2>
          <p className="text-rose-100/70 font-medium text-sm">รายการยาที่ผู้ป่วยเคยมีประวัติแพ้</p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50">
          {allergyDetailModal.allergies && allergyDetailModal.allergies.length > 0 ? (
            <div className="space-y-3">
              {allergyDetailModal.allergies.map((allergy, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-white shadow-md shadow-rose-100/10 group hover:-translate-y-0.5 transition-transform"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-lg">⚠️</div>
                    <div className="text-lg font-black text-rose-600">{allergy.drug || 'ไม่ระบุชื่อยา'}</div>
                  </div>
                  {allergy.symptoms && (
                    <div className="mb-3">
                      <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">อาการที่พบ</div>
                      <p className="text-sm text-slate-600 font-bold bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                        "{allergy.symptoms}"
                      </p>
                    </div>
                  )}
                  {allergy.date && (
                    <div className="text-[8px] text-slate-300 font-bold flex items-center gap-1.5">
                       <span>📅 บันทึกเมื่อ:</span> {formatThaiDate(allergy.date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
               <div className="text-5xl mb-4 opacity-10">✓</div>
               <p className="font-black text-sm">ไม่พบข้อมูลประวัติแพ้ยา</p>
            </div>
          )}
          
          <button
            onClick={() => setAllergyDetailModal({ open: false, allergies: [] })}
            className="w-full mt-6 py-3.5 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all shadow-lg"
          >
            รับทราบและปิด
          </button>
        </div>
      </Modal>

      <style jsx="true">{`
        .custom-luxury-tabs .ant-tabs-nav {
          background: rgba(255, 255, 255, 0.6) !important;
          backdrop-filter: blur(20px) !important;
          border-radius: 2rem !important;
          padding: 0.5rem !important;
          border: 1px solid white !important;
          display: flex !important;
          justify-content: center !important;
          margin-bottom: 24px !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.02) !important;
        }
        .custom-luxury-tabs .ant-tabs-tab {
          border-radius: 1.5rem !important;
          padding: 8px 20px !important;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border: none !important;
          margin: 0 4px !important;
          background: transparent !important;
        }
        .custom-luxury-tabs .ant-tabs-tab-active {
          background: #1e293b !important;
          box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }
        .custom-luxury-tabs .ant-tabs-tab-active .text-xs {
          color: white !important;
        }
        .custom-luxury-tabs .ant-tabs-tab-active .text-xl {
          transform: scale(1.1) rotate(-5deg);
        }
        .custom-luxury-tabs .ant-tabs-ink-bar {
          display: none !important;
        }
      `}</style>
      </>
    </div>
  );
}

export default CustomerDetailCustomer;
