import { useLocation, useNavigate, useParams } from "react-router-dom";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import React, { useEffect, useState } from "react";
import { Modal } from "antd";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dayjs from "dayjs";
import { API, fetchWithAuth } from "../../../utils/apiConfig";

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

function CustomerPage({ id }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [customerList, setCustomerList] = useState([]);
  
  // ใช้ documentId จาก params หรือ props แทน id
  const documentId = params.documentId || id || params.id;

  useEffect(() => {
    if (documentId) {
      // แก้ไขการดึงข้อมูลร้านยา - ใช้ token และเพิ่ม error handling
      const token = localStorage.getItem('jwt');
      fetch(API.drugStores.getByDocumentId(documentId), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })
        .then(res => res.json())
        .then(json => {
          const store = Array.isArray(json.data)
            ? json.data.find(item => item.documentId === documentId)
            : null;

          setPharmacy(store || null);
        })
        .catch(error => {
          console.error('Error fetching drug store:', error);
          setPharmacy(null);
        });
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      const token = localStorage.getItem('jwt');
      // แก้ไขการใช้ filters ให้ถูกต้อง - ใช้ internal ID แทน documentId
      (async () => {
        try {
          // หา internal ID ของร้าน
          const drugStoreRes = await fetch(
            API.drugStores.getByDocumentId(documentId),
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const drugStoreJson = await drugStoreRes.json();
          const targetStore = drugStoreJson.data?.find(store => store.documentId === documentId);
          
          if (!targetStore) {
            setCustomerList([]);
            return;
          }
          
          const drugStoreInternalId = targetStore.id;
          
          // ใช้ field name ที่ถูกต้องจาก schema: drug_stores (many-to-many)
          try {
            const customerRes = await fetch(
              API.customerProfiles.list(`filters[drug_stores][id][$eq]=${drugStoreInternalId}&populate[0]=users_permissions_user&populate[1]=drug_stores`),
              {
                headers: {
                  Authorization: token ? `Bearer ${token}` : "",
                },
              }
            );
            const customerJson = await customerRes.json();
            
            if (customerJson.error) {
              throw new Error(customerJson.error.message);
            }
            
            setCustomerList(Array.isArray(customerJson.data) ? customerJson.data : []);
          } catch (error) {
            console.error('Error with drug_stores field:', error.message);
            
            // Fallback: ดึงข้อมูลทั้งหมดแล้วกรองฝั่ง client
            try {
              console.log('Fallback: fetching all customers and filtering manually');
              const customerRes = await fetch(
                API.customerProfiles.list(`populate[0]=users_permissions_user&populate[1]=drug_stores`),
                {
                  headers: {
                    Authorization: token ? `Bearer ${token}` : "",
                  },
                }
              );
              const customerJson = await customerRes.json();
              
              // กรองข้อมูลในฝั่ง client
              let filteredCustomers = [];
              if (Array.isArray(customerJson.data)) {
                filteredCustomers = customerJson.data.filter(customer => {
                  const stores = customer.drug_stores?.data || customer.attributes?.drug_stores?.data || [];
                  return stores.some(store => store.id == drugStoreInternalId);
                });
              }
              
              console.log('Filtered customers:', filteredCustomers);
              setCustomerList(filteredCustomers);
            } catch (fallbackError) {
              console.error('Fallback also failed:', fallbackError);
              setCustomerList([]);
            }
          }
        } catch (error) {
          console.error('Error fetching customers:', error);
          setCustomerList([]);
        }
      })();
    }
  }, [documentId]);

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage);
    }
  }, [location.state]);

  const deleteCustomer = (customerId, customerDocumentId, userId, customerName) => {
    console.log('[deleteCustomer] Starting delete with:', { customerId, customerDocumentId, userId, customerName });
    
    Modal.confirm({
      title: `ลบลูกค้า "${customerName}"?`,
      content: "ลบข้อมูลลูกค้าและบัญชีผู้ใช้ที่เกี่ยวข้อง (ย้อนกลับไม่ได้)",
      okText: "ลบ",
      okType: "danger",
      cancelText: "ยกเลิก",
      onOk: () =>
        new Promise(async (resolve, reject) => {
          const token = localStorage.getItem("jwt");
          const authHeaders = {
            Authorization: token ? `Bearer ${token}` : "",
            "Cache-Control": "no-store",
          };

          const removeRelation = async () => {
            if (!customerId) return;
            // ตัดความสัมพันธ์ many-to-many กับ drug_stores
            const res = await fetch(
              API.customerProfiles.update(customerDocumentId),
              {
                method: "PUT",
                headers: {
                  ...authHeaders,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  data: {
                    users_permissions_user: null,
                    drug_stores: {
                      disconnect: []
                    }
                  },
                }),
              }
            );
            if (!res.ok) {
              throw new Error("ตัดความสัมพันธ์กับ user ไม่สำเร็จ");
            }
          };

          const deleteCustomerProfile = async () => {
            if (!customerDocumentId) return;
            const res = await fetch(
              API.customerProfiles.update(customerDocumentId),
              { method: "DELETE", headers: authHeaders }
            );
            if (!res.ok && res.status !== 404) {
              throw new Error("ลบข้อมูลลูกค้าไม่สำเร็จ");
            }
          };

          const deleteUser = async () => {
            if (!userId) return;
            const checkRes = await fetch(
              API.customerProfiles.list(`filters[users_permissions_user][id][$eq]=${userId}`),
              { headers: authHeaders }
            );
            const checkJson = await checkRes.json().catch(() => ({}));
            const relatedProfiles = Array.isArray(checkJson?.data) ? checkJson.data : [];
            
            const otherProfiles = relatedProfiles.filter(
              profile => profile.id !== customerId
            );
            if (otherProfiles.length > 0) return;

            try {
              const res = await fetch(
                API.users.getById(userId),
                { method: "DELETE", headers: authHeaders }
              );
              await res.text().catch(() => "");
            } catch (e) {}
          };

          const deleteRelatedNotifications = async () => {
            if (!customerDocumentId) {
              console.log('[deleteRelatedNotifications] No customerDocumentId, returning');
              return;
            }
            try {
              console.log('[deleteRelatedNotifications] Starting for customerDocumentId:', customerDocumentId);
              
              // หา notification ทั้งหมดที่เกี่ยวกับลูกค้าคนนี้
              const notifRes = await fetch(
                API.notifications.list(`filters[customer_profile][documentId][$eq]=${customerDocumentId}&pagination[pageSize]=100`),
                { headers: authHeaders }
              );
              
              console.log('[deleteRelatedNotifications] Query response status:', notifRes.status);
              
              if (!notifRes.ok) {
                console.warn('[deleteRelatedNotifications] Query failed with status:', notifRes.status);
                return;
              }
              
              const notifData = await notifRes.json();
              const notifications = Array.isArray(notifData?.data) ? notifData.data : [];
              
              console.log('[deleteRelatedNotifications] Found notifications:', notifications.length);
              
              // ลบ notification ทั้งหมด
              for (const notif of notifications) {
                try {
                  console.log('[deleteRelatedNotifications] Deleting notification:', notif.documentId);
                  const deleteRes = await fetch(
                    API.notifications.delete(notif.documentId),
                    { method: "DELETE", headers: authHeaders }
                  );
                  console.log('[deleteRelatedNotifications] Delete response status:', deleteRes.status);
                  if (!deleteRes.ok) {
                    console.warn('[deleteRelatedNotifications] Failed to delete:', deleteRes.status);
                  }
                } catch (err) {
                  console.warn('Failed to delete notification:', notif.documentId, err);
                }
              }
              
              console.log('[deleteRelatedNotifications] All notifications deleted successfully');
            } catch (error) {
              console.warn('Error deleting related notifications:', error);
              // ไม่แสดง error toast เพราะเป็น cleanup ที่ไม่จำเป็น
            }
          };

          const refreshList = async () => {
            if (!documentId) return;
            try {
              // หา internal ID ของร้าน
              const drugStoreRes = await fetch(
                API.drugStores.getByDocumentId(documentId),
                { headers: authHeaders }
              );
              const drugStoreJson = await drugStoreRes.json();
              const targetStore = drugStoreJson.data?.find(store => store.documentId === documentId);
              
              if (!targetStore) {
                setCustomerList([]);
                return;
              }
              
              const drugStoreInternalId = targetStore.id;
              
              // ใช้ field name ที่ถูกต้องจาก schema: drug_stores
              try {
                const res = await fetch(
                  API.customerProfiles.list(`filters[drug_stores][id][$eq]=${drugStoreInternalId}&populate[0]=users_permissions_user&populate[1]=drug_stores&_=${Date.now()}`),
                  { headers: authHeaders }
                );
                const js = await res.json();
                
                if (js.error) {
                  throw new Error(js.error.message);
                }
                
                setCustomerList(Array.isArray(js.data) ? js.data : []);
              } catch (error) {
                console.error('Error with refresh, trying fallback:', error.message);
                
                // Fallback: ดึงข้อมูลทั้งหมดแล้วกรองฝั่ง client
                const res = await fetch(
                  API.customerProfiles.list(`populate[0]=users_permissions_user&populate[1]=drug_stores&_=\${Date.now()}`),
                  { headers: authHeaders }
                );
                const js = await res.json();
                
                // กรองข้อมูลในฝั่ง client
                let newList = [];
                if (Array.isArray(js?.data)) {
                  newList = js.data.filter(customer => {
                    const stores = customer.drug_stores?.data || customer.attributes?.drug_stores?.data || [];
                    return stores.some(store => store.id == drugStoreInternalId);
                  });
                }
                
                setCustomerList(newList);
              }
            } catch (error) {
              console.error('Error refreshing customer list:', error);
              setCustomerList([]);
            }
          };

          try {
            await removeRelation();
            await deleteRelatedNotifications(); // เพิ่มการลบ notification
            await deleteCustomerProfile();
            await deleteUser();
            await refreshList();

            Modal.success({ content: "ลบลูกค้าและบัญชีผู้ใช้สำเร็จ" });
            resolve();
          } catch (err) {
            console.error(err);
            Modal.error({ content: err?.message || "เกิดข้อผิดพลาดในการลบลูกค้า" });
            reject(err);
          }
        }),
    });
  };

  // console.log(pharmacy);
  // console.log('Current pharmacy state:', pharmacy);
  // console.log('Current documentId:', documentId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-prompt">
      <HomeHeader pharmacyName={pharmacy?.name_th || pharmacy?.name_en || ''} />
      
      <main className="flex-grow container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 p-8 mb-10 border border-slate-100">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 font-prompt">
            <div className="space-y-1">
              <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold tracking-wider uppercase mb-2">
                Customer Management
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                ลูกค้าประจำร้านยา
              </h2>
              <p className="text-slate-400 font-medium">จัดการข้อมูลผู้ป่วยและประวัติการรักษาในระบบของคุณ</p>
            </div>
            
            <button
              className="group relative px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 overflow-hidden"
              onClick={() => navigate(`/form_customer?pharmacyId=${documentId}`)}
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              <span>เพิ่มข้อมูลลูกค้าใหม่</span>
            </button>
          </div>
        </div>

        {/* Customer List Grid */}
        {customerList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm font-prompt">
            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">ไม่พบข้อมูลลูกค้า</h3>
            <p className="text-slate-400 font-medium max-w-xs text-center leading-relaxed">
              ยังไม่มีการบันทึกข้อมูลลูกค้าในร้านรายนี้ คุณสามารถเริ่มเพิ่มลูกค้าได้โดยกดที่ปุ่มด้านบน
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 font-prompt">
            {customerList.map(customer => {
              const user = customer.users_permissions_user?.data?.attributes || customer.users_permissions_user || customer.attributes?.users_permissions_user;
              const customerDocumentId = customer.documentId || customer.attributes?.documentId;
              const userId = 
                customer.users_permissions_user?.data?.id ||
                customer.attributes?.users_permissions_user?.data?.id ||
                customer.users_permissions_user?.id ||
                customer.attributes?.users_permissions_user?.id ||
                null;
              const customerName = user?.full_name || customer.temp_full_name || customer.attributes?.temp_full_name || 'ลูกค้า';
              const followUpDate = customer.Follow_up_appointment_date || customer.attributes?.Follow_up_appointment_date;
              const congenitalDisease = customer.congenital_disease || customer.attributes?.congenital_disease;
              const allergicDrugs = customer.Allergic_drugs || customer.attributes?.Allergic_drugs;

              return (
                <div 
                  key={customer.id} 
                  className="bg-white rounded-[2.5rem] p-8 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col h-full"
                >
                  {/* Header */}
                  <div className="flex items-start gap-5 mb-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-2xl font-black text-indigo-600 shadow-inner">
                        {(customerName.charAt(0) || 'C').toUpperCase()}
                      </div>
                      {user && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="text-xl font-black text-slate-800 truncate leading-tight mb-0.5">
                        {customerName}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">UID:</span>
                        <span className="text-xs font-black text-indigo-500/80 bg-indigo-50 px-2 py-0.5 rounded-md truncate">
                          {user?.username || 'Manual Record'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info Content */}
                  <div className="space-y-4 flex-grow mb-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-indigo-100 transition-all">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          <span className="text-[10px] font-black uppercase tracking-wider">เบอร์โทรศัพท์</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700">{user?.phone || customer.temp_phone || customer.attributes?.temp_phone || 'ไม่ระบุ'}</p>
                      </div>
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-indigo-100 transition-all">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                          <span className="text-[10px] font-black uppercase tracking-wider">อีเมล</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 truncate">{user?.email || 'ไม่มีบัญชี'}</p>
                      </div>
                    </div>

                    {/* Medical Section */}
                    <div className="space-y-3">
                      {congenitalDisease && (
                        <div className="flex items-start gap-4 p-4 bg-amber-50/40 rounded-2xl border border-amber-100/50">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none block mb-1">โรคประจำตัว</span>
                            <p className="text-sm font-bold text-amber-900 leading-tight">{congenitalDisease}</p>
                          </div>
                        </div>
                      )}

                      {(() => {
                        const allergyText = formatAllergy(allergicDrugs);
                        if (!allergyText || allergyText === 'ไม่มีข้อมูล') return null;
                        
                        return (
                          <div className="flex items-start gap-4 p-4 bg-rose-50/40 rounded-2xl border border-rose-100/50">
                            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none block mb-1">ยาที่แพ้</span>
                              <p className="text-sm font-black text-rose-900 leading-tight">{allergyText}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Appointment Section */}
                    {followUpDate && (
                      <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none block mb-1">นัดหมายถัดไป</span>
                            <p className="text-sm font-black text-emerald-900">{formatThaiDate(followUpDate)}</p>
                          </div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto grid grid-cols-2 gap-3 pt-6 border-t border-slate-50">
                    <button
                      className="flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-50 text-indigo-700 font-black rounded-2xl hover:bg-indigo-100 transition-all active:scale-95 group"
                      onClick={() => {
                        if (!customerDocumentId) {
                          toast.error("ไม่พบข้อมูลลูกค้า ไม่สามารถดูรายละเอียดได้");
                          return;
                        }
                        navigate(`/drug_store_pharmacy/${documentId}/customer/${customerDocumentId}/history?pharmacyId=${documentId}`);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                      ดูรายละเอียด
                    </button>
                    
                    <button 
                      className="flex items-center justify-center gap-2 px-4 py-3.5 bg-rose-50 text-rose-600 font-black rounded-2xl hover:bg-rose-100 transition-all active:scale-95 group"
                      onClick={() => deleteCustomer(customer.id, customerDocumentId, userId, customerName)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      ลบข้อมูล
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="mt-12 flex justify-center pb-10">
          <button
            className="group flex items-center gap-3 px-10 py-4 bg-white text-slate-500 font-black rounded-[2rem] shadow-sm border border-slate-100 hover:text-slate-800 hover:shadow-lg hover:border-slate-200 transition-all duration-300 active:scale-95"
            onClick={() => navigate("/pharmacyHome")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
            กลับสู่หน้าหลัก
          </button>
        </div>
      </main>
      {/* <Footer /> */}
    </div>
  );
}

export default CustomerPage;

