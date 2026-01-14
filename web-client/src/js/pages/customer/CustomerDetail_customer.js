import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
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
    if (val.main || val.note || val.history) {
      return val.main || val.note || val.history || '';
    }
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
  const [allergyDetailModal, setAllergyDetailModal] = useState({ 
    open: false, 
    allergies: [] 
  });
  const [notifData, setNotifData] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const notifId = searchParams.get('notifId');

  useEffect(() => {
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
          if (store?.pharmacy_profiles && store.pharmacy_profiles.length > 0) {
             const profile = store.pharmacy_profiles[0];
             const user = profile?.users_permissions_user;
             const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : (profile?.full_name || '');
             setPharmacistName(name);
          }
        } else if (custAttrs?.drug_stores && custAttrs.drug_stores.length > 0) {
          const store = custAttrs.drug_stores[0].attributes || custAttrs.drug_stores[0];
          setPharmacyName(store.name_th || '');

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
    // Navigate the user to the Edit Symptoms page for this customer
    // Pass availableDrugs and notifId (if exists) via state
    const stateData = { 
      availableDrugs,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-prompt">
        <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-4"></div>
            <p className="text-slate-600 text-lg font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-prompt">
        <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">ไม่พบข้อมูลลูกค้า</h3>
            <p className="text-slate-400">กรุณาตรวจสอบข้อมูลอีกครั้ง</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const customerData = customer.attributes || customer;
  const user = customerData.users_permissions_user;

  // Use data from notification if viewing history
  const displayData = notifData && notifData.data ? {
    ...customerData,
    Customers_symptoms: notifData.data.data?.symptoms || notifData.data.symptoms || notifData.data.Customers_symptoms || customerData.Customers_symptoms,
    prescribed_drugs: notifData.data.data?.prescribed_drugs || notifData.data.prescribed_drugs || customerData.prescribed_drugs,
    Follow_up_appointment_date: notifData.data.data?.appointment_date || notifData.data.appointment_date || notifData.data.Follow_up_appointment_date || customerData.Follow_up_appointment_date
  } : customerData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-prompt">
      {/* Global ToastContainer in App.js */}
      <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {notifData && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl shadow-lg shadow-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center text-white font-bold shadow-lg">📜</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Tag color="warning" className="rounded-lg">โหมดประวัติการรักษา</Tag>
                  </div>
                  <span className="text-sm text-amber-800 font-medium">
                    📅 ข้อมูลวันที่: {dayjs(notifData.createdAt).format('DD/MM/YYYY HH:mm')}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/customer_detail_view/${customerDocumentId}`)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-amber-200 hover:shadow-xl transition-all"
              >
                ดูข้อมูลปัจจุบัน
              </button>
            </div>
          </div>
        )}

        {/* Header Summary - แสดงข้อมูลสำคัญ */}
        <div className="mb-8 p-6 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200">
                {user?.full_name?.charAt(0)?.toUpperCase() || displayData.full_name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white shadow-lg"></div>
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-black text-slate-800 mb-2">{user?.full_name || displayData.full_name || 'ไม่พบชื่อ'}</h1>
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">📞</span>
                  {user?.phone || displayData.phone || 'ไม่ระบุเบอร์'}
                </span>
                {displayData.Follow_up_appointment_date && (
                  <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">📅</span>
                    นัดถัดไป: {formatThaiDate(displayData.Follow_up_appointment_date)}
                  </span>
                )}
              </div>
              {pharmacyName && (
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl text-emerald-700 font-medium">
                    <span>🏥</span> {pharmacyName}
                  </span>
                  {pharmacistName && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl text-violet-700 font-medium">
                      <span>👨‍⚕️</span> {pharmacistName}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div 
                onClick={() => navigate(`/customer/visit-history/${customerDocumentId}`)} 
                className="cursor-pointer p-4 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 transition-all hover:shadow-lg hover:shadow-indigo-100 min-w-[120px]"
              >
                <div className="text-3xl mb-2 text-center">📜</div>
                <div className="text-xs font-bold text-slate-600 text-center">ประวัติการรักษา</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-100 min-w-[120px]">
                <div className="text-3xl font-black text-blue-600 mb-1 text-center">{displayData.prescribed_drugs?.length || 0}</div>
                <div className="text-xs font-bold text-slate-600 text-center">รายการยา</div>
              </div>
              {displayData.Allergic_drugs && (() => {
                if (typeof displayData.Allergic_drugs === 'object') {
                  return displayData.Allergic_drugs.allergy || displayData.Allergic_drugs.drug;
                }
                return displayData.Allergic_drugs;
              })() && (
                <div className="p-4 bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl border-2 border-rose-200 min-w-[120px]">
                  <div className="text-3xl mb-2 text-center">⚠️</div>
                  <div className="text-xs font-bold text-rose-600 text-center">มียาที่แพ้</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Tabs
          defaultActiveKey="1"
          type="card"
          className="[&_.ant-tabs-nav]:bg-white [&_.ant-tabs-nav]:rounded-2xl [&_.ant-tabs-nav]:p-2 [&_.ant-tabs-nav]:shadow-lg [&_.ant-tabs-nav]:border-0 [&_.ant-tabs-tab]:rounded-xl [&_.ant-tabs-tab]:font-bold [&_.ant-tabs-tab]:text-slate-600 [&_.ant-tabs-tab-active]:bg-gradient-to-r [&_.ant-tabs-tab-active]:from-indigo-500 [&_.ant-tabs-tab-active]:to-violet-500 [&_.ant-tabs-tab-active]:text-white [&_.ant-tabs-tab-active]:shadow-lg [&_.ant-tabs-content]:mt-6"
        >
          {/* Tab 1: ข้อมูลพื้นฐาน */}
          <Tabs.TabPane tab={<span>📋 ข้อมูลพื้นฐาน</span>} key="1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: ข้อมูลติดต่อ */}
              <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl">👤</div>
                  <h3 className="text-lg font-black text-slate-800">ข้อมูลติดต่อ</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2">
                    <label className="text-sm text-slate-500 font-medium">ชื่อ-นามสกุล:</label>
                    <span className="text-sm font-bold text-slate-700">{displayData.users_permissions_user?.full_name || displayData.full_name || 'ไม่มีข้อมูล'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <label className="text-sm text-slate-500 font-medium">เบอร์โทรศัพท์:</label>
                    <span className="text-sm font-bold text-slate-700">{displayData.users_permissions_user?.phone || displayData.phone || 'ไม่มีข้อมูล'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <label className="text-sm text-slate-500 font-medium">อีเมล:</label>
                    <span className="text-sm font-bold text-slate-700">{displayData.users_permissions_user?.email || displayData.email || 'ไม่มีข้อมูล'}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: ข้อมูลสำคัญ */}
              <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-2xl">⚠️</div>
                  <h3 className="text-lg font-black text-slate-800">ข้อมูลสำคัญ</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-500 font-medium mb-2">ยาที่แพ้:</label>
                    <div>
                      {displayData.Allergic_drugs ? (
                        (() => {
                          const allergies = parseAllergies(displayData.Allergic_drugs);
                          return (
                            <button
                              onClick={() => {
                                setAllergyDetailModal({
                                  open: true,
                                  allergies: allergies
                                });
                              }}
                              className={`w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${allergies.length > 0 ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-200 hover:shadow-xl' : 'bg-slate-100 text-slate-500'}`}
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
                          className="w-full px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm cursor-not-allowed"
                        >
                          ✓ ไม่มี
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 font-medium mb-2">โรคประจำตัว:</label>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm font-bold text-slate-700">{renderSafeText(displayData.congenital_disease) || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          {/* Tab 2: อาการและการติดตาม */}
          <Tabs.TabPane tab={<span>🩺 อาการและการติดตาม</span>} key="2">
            <div className="space-y-6">
              {/* อาการปัจจุบัน */}
              <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">🩺</div>
                  <h3 className="text-lg font-black text-slate-800">อาการ{notifData ? 'ในรอบนี้' : 'ปัจจุบัน'}</h3>
                </div>
                
                {displayData.Customers_symptoms ? (
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{renderSafeText(displayData.Customers_symptoms)}</p>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-xl">
                    <div className="text-5xl mb-3">📝</div>
                    <h4 className="font-bold text-slate-600 mb-1">ไม่มีข้อมูลอาการ</h4>
                  </div>
                )}
              </div>

              {/* การนัดติดตาม */}
              <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">📅</div>
                  <h3 className="text-lg font-black text-slate-800">การนัดติดตาม</h3>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-slate-500 font-medium block mb-1">วันนัดติดตามอาการ:</span>
                      <span className="text-lg font-black text-emerald-700">
                        {displayData.Follow_up_appointment_date ? formatThaiDate(displayData.Follow_up_appointment_date) : 'ยังไม่ได้กำหนด'}
                      </span>
                    </div>
                    {displayData.Follow_up_appointment_date && (
                      <div className={`px-4 py-2 rounded-xl font-bold text-sm ${new Date(displayData.Follow_up_appointment_date) > new Date() ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                        {new Date(displayData.Follow_up_appointment_date) > new Date() ? '📋 กำหนดการ' : '⚠️ ครบกำหนด'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ข้อมูลเตือนสำคัญ */}
              <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-2xl">⚠️</div>
                  <h3 className="text-lg font-black text-slate-800">ข้อมูลสำคัญที่ต้องระวัง</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-rose-50 to-red-50 rounded-xl border-2 border-rose-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-3xl">🚫</div>
                      <h4 className="font-black text-rose-700">ยาที่แพ้</h4>
                    </div>
                    {displayData.Allergic_drugs ? (
                      (() => {
                        const allergies = parseAllergies(displayData.Allergic_drugs);
                        return (
                          <div className="space-y-1">
                            {allergies.map((allergy, idx) => (
                              <p key={idx} className="text-sm font-bold text-rose-600">💊 {allergy.drug || allergy.allergy || 'ไม่ระบุชื่อยา'}</p>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>
                    )}
                  </div>
                  <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border-2 border-violet-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-3xl">🏥</div>
                      <h4 className="font-black text-violet-700">โรคประจำตัว</h4>
                    </div>
                    <p className="text-sm font-bold text-violet-600">{renderSafeText(displayData.congenital_disease) || 'ไม่มีข้อมูล'}</p>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          {/* Tab 3: รายการยา */}
          <Tabs.TabPane tab={<span>💊 รายการยา <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold ml-2">{displayData?.prescribed_drugs?.length || 0}</span></span>} key="3">
            <div className="space-y-6">
              {displayData.prescribed_drugs && displayData.prescribed_drugs.length > 0 ? (
                <>
                  {/* Header */}
                  <div className="p-6 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl shadow-xl text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">💊</div>
                        <div>
                          <h3 className="text-xl font-black mb-1">รายการยา{notifData ? 'ในรอบนี้' : 'ที่กำหนด'}</h3>
                          <p className="text-indigo-100 text-sm font-medium">
                            {user?.full_name || displayData.full_name || 'ผู้ป่วย'}
                          </p>
                        </div>
                      </div>
                      <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                        <span className="text-3xl font-black">{displayData.prescribed_drugs.length}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Drug Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayData.prescribed_drugs.map((drugItem, index) => {
                      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                      const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                      const drug = availableDrugs.find(d => d.documentId === drugId || d.id === drugId);
                      
                      return (
                        <div key={drugId || index} className="relative group p-6 bg-white rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl hover:shadow-indigo-100 transition-all duration-300">
                          {/* Quantity Badge */}
                          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-indigo-200 z-10">
                            x{quantity}
                          </div>

                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xl font-black flex-shrink-0 group-hover:scale-110 transition-transform">
                              Rx
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-lg font-black text-slate-800 mb-1 line-clamp-2">
                                {drug ? drug.name_th : 'กำลังโหลด...'}
                              </h4>
                              <p className="text-sm text-slate-500 font-medium mb-3">
                                {drug ? drug.name_en : '-'}
                              </p>
                              
                              {drug && drug.manufacturer && (
                                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                                  <span className="text-lg">📦</span>
                                  <span className="text-xs text-blue-700 font-bold">{drug.manufacturer}</span>
                                </div>
                              )}
                              
                              {drug && drug.price && (
                                <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 rounded-lg">
                                  <span className="text-emerald-700 font-black">฿{drug.price}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {drug && drug.description && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <p className="text-sm text-slate-600 leading-relaxed">{drug.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-slate-100">
                  <div className="text-7xl mb-4">💊</div>
                  <h3 className="text-xl font-black text-slate-700 mb-2">ยังไม่มีรายการยาที่กำหนด</h3>
                  <p className="text-slate-500">ยังไม่มีข้อมูลรายการยาในระบบ</p>
                </div>
              )}
            </div>
          </Tabs.TabPane>

          {/* Tab 4: ดำเนินการ */}
          <Tabs.TabPane tab={<span>📋 ดำเนินการ</span>} key="4">
            <div className="space-y-6">
              <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-2xl">📋</div>
                  <h3 className="text-xl font-black text-slate-800">เมนูดำเนินการ</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    className="group p-6 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 rounded-2xl border-2 border-slate-200 hover:border-slate-300 transition-all duration-300 shadow-lg hover:shadow-xl"
                    onClick={handleBack}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-500 group-hover:bg-slate-600 flex items-center justify-center text-white text-xl transition-colors">
                        ←
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-black text-slate-800 mb-1">
                          {notifId ? 'กลับไปรายการประวัติ' : 'กลับไปหน้าหลัก'}
                        </h4>
                        <p className="text-sm text-slate-500">กลับไปยังหน้าก่อนหน้า</p>
                      </div>
                    </div>
                  </button>
                  
                  <button 
                    type="button" 
                    className={`group p-6 rounded-2xl border-2 transition-all duration-300 shadow-lg hover:shadow-xl ${
                      !drugsLoaded 
                        ? 'bg-gray-100 border-gray-200 cursor-not-allowed' 
                        : 'bg-gradient-to-br from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 border-indigo-200 hover:border-indigo-300'
                    }`}
                    onClick={handleOpenEditSymptoms}
                    disabled={!drugsLoaded}
                    title={!drugsLoaded ? 'กำลังโหลดข้อมูลยา...' : 'คลิกเพื่ออัพเดตอาการ'}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl transition-colors ${
                        !drugsLoaded 
                          ? 'bg-gray-400' 
                          : 'bg-gradient-to-br from-indigo-500 to-violet-500 group-hover:scale-110'
                      }`}>
                        {!drugsLoaded ? '⏳' : '✏️'}
                      </div>
                      <div className="text-left">
                        <h4 className={`text-lg font-black mb-1 ${!drugsLoaded ? 'text-gray-500' : 'text-slate-800'}`}>
                          {!drugsLoaded ? 'กำลังโหลด...' : 'อัพเดตอาการ'}
                        </h4>
                        <p className={`text-sm ${!drugsLoaded ? 'text-gray-400' : 'text-slate-500'}`}>
                          {!drugsLoaded ? 'รอโหลดข้อมูลยา' : 'แก้ไขข้อมูลอาการผู้ป่วย'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </main>

      <Footer />

      {/* Allergy Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-2xl">💊</div>
            <span className="text-lg font-black text-slate-800">รายละเอียดยาที่แพ้</span>
          </div>
        }
        open={allergyDetailModal.open}
        onCancel={() => setAllergyDetailModal({ open: false, allergies: [] })}
        footer={[
          <button
            key="close"
            onClick={() => setAllergyDetailModal({ open: false, allergies: [] })}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 transition-all duration-300 hover:shadow-lg"
          >
            ปิด
          </button>
        ]}
        centered
        width={600}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '24px' } }}
      >
        {allergyDetailModal.allergies && allergyDetailModal.allergies.length > 0 ? (
          <div className="space-y-4">
            {allergyDetailModal.allergies.map((allergy, idx) => (
              <div
                key={idx}
                className="group p-4 bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 rounded-2xl shadow-lg hover:shadow-xl hover:shadow-rose-100 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">⚠️</span>
                  <div className="flex-1">
                    <div className="text-base font-black text-rose-700 mb-2">
                      💊 {allergy.drug || 'ยาไม่ระบุชื่อ'}
                    </div>
                    {allergy.symptoms && (
                      <div className="text-sm text-slate-600 mb-2">
                        <strong className="text-rose-600">อาการแพ้:</strong> {allergy.symptoms}
                      </div>
                    )}
                    {allergy.date && (
                      <div className="text-xs text-slate-400">
                        <strong>วันที่บันทึก:</strong> {formatThaiDate(allergy.date)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-3">✓</div>
            <div className="text-slate-400 font-medium">ไม่มีข้อมูลยาที่แพ้</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CustomerDetailCustomer;
