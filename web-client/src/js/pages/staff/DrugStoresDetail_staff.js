import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/staff/drugstore_detail_staff.css';
import Footer from '../../components/footer';
import { toast } from 'react-toastify';
import AnimationWrapper from '../../components/AnimationWrapper';

function getImageUrl(photo) {
  if (!photo) return null;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
  if (photo.url) return photo.url;
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
        
        if (!id || id === 'undefined' || id === 'null') {
          throw new Error('Invalid store ID');
        }

        // Try documentId filter first
        try {
          storeRes = await fetch(`http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${id}&populate=*`);
          storeJson = await storeRes.json();
          store = storeJson.data?.[0];
        } catch (err) {
          console.error('Error fetching by documentId:', err);
        }

        // If not found by documentId and id is a valid integer, try regular id
        if (!store && !isNaN(parseInt(id))) {
          storeRes = await fetch(`http://localhost:1337/api/drug-stores/${id}?populate=*`);
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
          const staffRes = await fetch(`http://localhost:1337/api/staff-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=*`, {
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
    <div className="dsstaff-detail-container">
      <HomeHeader pharmacyName={pharmacy?.name_th} />
      <AnimationWrapper>
        {loading ? (
          <div>กำลังโหลดข้อมูล...</div>
        ) : pharmacy ? (
          <>
            <div className="dsstaff-image-row">
              <div className="dsstaff-image-box" style={{ padding: 0, background: 'none' }}>
                {getImageUrl(pharmacy.photo_front) ? (
                  <img
                    src={getImageUrl(pharmacy.photo_front).startsWith('/')
                      ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${getImageUrl(pharmacy.photo_front)}`
                      : getImageUrl(pharmacy.photo_front)
                    }
                    alt="รูปด้านนอกร้านยา"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                  />
                ) : (
                  'รูปด้านนอกร้านยา'
                )}
              </div>
              <div className="dsstaff-image-box" style={{ padding: 0, background: 'none' }}>
                {getImageUrl(pharmacy.photo_in) ? (
                  <img
                    src={getImageUrl(pharmacy.photo_in).startsWith('/')
                      ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${getImageUrl(pharmacy.photo_in)}`
                      : getImageUrl(pharmacy.photo_in)
                    }
                    alt="รูปด้านในร้านยา"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                  />
                ) : (
                  'รูปด้านในร้านยา'
                )}
              </div>
              <div className="dsstaff-image-box" style={{ padding: 0, background: 'none' }}>
                {getImageUrl(pharmacy.photo_staff) ? (
                  <img
                    src={getImageUrl(pharmacy.photo_staff).startsWith('/')
                      ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${getImageUrl(pharmacy.photo_staff)}`
                      : getImageUrl(pharmacy.photo_staff)
                    }
                    alt="รูปเภสัชกรและพนักงาน"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                  />
                ) : (
                  'รูปเภสัชกรและพนักงาน'
                )}
              </div>
            </div>

            <div className="dsstaff-info-service-row">
              <div className="dsstaff-left-info">
                <p>ชื่อร้านยา: {pharmacy.name_th || '-'}</p>
                <p>ที่อยู่: {pharmacy.address || '-'}</p>
                <p>
                  เวลาทำการ: {formatTime(pharmacy.time_open)} - {formatTime(pharmacy.time_close)}
                </p>
                <p>เบอร์โทรศัพท์ร้านยา: {pharmacy.phone_store || '-'}</p>
                <div style={{ marginTop: 12, whiteSpace: 'pre-line' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: 4 }}>ข้อมูลเภสัชกร:</p>
                  {pharmacy?.pharmacy_profiles?.data && pharmacy.pharmacy_profiles.data.length > 0 ? (
                    <ul>
                      {pharmacy.pharmacy_profiles.data.map((profile, index) => {
                        const attrs = profile.attributes || {};
                        const user = attrs.users_permissions_user?.data?.attributes || attrs.users_permissions_user || null;
                        const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'ไม่ระบุ' : (attrs.full_name || attrs.name || 'ไม่ระบุ');
                        const working = attrs.working_time || attrs.working || attrs.workingTime || null;
                        return (
                          <li key={index} style={{ marginBottom: 6 }}>
                            <div>ชื่อเภสัชกร: {name}</div>
                            {working && (
                              <div style={{ color: '#555', fontSize: '0.95em' }}>เวลาทำงานเภสัชกร: {formatWorkingTime(working)}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>ไม่พบข้อมูลเภสัชกร</p>
                  )}
                </div>
              </div>

              <div className="dsstaff-right-service">
                <div className="dsstaff-service-box">
                  <p className="dsstaff-section-title">การให้บริการ</p>
                  <ul>
                    {pharmacy.services ? (
                      <>
                        {pharmacy.services.sell_products && <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>}
                        {pharmacy.services.consulting && <li>ให้คำปรึกษาทางเภสัชกรรม</li>}
                        {pharmacy.services.health_check && <li>ตรวจสุขภาพเบื้องต้น</li>}
                        {pharmacy.services.delivery && <li>รับฝากยาและจัดส่งยา</li>}
                      </>
                    ) : (
                      <li>ไม่มีข้อมูลการให้บริการ</li>
                    )}
                  </ul>
                </div>
                <div className="dsstaff-map-box">
                  <p className="dsstaff-section-title">GOOGLE MAP</p>
                  <div className="dsstaff-map-placeholder">
                    {pharmacy.link_gps ? (
                      <a
                        href={
                          pharmacy.link_gps.startsWith('http')
                            ? pharmacy.link_gps
                            : `https://${pharmacy.link_gps}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ดูแผนที่
                      </a>
                    ) : (
                      '<LINK GOOGLE MAP>'
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="dsstaff-bottom-button" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '0 16px' }}>
              <button
                className="dsstaff-back-button"
                onClick={() => {
                  // กลับไปหน้ารายการร้านยา (หรือเปลี่ยน path ตาม role)
                  const role = localStorage.getItem('role');
                  if (role === 'admin') {
                    navigate('/drug_store_admin');
                  } else if (role === 'staff') {
                    navigate('/staffHome');
                  } else {
                    navigate('/'); // fallback
                  }
                }}
              >
                กลับ
              </button>
            </div>
          </>
        ) : (
          <div>ไม่พบข้อมูลร้านยา</div>
        )}
      </AnimationWrapper>
      <Footer />
    </div>
  );
}

export default DrugStoresDetail_staff;