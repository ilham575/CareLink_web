import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/pharmacyDetail.css';
// Footer is rendered globally in App.js
import { API } from '../../../utils/apiConfig';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:1337';

function getImageUrl(photo) {
  if (!photo) return null;
  // ใช้ documentId บังคับสำหรับการดึงรูปผ่าน custom endpoint
  if (photo.documentId) {
    return `${API.BASE_URL}/api/upload/files/${photo.documentId}/serve`;
  }
  // Fallback สำหรับข้อมูลเก่า
  if (typeof photo === "string") return photo;
  if (photo.formats?.large?.url) return photo.formats.large.url;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
  if (photo.url) return photo.url;
  if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
  return null;
}

// ✅ แม็พ key → ป้ายภาษาไทย
const SERVICE_LABELS = {
  sell_products: "จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ",
  consulting: "ให้คำปรึกษาทางเภสัชกรรม",
  health_check: "ตรวจสุขภาพเบื้องต้น",
  delivery: "บริการจัดส่งยา/เวชภัณฑ์",
};

function DrugStoresDetail_admin() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacists, setPharmacists] = useState([]);
  const [loading, setLoading] = useState(true);

  const jwt = localStorage.getItem('jwt');

  useEffect(() => {
    const fetchData = async () => {
      if (!jwt) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        navigate('/login');
        return;
      }

      try {
        // 1. ได้ userDocumentId จาก localStorage (ที่บันทึกไว้ตอน login)
        const userDocumentId = localStorage.getItem('user_documentId');
        if (!userDocumentId) {
          toast.error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
          navigate('/login');
          return;
        }

        // 2. ดึง admin_profile + drug_stores (ต้อง populate รูปภาพด้วย)
        const res = await fetch(
          `${BASE_URL}/api/admin-profiles?populate[0]=drug_stores&populate[1]=drug_stores.photo_front&populate[2]=drug_stores.photo_in&populate[3]=drug_stores.photo_staff&filters[users_permissions_user][documentId][$eq]=${userDocumentId}`,
          {
            headers: { Authorization: `Bearer ${jwt}` }
          }
        );

        if (res.status === 401) {
          console.error('🔐 Token invalid - clearing localStorage');
          localStorage.removeItem('jwt');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('role');
          toast.error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
          navigate('/login');
          return;
        }

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Admin profile fetch error:', res.status, errorText);
          toast.error("ไม่สามารถโหลดข้อมูลร้านยาได้");
          navigate(-1);
          return;
        }

        const data = await res.json();
        console.log('✅ Admin profiles fetched:', data);
        
        const myDrugStores = data.data[0]?.attributes?.drug_stores?.data || data.data[0]?.drug_stores || [];
        console.log('✅ Drug stores found:', myDrugStores.length);

        // 3. หาร้านยาที่ตรงกับ documentId
        const store = myDrugStores.find(s => s.documentId === id || s.attributes?.documentId === id);

        if (!store) {
          console.error('Store not found. Looking for id:', id);
          console.error('Available stores:', myDrugStores.map(s => s.documentId || s.attributes?.documentId));
          toast.error('ไม่พบร้านยาที่ต้องการ หรือคุณไม่มีสิทธิ์เข้าถึง');
          navigate(-1);
          return;
        }

        console.log('✅ Store found:', store);
        setPharmacy(store.attributes || store);

        // 4. ดึงเภสัชกรทั้งหมดในร้าน
        const pharmacistRes = await fetch(
          `${BASE_URL}/api/pharmacy-profiles?populate[0]=users_permissions_user&populate[1]=drug_stores&filters[drug_stores][documentId][$eq]=${id}`,
          {
            headers: { Authorization: `Bearer ${jwt}` }
          }
        );

        if (pharmacistRes.status === 401) {
          console.error('🔐 Token invalid on pharmacist fetch');
          localStorage.removeItem('jwt');
          navigate('/login');
          return;
        }

        if (pharmacistRes.ok) {
          const pharmacistData = await pharmacistRes.json();
          console.log('✅ Pharmacists fetched:', pharmacistData.data?.length);
          setPharmacists(pharmacistData.data || []);
        } else {
          console.warn('⚠️ Pharmacist fetch failed:', pharmacistRes.status);
        }

      } catch (err) {
        console.error('❌ Error loading detail:', err);
        toast.error(`ไม่สามารถโหลดข้อมูลได้: ${err.message}`);
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, jwt, navigate]);

  // ✅ เลือกเภสัชกรคนแรก
  const primaryPharmacist = React.useMemo(() => {
    if (pharmacists.length === 0) return null;
    const first = pharmacists[0];
    return {
      full_name: first.users_permissions_user?.full_name || "-",
      phone: first.users_permissions_user?.phone || "-",
      license_number: first.license_number || "-"
    };
  }, [pharmacists]);

  // ✅ เตรียมรายการบริการ
  const enabledServiceLabels = React.useMemo(() => {
    const services = pharmacy?.services;
    if (!services || typeof services !== "object") return [];
    return Object.entries(SERVICE_LABELS)
      .filter(([key]) => services[key])
      .map(([, label]) => label);
  }, [pharmacy]);

  if (loading) {
    return (
      <div className="detail-container">
        <HomeHeader pharmacyName="กำลังโหลด..." />
        <div style={{ textAlign: 'center', marginTop: 50 }}>
          กำลังโหลดข้อมูล...
        </div>
      </div>
    );
  }

  if (!pharmacy) {
    return (
      <div className="detail-container">
        <HomeHeader pharmacyName="ไม่พบข้อมูล" />
        <div style={{ textAlign: 'center', marginTop: 50 }}>
          <h3>ไม่พบข้อมูลร้านยา</h3>
          <p>ไม่พบร้านยาที่คุณต้องการ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: 20,
              background: "#006d77",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            กลับ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-container">
      <HomeHeader pharmacyName={pharmacy?.name_th || "รายละเอียดร้านยา"} />

      {/* ✅ รูปภาพร้าน */}
      <div
        className="image-row"
        style={{
          display: "flex",
          gap: 20,
          marginBottom: 20,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {["photo_front", "photo_in", "photo_staff"].map((key, idx) => {
          const imageUrl = getImageUrl(pharmacy[key]);

          return (
            <div
              key={idx}
              className="image-box"
              style={{
                width: 250,
                height: 250,
                borderRadius: 16,
                background: "#f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={key}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 16,
                  }}
                />
              ) : (
                <div className="img-placeholder">
                  {key === "photo_front"
                    ? "รูปด้านนอกร้านยา"
                    : key === "photo_in"
                      ? "รูปด้านในร้านยา"
                      : "รูปเภสัชกรและพนักงาน"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ✅ ข้อมูลร้าน */}
      <div
        className="info-service-row"
        style={{
          display: "flex",
          gap: 40,
          marginTop: 30,
          flexWrap: "wrap",
        }}
      >
        <div
          className="left-info"
          style={{
            flex: 1,
            minWidth: 300,
            background: "#f3fff3",
            padding: 16,
            borderRadius: 12,
          }}
        >
          <p><strong>ชื่อร้านยา:</strong> {pharmacy.name_th || "-"}</p>
          <p><strong>ที่อยู่:</strong> {pharmacy.address || "-"}</p>

          {/* ✅ แสดงเภสัชคนแรก */}
          <p><strong>ชื่อ-นามสกุลเภสัชกร:</strong> {primaryPharmacist?.full_name}</p>
          <p><strong>เบอร์โทรศัพท์เภสัชกร:</strong> {primaryPharmacist?.phone}</p>
          
          <p>
            <strong>เวลาทำการ:</strong>{" "}
            {pharmacy.time_open ? formatTime(pharmacy.time_open) : "-"} น. -{" "}
            {pharmacy.time_close ? formatTime(pharmacy.time_close) : "-"} น.
          </p>
          <p><strong>เบอร์โทรศัพท์ร้านยา:</strong> {pharmacy.phone_store || "-"}</p>

          {/* ✅ ปุ่ม */}
          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            <button
              onClick={() => navigate(`/pharmacist_detail_admin/${id}`, {
                state: { from: "drugStore" }
              })}
              style={{
                background: '#4CAF50',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              เภสัชกรประจำร้าน
            </button>
            <button
              onClick={() => navigate(`/edit_store_admin/${id}`)}
              style={{
                background: '#2196F3',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              แก้ไขร้านยา
            </button>
          </div>
        </div>

        {/* ✅ การให้บริการ */}
        <div
          className="right-service"
          style={{
            flex: 1,
            minWidth: 300,
            background: "#e6f9ff",
            padding: 16,
            borderRadius: 12,
          }}
        >
          <div className="service-box" style={{ marginBottom: 20 }}>
            <p className="section-title" style={{ fontWeight: "bold" }}>
              การให้บริการ
            </p>
            {enabledServiceLabels.length > 0 ? (
              <ul style={{ paddingLeft: 20 }}>
                {enabledServiceLabels.map((label, idx) => (
                  <li key={idx} style={{ marginBottom: 5 }}>{label}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#666' }}>ไม่มีข้อมูลการให้บริการ</p>
            )}
          </div>

          {/* ✅ Google Map */}
          <div className="map-box">
            <p className="section-title" style={{ fontWeight: "bold" }}>
              GOOGLE MAP
            </p>
            <div
              className="map-placeholder"
              style={{
                background: "#d9ffd9",
                padding: 12,
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              {pharmacy.link_gps ? (
                <a
                  href={
                    pharmacy.link_gps.startsWith("http")
                      ? pharmacy.link_gps
                      : `https://${pharmacy.link_gps}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0066cc', textDecoration: 'underline' }}
                >
                  แผนที่ร้านยา
                </a>
              ) : (
                <span style={{ color: '#666' }}>ไม่มีลิงก์แผนที่</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ ปุ่มกลับ */}
      <div
        className="bottom-button"
        style={{ marginTop: 30, textAlign: "center" }}
      >
        <button
          className="back-button"
          style={{
            background: "#006d77",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => navigate("adminHome" ? "/adminHome" : -1)}
        >
          กลับ
        </button>
      </div>
    </div>
  );
}

export default DrugStoresDetail_admin;
