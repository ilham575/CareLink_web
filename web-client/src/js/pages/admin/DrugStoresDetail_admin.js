import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import Footer from '../../components/footer';
import '../../../css/pages/default/pharmacyDetail.css';

function getImageUrl(photo) {
  if (!photo) return null;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
  if (photo.url) return photo.url;
  return null;
}

function DrugStoresDetail_admin() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacist, setPharmacist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. ดึงข้อมูลร้าน
        const storeRes = await fetch(`http://localhost:1337/api/drug-stores/${id}?populate=primary_pharmacist,photo_front,photo_in,photo_staff`);
        const storeJson = await storeRes.json();
        const store = storeJson.data;
        setPharmacy(store ? (store.attributes || store) : null);

        // 2. ดึง pharmacy-profiles ทั้งหมด
        let pharmacistProfile = store?.primary_pharmacist;
        let pharmacistDocumentId = null;
        if (pharmacistProfile?.data) {
          pharmacistDocumentId = pharmacistProfile.data.attributes?.documentId
            || pharmacistProfile.data.documentId
            || null;
          pharmacistProfile = pharmacistProfile.data;
        } else if (pharmacistProfile?.attributes) {
          pharmacistDocumentId = pharmacistProfile.attributes.documentId || null;
        } else if (pharmacistProfile?.documentId) {
          pharmacistDocumentId = pharmacistProfile.documentId;
        }

        if (pharmacistDocumentId) {
          const profileRes = await fetch('http://localhost:1337/api/pharmacy-profiles?populate=users_permissions_user');
          const profileJson = await profileRes.json();
          const allProfiles = profileJson.data || [];
          const matchedProfile = allProfiles.find(
            p => String(p?.attributes?.documentId || p?.documentId) === String(pharmacistDocumentId)
          );
          let pharmacistUser = null;
          const userField = matchedProfile?.attributes?.users_permissions_user || matchedProfile?.users_permissions_user;
          if (userField) {
            if (Array.isArray(userField?.data)) {
              pharmacistUser = userField.data[0] || null;
            } else if (userField?.data) {
              pharmacistUser = userField.data || null;
            } else {
              pharmacistUser = userField;
            }
          }
          setPharmacist(pharmacistUser);
        } else {
          setPharmacist(null);
        }
      } catch (e) {
        setPharmacist(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
            <div className="image-box" style={{ padding: 0, background: 'none' }}>
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
            <div className="image-box" style={{ padding: 0, background: 'none' }}>
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
                {pharmacist ? (
                  <ul>
                    <li>
                      {pharmacist.full_name ? `ชื่อเภสัชกร : ${pharmacist.full_name}` : '-'}
                      <br />
                      <span style={{ color: '#555', fontSize: '0.95em' }}>
                        {pharmacist.phone ? `เบอร์โทรศัพท์ : ${pharmacist.phone}` : ''}
                      </span>
                    </li>
                  </ul>
                ) : (
                  <p>ไม่พบข้อมูลเภสัชกร</p>
                )}
              </div>
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
      <Footer />
    </div>
    
  );
}

export default DrugStoresDetail_admin;
