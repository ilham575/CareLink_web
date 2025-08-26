import { useNavigate, useParams } from "react-router-dom";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import "../../../css/pages/default/staffPage.css";
import "../../../css/component/StaffCard.css";
import { formatTime } from "../../utils/time";
import React, { useEffect, useState } from "react";
import { Modal } from "antd";   // <<-- import Modal จาก antd
import { toast } from "react-toastify"; // <<-- Add this import
import "react-toastify/dist/ReactToastify.css"; // <<-- Add this import for toast styles

function StaffPage({ id }) {
  const navigate = useNavigate();
  const params = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [staffList, setStaffList] = useState([]);

  // ใช้ documentId จาก params หรือ props แทน id
  const documentId = params.documentId || id || params.id;

  useEffect(() => {
    if (documentId) {
      fetch(`http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${documentId}`)
        .then(res => res.json())
        .then(json => {
          const store = Array.isArray(json.data) ? json.data[0] : json.data;
          setPharmacy(store?.attributes || store || null);
        });
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      const token = localStorage.getItem('jwt');
      fetch(
        `http://localhost:1337/api/staff-profiles?filters[drug_stores][documentId][$eq]=${documentId}&populate[users_permissions_user][populate]=true&populate=profileimage`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      )
        .then(res => res.json())
        .then(json => {
          setStaffList(Array.isArray(json.data) ? json.data : []);
        });
    }
  }, [documentId]);

  // แก้เป็นใช้ Antd Modal.confirm
  // แก้เฉพาะฟังก์ชัน deleteStaff ให้ robust ขึ้น
  const deleteStaff = (staffId, staffDocumentId, userId, staffName) => {
    Modal.confirm({
      title: `ลบ "${staffName}"?`,
      content: "ลบ staff-profile และบัญชีผู้ใช้ที่เกี่ยวข้อง (ย้อนกลับไม่ได้)",
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

          const log = (...args) => console.log("[DeleteStaff]", ...args);

          const safeDeleteStaffById = async (sid) => {
            if (!sid) return;
            log("DELETE staff-profile id:", sid);
            const res = await fetch(
              `http://localhost:1337/api/staff-profiles/${sid}`,
              { method: "DELETE", headers: authHeaders }
            );
            const text = await res.text().catch(() => "");
            log("DELETE staff-profile resp:", res.status, text || "<empty>");
            if (!res.ok && res.status !== 404) {
              throw new Error("ลบ staff-profile ไม่สำเร็จ (" + res.status + ")");
            }
          };

          const getStaffById = async (sid) => {
            if (!sid) return null;
            const res = await fetch(
              `http://localhost:1337/api/staff-profiles/${sid}?_=${Date.now()}`,
              { headers: authHeaders }
            );
            log("GET staff-profile by id:", sid, "=>", res.status);
            if (!res.ok) return null;
            const js = await res.json().catch(() => null);
            return js?.data || null;
          };

          const findAndDeleteRelated = async () => {
            const qs = new URLSearchParams();
            if (documentId) {
              // เกี่ยวกับร้านนี้
              qs.append("filters[$or][0][documentId][$eq]", documentId);
              qs.append("filters[$or][1][drug_stores][documentId][$eq]", documentId);
            }
            if (userId) {
              // หรือเกี่ยวกับ user นี้
              qs.append("filters[$or][2][users_permissions_user][id][$eq]", String(userId));
            }
            // เก็บกวาดพวกกำพร้าในร้านนี้ (ไม่มี user แล้ว)
            if (documentId) {
              qs.append("filters[$or][3][users_permissions_user][$null]", "true");
              qs.append("filters[$and][0][drug_stores][documentId][$eq]", documentId);
            }
            qs.append("pagination[pageSize]", "100");
            qs.append("fields[0]", "id");

            const url = `http://localhost:1337/api/staff-profiles?${qs.toString()}&_=${Date.now()}`;
            log("FALLBACK query:", url);
            const res = await fetch(url, { headers: authHeaders });
            log("FALLBACK status:", res.status);
            if (!res.ok) return;
            const js = await res.json().catch(() => null);
            const items = Array.isArray(js?.data) ? js.data : [];
            log("FALLBACK found:", items.map((x) => x?.id));
            for (const it of items) {
              if (it?.id) await safeDeleteStaffById(it.id);
            }
          };

          try {
            log("BEGIN delete", { staffId, staffDocumentId, userId, documentId });

            // 1) ลบ staff-profile ตัวที่กด
            await safeDeleteStaffById(staffId);

            // 2) ลบ user
            if (userId) {
              log("DELETE user id:", userId);
              try {
                const resUser = await fetch(
                  `http://localhost:1337/api/users/${userId}`,
                  { method: "DELETE", headers: authHeaders }
                );
                const text = await resUser.text().catch(() => "");
                log("DELETE user resp:", resUser.status, text || "<empty>");
                // ไม่ throw ถ้า 404
              } catch (e) {
                log("DELETE user error (ignored):", e?.message);
              }
            }

            // 3) ตรวจซ้ำ ถ้ายังอยู่ ลบซ้ำ
            const still = await getStaffById(staffId);
            if (still) {
              log("still exists -> delete again:", staffId);
              await safeDeleteStaffById(staffId);
            }

            // 4) กวาดลบตัวที่ยังค้าง (เกี่ยวกับร้านนี้/ผู้ใช้นี้ หรือกำพร้า)
            await findAndDeleteRelated();

            // 5) รีเฟรช (no-store)
            if (documentId) {
              const listRes = await fetch(
                `http://localhost:1337/api/staff-profiles?filters[drug_stores][documentId][$eq]=${documentId}&populate[users_permissions_user][populate]=true&populate=profileimage&_=${Date.now()}`,
                { headers: authHeaders }
              );
              const js = await listRes.json().catch(() => ({}));
              log("REFRESH list count:", Array.isArray(js?.data) ? js.data.length : null);
              setStaffList(Array.isArray(js?.data) ? js.data : []);
            }

            Modal.success({ content: "ลบพนักงานและบัญชีผู้ใช้สำเร็จ" });
            resolve();
          } catch (err) {
            console.error(err);
            Modal.error({ content: err?.message || "เกิดข้อผิดพลาดในการลบพนักงาน" });
            reject(err);
          }
        }),
    });
  };


  return (
    <div className="staffpage-bg">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      <main className="staffpage-main">
        <div className="staffpage-container">
          <div className="staffpage-header-row">
            <h2 className="staffpage-title">พนักงานประจำร้านยา:</h2>
            <button
              className="staffpage-add-btn"
              onClick={() => navigate(`/form_staff?pharmacyId=${documentId}`)}
            >
              เพิ่มพนักงาน
            </button>
          </div>
          {/* แสดงรายการพนักงาน */}
          {staffList.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', marginTop: '32px', width: '100%' }}>
              ไม่พบข้อมูลพนักงานในร้านยานี้
            </div>
          ) : (
            staffList.map(staff => {
              const user = staff.users_permissions_user?.data?.attributes || staff.users_permissions_user || staff.attributes?.users_permissions_user;
              const profileImg =
                staff.profileimage?.data?.attributes?.formats?.thumbnail?.url ||
                staff.profileimage?.data?.attributes?.url ||
                staff.profileimage?.formats?.thumbnail?.url ||
                staff.profileimage?.url ||
                null;
              const staffDocumentId = staff.documentId || staff.attributes?.documentId;
              const userId = 
                staff.users_permissions_user?.data?.id ||
                staff.attributes?.users_permissions_user?.data?.id ||
                staff.users_permissions_user?.id ||
                staff.attributes?.users_permissions_user?.id ||
                null;
              const staffName = user?.full_name || 'พนักงาน';

              return (
                <div className="staff-card" key={staff.id}>
                  <div className="staff-card-image staff-card-image-box">
                    {profileImg ? (
                      <img
                        src={
                          profileImg.startsWith('/')
                            ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${profileImg}`
                            : profileImg
                        }
                        alt="รูปภาพพนักงาน"
                        className="staff-card-image-img"
                      />
                    ) : (
                      <>รูปภาพ<br />พนักงาน</>
                    )}
                  </div>
                  <div className="staff-card-details">
                    <div>
                      <b>ชื่อ:</b> {user?.full_name?.split(' ')[0] || '…'} <b>นามสกุล:</b> {user?.full_name?.split(' ')[1] || '…'}
                    </div>
                    <div>
                      <b>เบอร์โทรศัพท์:</b> {user?.phone || '…'}
                    </div>
                    <div>
                      <b>เวลาทำงาน:</b>{" "}
                      {staff.time_start && staff.time_end
                        ? `${formatTime(staff.time_start)} - ${formatTime(staff.time_end)}`
                        : '…'}
                    </div>
                  </div>
                  <button
                    className="staff-card-edit-btn"
                    onClick={() => {
                      if (!staff.id) {
                        toast.error("ไม่พบ ID ของพนักงาน ไม่สามารถแก้ไขได้");
                        return;
                      }
                      navigate(`/form_staff?documentId=${staffDocumentId}&pharmacyId=${documentId}`);
                    }}
                  >
                    กด<br />เพื่อแก้ไข
                  </button>
                  <button 
                    className="staff-card-delete-btn"
                    onClick={() => deleteStaff(staff.id, staffDocumentId, userId, staffName)}
                  >
                    ลบ
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default StaffPage;