import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
// Footer is rendered globally in App.js
import { toast } from 'react-toastify';
import AnimationWrapper from '../../components/AnimationWrapper';
import { API } from '../../../utils/apiConfig';

function getImageUrl(photo) {
  if (!photo) return null;
  // ถ้า photo มี id field (file ID)
  if (photo.id) {
    return `${API.BASE_URL}/api/upload/files/${photo.id}/download`;
  }
  // ถ้า photo มี url ใน formats
  if (photo.formats?.medium?.url) return `${API.BASE_URL}${photo.formats.medium.url}`;
  if (photo.formats?.large?.url) return `${API.BASE_URL}${photo.formats.large.url}`;
  if (photo.formats?.thumbnail?.url) return `${API.BASE_URL}${photo.formats.thumbnail.url}`;
  // ถ้า photo มี url โดยตรง
  if (photo.url) return photo.url.startsWith('http') ? photo.url : `${API.BASE_URL}${photo.url}`;
  return null;
}

function formatWorkingTime(working) {
  if (!working) return 'ไม่ระบุเวลาทำงาน';
  // if it's already a string, return it
  if (typeof working === 'string') return working;
  // if it's an array of entries
  if (Array.isArray(working)) {
    return working
      .map((entry) => {
        const day = entry.day || entry.label || '';
        const from = entry.open || entry.from || entry.start || '';
        const to = entry.close || entry.to || entry.end || '';
        return `${day ? day + ': ' : ''}${from}${to ? ` - ${to}` : ''}`.trim();
      })
      .filter(Boolean)
      .join('\n');
  }
  // if it's an object, try to extract common shapes
  if (typeof working === 'object') {
    // shape: { monday: { open: '09:00', close: '17:00' }, ... }
    const parts = Object.keys(working).map((k) => {
      const v = working[k];
      if (!v) return '';
      if (typeof v === 'string') return `${k}: ${v}`;
      const from = v.open || v.from || v.start || '';
      const to = v.close || v.to || v.end || '';
      return `${k}: ${from}${to ? ` - ${to}` : ''}`.trim();
    }).filter(Boolean);
    if (parts.length) return parts.join('\n');
  }
  // fallback: pretty-print JSON
  try { return JSON.stringify(working); } catch (e) { return 'ไม่ระบุเวลาทำงาน'; }
}

function DrugStoresDetail_staff() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. ดึงข้อมูลร้าน - check if id is valid before making request
        let storeRes, storeJson, store;
        const isNumericId = /^\d+$/.test(String(id || '').trim());
        
        if (!id || id === 'undefined' || id === 'null') {
          throw new Error('Invalid store ID');
        }

        // Try documentId filter first
        try {
          storeRes = await fetch(API.drugStores.getByDocumentId(id));
          storeJson = await storeRes.json();
          store = Array.isArray(storeJson?.data)
            ? storeJson.data.find((item) => String(item?.documentId) === String(id)) || storeJson.data[0]
            : null;
        } catch (err) {
          console.error('Error fetching by documentId:', err);
        }

        // If not found by documentId and id is strictly numeric, try regular id
        if (!store && isNumericId) {
          storeRes = await fetch(API.drugStores.getById(id));
          storeJson = await storeRes.json();
          store = storeJson.data;
        }

        if (!store) {
          throw new Error('Store not found');
        }

        setPharmacy(store ? (store.attributes || store) : null);

        // 2. ดึงข้อมูลพนักงาน (staff profile ของผู้ใช้ปัจจุบัน)
        const token = localStorage.getItem('jwt');
        const userId = localStorage.getItem('userId'); // assuming userId is stored
        if (userId) {
          const staffRes = await fetch(API.staffProfiles.list(`filters[users_permissions_user][id][$eq]=${userId}&populate=*`), {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          });
          const staffJson = await staffRes.json();
          const staffData = staffJson.data?.[0];
          if (staffData) {
            setStaff(staffData.attributes || staffData);
          }
        }
      } catch (e) {
        console.error('Error fetching data:', e);
        setStaff(null);
        setPharmacy(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <HomeHeader pharmacyName={pharmacy?.name_th} />
      <AnimationWrapper>
        {loading ? (
          <div className="flex justify-center items-center h-64 text-slate-500 font-medium">
            <div className="animate-pulse">กำลังโหลดข้อมูล...</div>
          </div>
        ) : pharmacy ? (
          <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-8 py-6 space-y-8">
            {/* Image Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { img: pharmacy.photo_front, label: 'รูปด้านนอกร้านยา' },
                { img: pharmacy.photo_in, label: 'รูปด้านในร้านยา' },
                { img: pharmacy.photo_staff, label: 'รูปเภสัชกรและพนักงาน' }
              ].map((item, idx) => (
                <div key={idx} className="relative h-64 sm:h-72 md:h-80 rounded-2xl overflow-hidden shadow-lg border-4 border-white group transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-gradient-to-br from-sky-50 to-blue-100 flex items-center justify-center">
                  {getImageUrl(item.img) ? (
                    <img
                      src={getImageUrl(item.img)}
                      alt={item.label}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <span className="text-slate-400 font-bold text-center px-4">{item.label}</span>
                  )}
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            {/* Content Row */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left Info */}
              <div className="flex-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 transition-colors hover:bg-slate-100">
                    <span className="text-2xl">🏥</span>
                    <div>
                      <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">ชื่อร้านยา</div>
                      <div className="text-xl font-bold text-slate-800">{pharmacy.name_th || '-'}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 transition-colors hover:bg-slate-100">
                    <span className="text-2xl">📍</span>
                    <div>
                      <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">ที่อยู่</div>
                      <div className="text-lg text-slate-700">{pharmacy.address || '-'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 transition-colors hover:bg-slate-100">
                      <span className="text-2xl">🕒</span>
                      <div>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">เวลาทำการ</div>
                        <div className="text-lg font-bold text-slate-700">
                          {formatTime(pharmacy.time_open)} - {formatTime(pharmacy.time_close)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 transition-colors hover:bg-slate-100">
                      <span className="text-2xl">📞</span>
                      <div>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">เบอร์โทรศัพท์</div>
                        <div className="text-lg font-bold text-slate-700">{pharmacy.phone_store || '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="w-2 h-8 bg-sky-500 rounded-full" />
                    ข้อมูลเภสัชกร
                  </h3>
                  {pharmacy?.pharmacy_profiles?.data && pharmacy.pharmacy_profiles.data.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {pharmacy.pharmacy_profiles.data.map((profile, index) => {
                        const attrs = profile.attributes || {};
                        const user = attrs.users_permissions_user?.data?.attributes || attrs.users_permissions_user || null;
                        const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'ไม่ระบุ' : (attrs.full_name || attrs.name || 'ไม่ระบุ');
                        const working = attrs.working_time || attrs.working || attrs.workingTime || null;
                        return (
                          <div key={index} className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 border border-white shadow-sm">
                            <div className="font-bold text-slate-800 text-lg mb-1">{name}</div>
                            {working && (
                              <div className="text-slate-500 text-sm whitespace-pre-line leading-relaxed">
                                <span className="font-semibold text-sky-600 block mb-1">เวลาทำงาน:</span>
                                {formatWorkingTime(working)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-slate-50 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200">
                      ไม่พบข้อมูลเภสัชกร
                    </div>
                  )}
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="w-full lg:w-[400px] space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="w-2 h-8 bg-emerald-500 rounded-full" />
                    การให้บริการ
                  </h3>
                  <ul className="space-y-4">
                    {pharmacy.services ? (
                      <>
                        {[
                          { key: 'sell_products', label: 'จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ', icon: '💊' },
                          { key: 'consulting', label: 'ให้คำปรึกษาทางเภสัชกรรม', icon: '💬' },
                          { key: 'health_check', label: 'ตรวจสุขภาพเบื้องต้น', icon: '🩺' },
                          { key: 'delivery', label: 'รับฝากยาและจัดส่งยา', icon: '🚚' }
                        ].map((s) => pharmacy.services[s.key] && (
                          <li key={s.key} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100 transition-transform hover:translate-x-1">
                            <span>{s.icon}</span>
                            <span>{s.label}</span>
                          </li>
                        ))}
                      </>
                    ) : (
                      <li className="text-slate-400">ไม่มีข้อมูลการให้บริการ</li>
                    )}
                  </ul>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="w-2 h-8 bg-rose-500 rounded-full" />
                    พิกัดร้าน
                  </h3>
                  <div className="aspect-square w-full rounded-2xl bg-slate-100 flex items-center justify-center relative group overflow-hidden border-2 border-slate-50">
                    <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=13.7563,100.5018&zoom=13&size=400x400&sensor=false')] bg-cover opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl text-3xl">📍</div>
                      {pharmacy.link_gps ? (
                        <a
                          href={pharmacy.link_gps.startsWith('http') ? pharmacy.link_gps : `https://${pharmacy.link_gps}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white px-8 py-3 rounded-full font-bold text-slate-800 shadow-lg hover:bg-slate-800 hover:text-white transition-all transform hover:scale-105 active:scale-95"
                        >
                          เปิด Google Maps
                        </a>
                      ) : (
                        <span className="text-slate-400 font-medium italic">ไม่มีข้อมูลแผนที่</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="flex justify-start pt-4">
              <button
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-10 py-3 rounded-2xl font-bold transition-all transform active:scale-95 shadow-sm"
                onClick={() => {
                  const role = localStorage.getItem('role');
                  if (role === 'admin') navigate('/drug_store_admin');
                  else if (role === 'staff') navigate('/staffHome');
                  else navigate('/');
                }}
              >
                ย้อนกลับ
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
             <span className="text-6xl">🔍</span>
             <p className="text-xl font-medium">ไม่พบข้อมูลร้านยา</p>
          </div>
        )}
      </AnimationWrapper>
    </div>
  );
}

export default DrugStoresDetail_staff;