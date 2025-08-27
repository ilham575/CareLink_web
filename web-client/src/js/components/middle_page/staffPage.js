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

          console.log("💡 DEBUG staffId:", staffId);
          

          const removeRelation = async () => {
            if (!staffId) return;
            log("🔗 PATCH null relation for staff:", staffId);
            const res = await fetch(
              `http://localhost:1337/api/staff-profiles/${staffId}`,
              {
                method: "PUT",
                headers: {
                  ...authHeaders,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  data: {
                    users_permissions_user: null, // ตัดความสัมพันธ์ก่อน
                  },
                }),
              }
            );
            log("PATCH relation status:", res.status);
            if (!res.ok) {
              throw new Error("ตัดความสัมพันธ์กับ user ไม่สำเร็จ");
            }
          };

          const deleteStaffProfile = async () => {
            if (!staffId) return;
            log("🗑️ DELETE staff-profile id:", staffId);
            const res = await fetch(
              `http://localhost:1337/api/staff-profiles/${staffId}`,
              { method: "DELETE", headers: authHeaders }
            );
            log("DELETE staff-profile resp:", res.status);
            if (!res.ok && res.status !== 404) {
              throw new Error("ลบ staff-profile ไม่สำเร็จ");
            }
          };

          const deleteUser = async () => {
            if (!userId) return;
            log("🗑️ DELETE user id:", userId);
            try {
              const res = await fetch(
                `http://localhost:1337/api/users/${userId}`,
                { method: "DELETE", headers: authHeaders }
              );
              const text = await res.text().catch(() => "");
              log("DELETE user resp:", res.status, text || "<empty>");
            } catch (e) {
              log("DELETE user error (ignored):", e?.message);
            }
          };

          const refreshList = async () => {
            if (!documentId) return;
            const res = await fetch(
              `http://localhost:1337/api/staff-profiles?filters[drug_stores][documentId][$eq]=${documentId}&populate[users_permissions_user][populate]=true&populate=profileimage&_=${Date.now()}`,
              { headers: authHeaders }
            );
            const js = await res.json().catch(() => ({}));
            const newList = Array.isArray(js?.data) ? js.data : [];
            log("🔄 REFRESH list count:", newList.length);
            setStaffList(newList);
          };

          try {
            log("🚀 BEGIN delete", { staffId, staffDocumentId, userId });

            await removeRelation();        // ✅ 1. ตัด relation
            await deleteStaffProfile();    // ✅ 2. ลบ staff-profile
            await deleteUser();            // ✅ 3. ลบ user-permission

            await refreshList();           // ✅ 4. รีเฟรช

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
                <div className="staff-card staff-card-hover" key={staff.id}>
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