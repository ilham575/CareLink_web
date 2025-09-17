import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/pharmacyDetail.css';
import Footer from '../../components/footer';

function getImageUrl(photo) {
  if (!photo) return null;
  if (typeof photo === "string") return photo;
  if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
  if (photo.formats?.large?.url) return photo.formats.large.url;
  if (photo.url) return photo.url;
  return null;
}

// ✅ แม็พ key → ป้ายภาษาไทย ให้ตรงกับ AddStore_admin
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
  const [currentUserId, setCurrentUserId] = useState(null);

  const jwt = localStorage.getItem('jwt');

  useEffect(() => {
    const fetchData = async () => {
      if (!jwt) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        navigate('/login');
        return;
      }

      try {
        console.log('🔄 กำลังโหลดข้อมูลร้านยา documentId:', id);

        // 1. ดึงข้อมูล user ปัจจุบัน (เหมือน home.js)
        const userRes = await fetch('http://localhost:1337/api/users/me', {
          headers: { Authorization: `Bearer ${jwt}` }
        });

        if (!userRes.ok) {
          if (userRes.status === 401) {
            toast.error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
            localStorage.removeItem('jwt');
            navigate('/login');
            return;
          }
          throw new Error("ไม่สามารถดึงข้อมูล user ได้");
        }

        const userData = await userRes.json();
        setCurrentUserId(userData.id);
        // ใช้ documentId ของ user แทน id
        const userDocumentId = userData.documentId;

        // 2. ดึง admin_profile + drug_stores ที่ผูกกับ user.documentId (เหมือน home.js)
        const res = await fetch(
            `http://localhost:1337/api/admin-profiles?populate[drug_stores][populate]=*` +
  `&filters[users_permissions_user][documentId][$eq]=${userDocumentId}`,
          {
            headers: { Authorization: `Bearer ${jwt}` }
          }
        );

        if (!res.ok) {
          toast.error("ไม่สามารถโหลดข้อมูลร้านยาได้");
          return;
        }

        const data = await res.json();
        const myDrugStores = data.data[0]?.drug_stores || [];
        
        console.log('✅ My Drug Stores:', myDrugStores);
        console.log('🔍 Looking for documentId:', id);

        // 3. หาร้านยาที่ตรงกับ documentId ที่ส่งมา
        const store = myDrugStores.find(s => s.documentId === id);

        if (!store) {
          console.log('❌ ไม่พบร้านยาที่มี documentId:', id);
          console.log('Available stores:', myDrugStores.map(s => ({ id: s.id, documentId: s.documentId, name: s.name_th })));
          toast.error('ไม่พบร้านยาที่ต้องการ หรือคุณไม่มีสิทธิ์เข้าถึง');
          navigate(-1);
          return;
        }

        console.log('✅ Found Store:', store);
        console.log('🖼️ Store Photos:', {
          photo_front: store.photo_front,
          photo_in: store.photo_in,
          photo_staff: store.photo_staff
        });
        
        setPharmacy(store);

        // 4. ❌ ปิดการดึงข้อมูลเภสัชกรชั่วคราว
        /*
        try {
          const pharmacistRes = await fetch(
            `http://localhost:1337/api/pharmacists?populate=*&filters[drug_stores][documentId][$eq]=${id}`,
            {
              headers: {
                Authorization: `Bearer ${jwt}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (pharmacistRes.ok) {
            const pharmacistData = await pharmacistRes.json();
            console.log('✅ Pharmacist Data:', pharmacistData);
            setPharmacists(pharmacistData.data || []);
          } else {
            console.log('⚠️ ไม่สามารถดึงข้อมูลเภสัชกรได้');
            setPharmacists([]);
          }
        } catch (pharmacistErr) {
          console.error('Error fetching pharmacists:', pharmacistErr);
          setPharmacists([]);
        }
        */
        
        // ตั้งค่าเภสัชกรเป็น array ว่าง
        setPharmacists([]);
        console.log('⏸️ ปิดการดึงข้อมูลเภสัชกรชั่วคราว');

      } catch (err) {
        console.error("❌ Error fetching data:", err);
        
        if (err.message.includes('401') || err.message.includes('403')) {
          toast.error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
          localStorage.removeItem('jwt');
          navigate('/login');
        } else {
          // ⚠️ แก้ไข: ใช้ toast แทน navigate
          toast.error(`ไม่สามารถโหลดข้อมูลได้: ${err.message}`);
          // ไม่ navigate ไปไหน ให้อยู่หน้าเดิม หรือกลับไปหน้าก่อน
          navigate(-1);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, jwt, navigate]);

  // ✅ เตรียมรายการบริการที่ติ๊กไว้
  const enabledServiceLabels = React.useMemo(() => {
    const services = pharmacy?.services;
    if (!services || typeof services !== "object") return [];
    return Object.entries(SERVICE_LABELS)
      .filter(([key]) => services[key])
      .map(([, label]) => label);
  }, [pharmacy]);

  // ✅ เตรียมข้อมูลเภสัชกรหลัก - ปิดชั่วคราว
  const primaryPharmacist = React.useMemo(() => {
    /*
    if (pharmacists.length === 0) return null;
    
    // หาเภสัชกรหลัก หรือใช้คนแรก
    const primary = pharmacists.find(p => p.is_primary) || pharmacists[0];
    
    return {
      full_name: `${primary.firstname || ''} ${primary.lastname || ''}`.trim(),
      phone: primary.phone || '-',
      license_number: primary.license_number || '-'
    };
    */
    
    // ส่งค่าเริ่มต้นเมื่อปิดการดึงข้อมูลเภสัชกร
    return {
      full_name: '-',
      phone: '-',
      license_number: '-'
    };
  }, [pharmacists]);

  if (loading) {
    return (
      <div className="detail-container" >
        <HomeHeader pharmacyName="กำลังโหลด..." />
        <div style={{ textAlign: 'center', marginTop: 50 }}>
          กำลังโหลดข้อมูล...
        </div>
        <Footer />
      </div>
    );
  }

  if (!pharmacy) {
    return (
      <div className="detail-container" >
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
        <Footer />
      </div>
    );
  }

  return (
    <div className="detail-container" >
      <HomeHeader pharmacyName={pharmacy?.name_th || "รายละเอียดร้านยา"} />

      {/* ✅ แถวรูปภาพ */}
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
          const fullImageUrl = imageUrl && imageUrl.startsWith('/') 
            ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${imageUrl}`
            : imageUrl;

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
              {fullImageUrl ? (
                <img
                  src={fullImageUrl}
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

      {/* ✅ ข้อมูลร้านยา */}
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
          {pharmacy.name_en && <p><strong>ชื่อภาษาอังกฤษ:</strong> {pharmacy.name_en}</p>}
          <p><strong>ที่อยู่:</strong> {pharmacy.address || "-"}</p>
          <p><strong>เลขที่ใบอนุญาต:</strong> {pharmacy.license_number || "-"}</p>
          
          {/* ✅ แสดงเภสัชกร */}
          <p><strong>ชื่อ-นามสกุลเภสัชกร:</strong> {primaryPharmacist?.full_name || "-"}</p>
          <p><strong>เบอร์โทรศัพท์เภสัชกร:</strong> {primaryPharmacist?.phone || "-"}</p>
          
          <p>
            <strong>เวลาทำการ:</strong>{" "}
            {pharmacy.time_open ? formatTime(pharmacy.time_open) : "-"} น. -{" "}
            {pharmacy.time_close ? formatTime(pharmacy.time_close) : "-"} น.
          </p>
          <p><strong>เบอร์โทรศัพท์ร้านยา:</strong> {pharmacy.phone_store || "-"}</p>

          {/* ✅ ปุ่ม เภสัชกรประจำร้าน + แก้ไขร้านยา */}
          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            {/* <button
              onClick={() => navigate(`/pharmacist_detail_admin/${id}`)}
              style={{
                background: '#4CAF50',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              เภสัชกรประจำร้าน (0)
            </button> */}
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
                  ดูแผนที่ Google Maps
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
          onClick={() => navigate(-1)}
        >
          กลับ
        </button>
      </div>

      <Footer />
    </div>
  );
}

export default DrugStoresDetail_admin;
