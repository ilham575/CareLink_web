import { useLocation, useNavigate, useParams } from "react-router-dom";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import "../../../css/pages/default/staffPage.css";
import "../../../css/component/StaffCard.css";
import { formatTime } from "../../utils/time";
import React, { useEffect, useState } from "react";
import { Modal } from "antd";   // <<-- import Modal จาก antd
import { toast, ToastContainer } from "react-toastify"; // <<-- Add ToastContainer import
import "react-toastify/dist/ReactToastify.css"; // <<-- Add this import for toast styles
import { API } from "../../../utils/apiConfig";

function StaffPage({ id }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  // ใช้ documentId จาก params หรือ props แทน id
  const documentId = params.documentId || id || params.id;

  useEffect(() => {
    if (documentId) {
      // *** ดึงทุกร้าน ***
      fetch(API.drugStores.list())
        .then(res => res.json())
        .then(json => {
          // หา record ที่ documentId ตรงกับที่ต้องการ
          const store = Array.isArray(json.data)
            ? json.data.find(item =>
                (item.documentId || item.attributes?.documentId) === documentId
              )
            : null;

          setPharmacy(store?.attributes || store || null);
        });
    }
  }, [documentId]);


  useEffect(() => {
    if (documentId) {
      const token = localStorage.getItem('jwt');
      fetch(
        API.staffProfiles.list(`filters[drug_store][documentId][$eq]=${documentId}&populate[users_permissions_user][populate]=true&populate=profileimage`),
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

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage);
    }
  }, [location.state]);

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

          const removeRelation = async () => {
            if (!staffId) return;
            const res = await fetch(
              API.staffProfiles.update(staffDocumentId),
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
            if (!res.ok) {
              throw new Error("ตัดความสัมพันธ์กับ user ไม่สำเร็จ");
            }
          };

          const deleteStaffProfile = async () => {
            if (!staffId) return;
            const res = await fetch(
              API.staffProfiles.delete(staffDocumentId),
              { method: "DELETE", headers: authHeaders }
            );
            if (!res.ok && res.status !== 404) {
              throw new Error("ลบ staff-profile ไม่สำเร็จ");
            }
          };

          const deleteUser = async () => {
            if (!userId) return;
            // ตรวจสอบว่ามี staff-profile อื่นที่เชื่อมกับ userId นี้หรือไม่
            const checkRes = await fetch(
              API.staffProfiles.list(`filters[users_permissions_user][id][$eq]=${userId}`),
              { headers: authHeaders }
            );
            const checkJson = await checkRes.json().catch(() => ({}));
            const relatedProfiles = Array.isArray(checkJson?.data) ? checkJson.data : [];
            // ถ้ามีมากกว่า 1 record (หรือแม้แต่ 1 recordที่ไม่ใช่ staffDocumentId นี้) ให้ไม่ลบ user
            const otherProfiles = relatedProfiles.filter(
              profile => profile.id !== staffId
            );
            if (otherProfiles.length > 0) return; // ยังมี profile อื่นเชื่อม user นี้อยู่

            // ถ้าไม่มี profile อื่นเชื่อม user นี้ ค่อยลบ
            try {
              const res = await fetch(
                API.users.delete(userId),
                { method: "DELETE", headers: authHeaders }
              );
              await res.text().catch(() => "");
            } catch (e) {}
          };

          const refreshList = async () => {
            if (!documentId) return;
            const res = await fetch(
              API.staffProfiles.list(`filters[drug_store][documentId][$eq]=${documentId}&populate[users_permissions_user][populate]=true&populate=profileimage&_=${Date.now()}`),
              { headers: authHeaders }
            );
            const js = await res.json().catch(() => ({}));
            const newList = Array.isArray(js?.data) ? js.data : [];
            setStaffList(newList);
          };

          try {
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
      <ToastContainer />
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
                      <b>ตารางเวลาทำงาน:</b>
                      <div style={{ marginLeft: '10px', fontSize: '12px' }}>
                        {staff.work_schedule && Array.isArray(staff.work_schedule) ? (
                          staff.work_schedule.map((schedule, idx) => (
                            <div key={idx}>
                              {schedule.day}: {schedule.start_time} - {schedule.end_time}
                            </div>
                          ))
                        ) : staff.working_days && staff.working_days.length > 0 ? (
                          // แสดงข้อมูลเก่า
                          <div>
                            {staff.working_days.join(", ")}: {formatTime(staff.time_start)} - {formatTime(staff.time_end)}
                          </div>
                        ) : (
                          '…'
                        )}
                      </div>
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
      <div className="back-button-container" style={{ textAlign: 'center', margin: '24px 0' }}>
        <button
          className="back-button"
          onClick={() => navigate("/pharmacyHome")}
        >
          กลับ
        </button>
      </div>
      <Footer />
    </div>
  );
}

export default StaffPage;