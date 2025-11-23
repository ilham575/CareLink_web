import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/pharmacyDetail.css';
import { API } from '../../../utils/apiConfig';

function getImageUrl(photo) {
  if (!photo) return null;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
  if (photo.url) return photo.url;
  return null;
}

const SERVICE_LABELS = {
  sell_products: "จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ",
  consulting: "ให้คำปรึกษาทางเภสัชกรรม",
  health_check: "ตรวจสุขภาพเบื้องต้น",
  delivery: "รับฝากยาและจัดส่งยา"
};

function DrugStoreDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacists, setPharmacists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(API.drugStores.getById(id)).then(res => res.json()),
      fetch(API.pharmacyProfiles.list('populate=users_permissions_user')).then(res => res.json())
    ]).then(([storeRes, profileRes]) => {
      const store = storeRes.data;
      setPharmacy(store ? (store.attributes || store) : null);

      const profilesFromStore = Array.isArray(store.pharmacy_profiles)
        ? store.pharmacy_profiles
        : (store.pharmacy_profiles?.data || []);

      const allProfiles = profileRes.data || [];

      const pharmacistsArr = profilesFromStore
        .map(profile => {
          const found = allProfiles.find(p => p.documentId === profile.documentId);
          return found?.users_permissions_user || null;
        })
        .filter(u => !!u);

      setPharmacists(pharmacistsArr);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  let content;
  if (loading) {
    content = <div>กำลังโหลดข้อมูล...</div>;
  } else if (pharmacy) {
    content = (
      <>
        <div className="image-row">
          <div className="image-box" style={{ padding: 0, background: 'none' }}>
            {getImageUrl(pharmacy.photo_front) ? (
              <img
                src={getImageUrl(pharmacy.photo_front).startsWith('/')
                  ? API.getImageUrl(getImageUrl(pharmacy.photo_front))
                  : getImageUrl(pharmacy.photo_front)
                }
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
                src={getImageUrl(pharmacy.photo_in).startsWith('/')
                  ? API.getImageUrl(getImageUrl(pharmacy.photo_in))
                  : getImageUrl(pharmacy.photo_in)
                }
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
                src={getImageUrl(pharmacy.photo_staff).startsWith('/')
                  ? API.getImageUrl(getImageUrl(pharmacy.photo_staff))
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

        <div className="info-service-row">
          <div className="left-info">
            <p>ชื่อร้านยา: {pharmacy.name_th || '-'}</p>
            <p>ที่อยู่: {pharmacy.address || '-'}</p>
            <p>
              เวลาทำการ: {formatTime(pharmacy.time_open)} - {formatTime(pharmacy.time_close)}
            </p>
            <p>เบอร์โทรศัพท์ร้านยา: {pharmacy.phone_store || '-'}</p>
            <div style={{ marginTop: 12 }}>
              <p style={{ fontWeight: 'bold', marginBottom: 4 }}>ข้อมูลเภสัชกรประจำร้านยา:</p>
              <ul>
                {pharmacists.length > 0
                  ? pharmacists.map((u, idx) => (
                    <li key={u.id || idx}>
                      {u.full_name ? `ชื่อเภสัชกร : ${u.full_name}` : '-'}
                      <br />
                      <span style={{ color: '#555', fontSize: '0.95em' }}>
                        {u.phone ? `เบอร์โทรศัพท์ : ${u.phone}` : ''}
                      </span>
                    </li>
                  ))
                  : <li>ไม่พบข้อมูลเภสัชกร</li>
                }
              </ul>
            </div>
          </div>

          <div className="right-service">
            <div className="service-box">
              <p className="section-title">การให้บริการ</p>
              <ul>
                {pharmacy.services
                  ? Object.entries(SERVICE_LABELS)
                      .filter(([key]) => pharmacy.services[key]) // ✅ เลือกเฉพาะ true
                      .map(([key, label]) => (
                        <li key={key}>{label}</li>
                      ))
                  : <li>ไม่มีข้อมูลบริการ</li>}
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
    );
  } else {
    content = <div>ไม่พบข้อมูลร้านยา</div>;
  }

  return (
    <div className="detail-container">
      <HomeHeader pharmacyName={pharmacy?.name_th} />
      {content}
    </div>
  );
}

export default DrugStoreDetail;