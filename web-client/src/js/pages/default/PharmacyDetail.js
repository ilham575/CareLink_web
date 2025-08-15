import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../../../css/pages/default/pharmacyDetail.css';
import HomeHeader from '../../components/HomeHeader';

// Suppress ResizeObserver loop error in Chrome
// if (typeof window !== 'undefined') {
//   window.addEventListener('error', function(e) {
//     if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
//       e.stopImmediatePropagation();
//     }
//   });
// }

function getImageUrl(photo) {
  // ใช้รูปขนาด medium ถ้ามี, ถ้าไม่มีใช้ url หลัก
  if (!photo) return null;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
  if (photo.url) return photo.url;
  return null;
}

function PharmacyDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ตรวจสอบว่า id ที่ได้จาก useParams() ตรงกับ /pharmacy/:id ใน URL เช่น /pharmacy/2
    // ถ้า id เป็น 2 จะ fetch http://localhost:1337/api/drug-stores/2
    fetch(`http://localhost:1337/api/drug-stores/${id}`)
      .then(res => res.json())
      .then(data => {
        // data เป็น { data: {...} }
        // ตรวจสอบว่า data.data เป็น object หรือ array
        if (data.data) {
          // ถ้า data.data เป็น array (เช่นจาก findMany) ให้ใช้ data.data[0]
          if (Array.isArray(data.data)) {
            setPharmacy(data.data[0] || null);
          } else {
            // ถ้าเป็น object (จาก findOne) ใช้ตรงๆ
            setPharmacy(data.data);
          }
        } else {
          setPharmacy(null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  return (
    <div className="detail-container">
      <HomeHeader pharmacyName={pharmacy?.name_th} />
      {loading ? (
        <div>กำลังโหลดข้อมูล...</div>
      ) : pharmacy ? (
        <>
          <div className="image-row">
            <div className="image-box" style={{ padding: 0, background: 'none' }}>
              {getImageUrl(pharmacy.photo_front) ? (
                <img
                  src={getImageUrl(pharmacy.photo_front).startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${getImageUrl(pharmacy.photo_front)}` : getImageUrl(pharmacy.photo_front)}
                  alt="รูปด้านนอกร้านยา"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                />
              ) : (
                'รูปด้านนอกร้านยา'
              )}
            </div>
            <div className="image-box" style={{ padding: 0, background: 'none' }}>
              {getImageUrl(pharmacy.photo_in) ? (
                <img
                  src={getImageUrl(pharmacy.photo_in).startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${getImageUrl(pharmacy.photo_in)}` : getImageUrl(pharmacy.photo_in)}
                  alt="รูปด้านในร้านยา"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                />
              ) : (
                'รูปด้านในร้านยา'
              )}
            </div>
            <div className="image-box" style={{ padding: 0, background: 'none' }}>
              {getImageUrl(pharmacy.photo_staff) ? (
                <img
                  src={getImageUrl(pharmacy.photo_staff).startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${getImageUrl(pharmacy.photo_staff)}` : getImageUrl(pharmacy.photo_staff)}
                  alt="รูปเภสัชกรและพนักงาน"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                />
              ) : (
                'รูปเภสัชกรและพนักงาน'
              )}
            </div>
          </div>

          <div className="info-service-row">
            <div className="left-info">
              <p>ชื่อร้านยา: {pharmacy.name_th || '-'}</p>
              <p>ที่อยู่: {pharmacy.address || '-'}</p>
              <p>
                เวลาทำการ: {pharmacy.time_open || '-'} - {pharmacy.time_close || '-'}
              </p>
              <p>เบอร์โทรศัพท์ร้านยา: {pharmacy.phone_store || '-'}</p>
              <p>ชื่อ-นามสกุลเภสัชกร: {pharmacy.pharmacist_name || '-'}</p>
              <p>เบอร์โทรศัพท์เภสัชกร: {pharmacy.pharmacist_phone || '-'}</p>
            </div>

            <div className="right-service">
              <div className="service-box">
                <p className="section-title">การให้บริการ</p>
                <ul>
                  <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>
                  <li>ให้คำปรึกษาทางเภสัชกรรม</li>
                  <li>ตรวจสุขภาพเบื้องต้น</li>
                  <li>รับฝากยาและจัดส่งยา</li>
                </ul>
              </div>

              <div className="map-box">
                <p className="section-title">GOOGLE MAP</p>
                <div className="map-placeholder">
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

          <div className="bottom-button">
            <button className="back-button" onClick={() => navigate(-1)}>กลับ</button>
          </div>
        </>
      ) : (
        <div>ไม่พบข้อมูลร้านยา</div>
      )}
    </div>
  );
}

export default PharmacyDetail;
