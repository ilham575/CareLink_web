import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
// Footer is rendered globally in App.js
import dayjs from 'dayjs';
import { API } from '../../../utils/apiConfig';

function CustomerPageStaff() {
  const { id: pharmacyId } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const userDocumentId = localStorage.getItem('user_documentId');

        if (!userDocumentId) {
          toast.error('ไม่พบข้อมูลผู้ใช้');
          return;
        }

        // โหลดข้อมูล staff profile เพื่อเอา documentId
        const staffRes = await fetch(
          API.staffProfiles.list(`filters[users_permissions_user][documentId][$eq]=${userDocumentId}&filters[drug_store][documentId][$eq]=${pharmacyId}`),
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );

        if (!staffRes.ok) throw new Error('ไม่สามารถโหลดข้อมูล Staff ได้');

        const staffData = await staffRes.json();
        const staffProfile = staffData.data?.[0];

        if (!staffProfile) {
          toast.error('ไม่พบข้อมูล Staff Profile');
          return;
        }

        // โหลด notifications ที่ส่งมาให้พนักงานคนนี้
        // รองรับทั้ง customer_assignment (ครั้งแรก) และ customer_assignment_update (อัพเดต)
        const notifRes = await fetch(
          API.notifications.list(`filters[staff_profile][documentId][$eq]=${staffProfile.documentId}&filters[type][$in][0]=customer_assignment&filters[type][$in][1]=customer_assignment_update&populate=*&sort[0]=createdAt:desc`),
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setNotifications(notifData.data || []);

          // Extract unique customers from notifications
          const customerMap = new Map();
          (notifData.data || []).forEach(notif => {
            const customerProfile = notif.customer_profile;
            const d = notif.data || {};
            const innerData = d.data || {};

            // หา customer ID จาก priority สูงสุด ไปต่ำสุด
            let customerId = null;
            let full_name = '';

            // 1. ลองดึงจาก customer_profile relation
            if (customerProfile && customerProfile.documentId) {
              customerId = customerProfile.documentId;
              full_name = customerProfile.users_permissions_user?.full_name || innerData.full_name || d.customer_name || 'ไม่ระบุ';
              
              customerMap.set(customerId, {
                ...customerProfile,
                // Override ด้วย snapshot จาก notification (ตามรอบที่เภสัชกรบันทึก)
                Customers_symptoms: innerData.symptoms || d.symptoms || customerProfile.Customers_symptoms,
                symptom_history: innerData.symptom_history || d.symptom_history || innerData.history || d.history || (typeof (innerData.symptoms || d.symptoms) === 'object' ? (innerData.symptoms || d.symptoms)?.history : customerProfile.symptom_history),
                symptom_note: innerData.symptom_note || d.symptom_note || innerData.note || d.note || (typeof (innerData.symptoms || d.symptoms) === 'object' ? (innerData.symptoms || d.symptoms)?.note : customerProfile.symptom_note),
                congenital_disease: innerData.disease || d.disease || customerProfile.congenital_disease,
                Allergic_drugs: (innerData.allergy || d.allergy) ? { allergy: innerData.allergy || d.allergy } : customerProfile.Allergic_drugs,
                Follow_up_appointment_date: innerData.follow_up_date || d.follow_up_date || innerData.appointment_date || d.appointment_date || customerProfile.Follow_up_appointment_date,
                notification: notif,
                _fromRelation: true
              });
              return;
            }

            // 2. ลองดึงจาก notif.data.customer_documentId (stored in notification data)
            if (d.customer_documentId || innerData.customer_documentId) {
              customerId = d.customer_documentId || innerData.customer_documentId;
              full_name = d.customer_name || innerData.full_name || 'ไม่ระบุ';
            }

            // 3. ถ้ายังไม่มี documentId ให้ใช้ customer_name เป็น key เพื่อ dedup ตามชื่อ
            if (!customerId) {
              full_name = innerData.full_name || d.customer_name || d.full_name || d.name || d.patient_name || d.patient_full_name || 'ไม่ระบุ';
              
              // Parse ชื่อจาก message ถ้าไม่มีใน data
              if (full_name === 'ไม่ระบุ' && notif.message) {
                const match = notif.message.match(/ได้รับ(?:อัพเดต)?(?:มอบหมายดูแล)?ผู้ป่วย:\s*([^\n]+)/);
                if (match) {
                  full_name = match[1].trim();
                }
              }

              // ใช้ customer_name เป็น key (ถ้ามี) หรือใช้ notification id
              customerId = full_name && full_name !== 'ไม่ระบุ' ? `name_${full_name}` : `notif_${notif.documentId || notif.id}`;
            }

            // ถ้า customer อยู่ใน map แล้ว ให้อัพเดต notification (เพราะ query เรียงตาม createdAt:desc)
            // สามารถ update notification เพื่อเห็นล่าสุด
            const existing = customerMap.get(customerId);
            if (existing) {
              // เก็บ latest notification ไว้
              existing.notification = notif;
              return;
            }

            const userObj = {
              full_name: full_name,
              phone: innerData.phone || d.customer_phone || d.phone || d.tel || d.mobile || '',
              email: innerData.email || d.email || ''
            };

            customerMap.set(customerId, {
              documentId: customerId,
              users_permissions_user: userObj,
              Customers_symptoms: innerData.symptoms || d.symptoms || '',
              symptom_history: innerData.symptom_history || d.symptom_history || innerData.history || d.history || (typeof (innerData.symptoms || d.symptoms) === 'object' ? (innerData.symptoms || d.symptoms)?.history : ''),
              symptom_note: innerData.symptom_note || d.symptom_note || innerData.note || d.note || (typeof (innerData.symptoms || d.symptoms) === 'object' ? (innerData.symptoms || d.symptoms)?.note : ''),
              Allergic_drugs: (innerData.allergy || d.allergy) ? { allergy: innerData.allergy || d.allergy } : null,
              congenital_disease: innerData.disease || d.disease || '',
              Follow_up_appointment_date: innerData.follow_up_date || d.follow_up_date || innerData.appointment_date || d.appointment_date || null,
              notification: notif,
              _fromNotificationOnly: true
            });
          });

          setCustomers(Array.from(customerMap.values()));
        }

        // โหลดข้อมูลร้านยา
        const pharmacyRes = await fetch(
          `${API.drugStores.delete(pharmacyId)}`,
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );

        if (pharmacyRes.ok) {
          const pharmacyData = await pharmacyRes.json();
          setPharmacy(pharmacyData.data);
        }

      } catch (error) {
        console.error('Error loading data:', error);
        toast.error(error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [pharmacyId]);

  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm) return true;
    const user = customer.users_permissions_user;
    const fullName = user?.full_name || '';
    const phone = user?.phone || '';
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           phone.includes(searchTerm);
  });

  const handleViewDetail = (customer) => {
    // Navigate to StaffVisitHistory to see all visits/notifications for this customer
    navigate(`/drug_store_staff/${pharmacyId}/customer/${customer.documentId}/history`);
  };

  const formatThaiDate = (dateStr) => {
    if (!dateStr) return 'ไม่มีวันนัด';
    const d = dayjs(dateStr);
    if (!d.isValid()) return 'ไม่มีวันนัด';
    const months = [
      '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    return `${d.date()} ${months[d.month() + 1]} ${d.year() + 543}`;
  };

  // Helper: Parse allergies to support both single and multiple allergies
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-x-hidden">
      {/* Decorative Background Bubbles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-200/30 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl opacity-50" />
      </div>

      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 max-w-7xl">
        {/* Header Section */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/60 p-6 mb-8 border border-white/40 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600" />
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <span className="text-3xl">📋</span>
              ข้อมูลลูกค้าที่ได้รับมอบหมาย
            </h2>
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 shadow-sm"
                onClick={() => navigate(`/staffHome`)}
              >
                <span className="text-lg">←</span> กลับ
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-10 group">
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือ เบอร์โทรศัพท์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-6 py-4 pl-14 bg-white/80 backdrop-blur-sm border-2 border-slate-100 rounded-[22px] text-lg text-slate-700 shadow-md shadow-slate-200/50 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all group-hover:shadow-lg"
          />
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl filter grayscale-[0.5] group-focus-within:grayscale-0 transition-all">🔍</span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="bg-white/50 backdrop-blur-sm rounded-[32px] p-16 text-center border-2 border-dashed border-slate-200 flex flex-col items-center justify-center space-y-4">
            <div className="text-7xl mb-4 animate-bounce duration-1000">📭</div>
            <h3 className="text-2xl font-bold text-slate-800">ยังไม่มีลูกค้าที่ได้รับมอบหมาย</h3>
            <p className="text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
              เมื่อเภสัชกรส่งข้อมูลลูกค้ามาให้ดูแล ข้อมูลจะแสดงที่นี่โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredCustomers.map(customer => {
              const notification = customer.notification;
              const notifData = notification?.data || {};

              const user = (
                customer.users_permissions_user?.data?.attributes ||
                customer.attributes?.users_permissions_user?.data?.attributes ||
                customer.users_permissions_user?.attributes ||
                customer.users_permissions_user ||
                {}
              );

              const customerDocumentId = customer.documentId || customer.attributes?.documentId || null;
              const followUpDate = customer.Follow_up_appointment_date || customer.attributes?.Follow_up_appointment_date || null;

              return (
                <div 
                  className="bg-white rounded-[28px] border border-slate-100 shadow-lg shadow-slate-200/50 overflow-hidden relative group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col" 
                  key={customerDocumentId || customer.id || Math.random()}
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Card Header */}
                  <div className="p-6 pb-4 flex items-center gap-5 bg-gradient-to-b from-slate-50/50 to-transparent">
                    <div className="relative group/avatar">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-sky-500/30 group-hover/avatar:scale-110 transition-transform duration-500">
                        {(user?.full_name?.charAt(0) || 'C').toUpperCase()}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="text-xl font-bold text-slate-800 truncate leading-tight group-hover:text-sky-600 transition-colors">
                        {(() => {
                          let displayName = 
                            notifData?.customer_name ||
                            user?.full_name || 
                            notifData?.full_name || 
                            notifData?.name || 
                            notifData?.patient_name || 
                            notifData?.patient_full_name || 
                            customer?.full_name ||
                            customer?.attributes?.full_name ||
                            'ไม่พบชื่อ';
                          
                          if (displayName === 'ไม่พบชื่อ' && notification?.message) {
                            const match = notification.message.match(/ได้รับอัพเดตผู้ป่วย:\s*([^\n]+)|ได้รับมอบหมายดูแลผู้ป่วย:\s*([^\n]+)/);
                            if (match) displayName = (match[1] || match[2]).trim();
                          }
                          return displayName;
                        })()}
                      </h3>
                      <p className="text-slate-400 text-sm font-medium">@{user?.username || notifData?.username || 'user'}</p>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="px-6 py-4 space-y-4 flex-grow">
                    <div className="grid grid-cols-1 gap-3">
                      {(customer.congenital_disease || customer.attributes?.congenital_disease) && (
                        <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-2xl border border-blue-100 transition-colors group-hover:bg-blue-50">
                          <span className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm">🏥</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">โรคประจำตัว</span>
                            <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">
                              {customer.congenital_disease || customer.attributes?.congenital_disease}
                            </span>
                          </div>
                        </div>
                      )}

                      {(() => {
                        const allergyData = customer.Allergic_drugs || customer.attributes?.Allergic_drugs || notifData.allergy;
                        if (!allergyData) return null;
                        const allergyText = formatAllergy(allergyData);
                        return allergyText && allergyText !== 'ไม่มีข้อมูล' && (
                          <div className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-100 transition-colors group-hover:bg-amber-50">
                            <span className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm">⚠️</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-500/80">ยาที่แพ้</span>
                              <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">
                                {allergyText}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {followUpDate && (
                      <div className="bg-sky-50 rounded-[20px] p-4 border border-sky-100 flex items-center justify-between group-hover:bg-sky-500 group-hover:border-sky-500 transition-all duration-500">
                        <div className="flex items-center gap-3">
                           <span className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-lg shadow-sm group-hover:scale-90 transition-transform">📅</span>
                           <div className="flex flex-col">
                              <span className="text-[10px] uppercase font-bold text-sky-400 group-hover:text-sky-100 transition-colors">นัดครั้งถัดไป</span>
                              <span className="text-slate-800 font-black group-hover:text-white transition-colors">{formatThaiDate(followUpDate)}</span>
                           </div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-sky-400 group-hover:bg-sky-200 transition-colors" />
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="p-6 pt-0 mt-auto">
                    <button
                      className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-[22px] font-bold text-lg hover:bg-sky-600 transition-all duration-300 shadow-xl shadow-slate-200 hover:shadow-sky-500/30 active:scale-95 group-hover:tracking-wider transform"
                      onClick={() => handleViewDetail(customer)}
                    >
                      <span className="text-xl">👁️</span>
                      ดูรายละเอียด
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default CustomerPageStaff;
