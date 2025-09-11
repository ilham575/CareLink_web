import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/pharmacyDetail.css';
import Footer from '../../components/footer';

function getImageUrl(photo) {
  if (!photo) return null;

  // ✅ mock (string จาก localStorage)
  if (typeof photo === "string") return photo;

  // ✅ API (object จาก Strapi)
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
        // ✅ 1. หาจาก mock (localStorage)
        const mockPharmacies = JSON.parse(localStorage.getItem("mock_pharmacies") || "[]");
        const mockFound = mockPharmacies.find(p => String(p.id) === String(id));

        if (mockFound) {
          setPharmacy(mockFound);
          setPharmacist(null);
          setLoading(false);
          return;
        }

        // ✅ 2. ถ้าไม่เจอ mock → ดึงจาก API
        const res = await fetch(
          `http://localhost:1337/api/drug-stores/${id}?populate=primary_pharmacist,photo_front,photo_in,photo_staff`
        );
        const storeJson = await res.json();
        const store = storeJson.data;
        setPharmacy(store ? (store.attributes || store) : null);
        setPharmacist(null); // TODO: ดึง pharmacist จาก API ถ้ามี
      } catch (err) {
        setPharmacist(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

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
                  height: 250, // ✅ ทำให้เป็นจตุรัส
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
              marginTop: 30, // ✅ เพิ่มระยะห่างจากแถวรูป
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
              <p>
                เวลาทำการ: {formatTime(pharmacy.time_open)} - {formatTime(pharmacy.time_close)}
              </p>
              <p>เบอร์โทรศัพท์ร้านยา: {pharmacy.phone_store || "-"}</p>
              <p>ชื่อ-นามสกุลเภสัชกร: {pharmacist?.full_name || "-"}</p>
              <p>เบอร์โทรศัพท์เภสัชกร: {pharmacist?.phone || "-"}</p>
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
                <p className="section-title" style={{ fontWeight: "bold" }}>การให้บริการ</p>
                <ul>
                  <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>
                  <li>ให้คำปรึกษาทางเภสัชกรรม</li>
                  <li>ตรวจสุขภาพเบื้องต้น</li>
                  <li>รับฝากยาและจัดส่งยา</li>
                </ul>
              </div>

              {/* ✅ Google Map */}
              <div className="map-box">
                <p className="section-title" style={{ fontWeight: "bold" }}>GOOGLE MAP</p>
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
          <div className="bottom-button" style={{ marginTop: 30, textAlign: "center" }}>
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
