import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import { db } from '../../db'; // ✅ import Dexie db
import '../../../css/pages/default/pharmacyDetail.css';
import Footer from '../../components/footer';

function getImageUrl(photo) {
  if (!photo) return null;
  if (typeof photo === "string") return photo;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
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
  const [pharmacist, setPharmacist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ✅ 1) ลองดึงจาก IndexedDB (mock) ก่อน
        const mockFound = await db.pharmacies.get(Number(id));
        if (mockFound) {
          setPharmacy(mockFound);
        } else {
          // ✅ 2) ถ้าไม่เจอใน IndexedDB → ดึงจาก API (สำรอง)
          const res = await fetch(
            `http://localhost:1337/api/drug-stores/${id}?populate=primary_pharmacist,photo_front,photo_in,photo_staff`
          );
          const storeJson = await res.json();
          const store = storeJson.data;
          setPharmacy(store ? (store.attributes || store) : null);
        }

        // ✅ 3) ดึงเภสัชกรจาก IndexedDB โดยเช็คว่า storeIds มี id นี้
        const foundPharmacists = await db.pharmacists
          .filter((p) => p.storeIds?.includes(String(id)))
          .toArray();

        if (foundPharmacists.length > 0) {
          setPharmacist({
            full_name: `${foundPharmacists[0].firstname} ${foundPharmacists[0].lastname}`,
            phone: foundPharmacists[0].phone,
          });
        } else {
          setPharmacist(null);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setPharmacist(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // ✅ เตรียมรายการบริการที่ติ๊กไว้จาก IndexedDB (ถ้ามี)
  const enabledServiceLabels = React.useMemo(() => {
    const services = pharmacy?.services;
    if (!services || typeof services !== "object") return [];
    return Object.entries(SERVICE_LABELS)
      .filter(([key]) => services[key])
      .map(([, label]) => label);
  }, [pharmacy]);

  return (
    <div className="detail-container" style={{ padding: 20 }}>
      <HomeHeader pharmacyName={pharmacy?.name_th || "รายละเอียดร้านยา"} />

      {loading ? (
        <div>กำลังโหลดข้อมูล...</div>
      ) : pharmacy ? (
        <>
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
            {["photo_front", "photo_in", "photo_staff"].map((key, idx) => (
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
                {getImageUrl(pharmacy[key]) ? (
                  <img
                    src={getImageUrl(pharmacy[key])}
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
            ))}
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
              <p>ชื่อร้านยา: {pharmacy.name_th || "-"}</p>
              <p>ที่อยู่: {pharmacy.address || "-"}</p>
              {/* ✅ แสดงเภสัชกร */}
              <p>ชื่อ-นามสกุลเภสัชกร: {pharmacist?.full_name || "-"}</p>
              <p>เบอร์โทรศัพท์เภสัชกร: {pharmacist?.phone || "-"}</p>
              <p>
                เวลาทำการ:{" "}
                {pharmacy.time_open ? formatTime(pharmacy.time_open) : "-"} น. -{" "}
                {pharmacy.time_close ? formatTime(pharmacy.time_close) : "-"} น.
              </p>
              <p>เบอร์โทรศัพท์ร้านยา: {pharmacy.phone_store || "-"}</p>

              {/* ✅ ปุ่ม เภสัชกรประจำร้าน + แก้ไขร้านยา */}
              <div className="flex gap-4 mt-3">
                <button
                  onClick={() => navigate(`/pharmacist_detail_admin/${id}`)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  เภสัชกรประจำร้าน
                </button>
                <button
                  onClick={() => navigate(`/edit_store_admin/${id}`)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
                  <ul>
                    {enabledServiceLabels.map((label, idx) => (
                      <li key={idx}>{label}</li>
                    ))}
                  </ul>
                ) : (
                  <ul>
                    <li>—</li>
                  </ul>
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
                    >
                      ดูแผนที่
                    </a>
                  ) : (
                    "<LINK GOOGLE MAP>"
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
        </>
      ) : (
        <div>ไม่พบข้อมูลร้านยา</div>
      )}
      <Footer />
    </div>
  );
}

export default DrugStoresDetail_admin;
