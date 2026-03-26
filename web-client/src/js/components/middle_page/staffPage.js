import { useLocation, useNavigate, useParams } from "react-router-dom";
import HomeHeader from "../HomeHeader";
import { formatTime } from "../../utils/time";
import React, { useEffect, useState } from "react";
import { Modal } from "antd";   // <<-- import Modal จาก antd
import { toast } from "react-toastify";
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-prompt">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 p-8 mb-10 border border-slate-100">
          {/* Decorative Pattern */}
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 font-prompt">
            <div className="space-y-1">
              <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold tracking-wider uppercase mb-2">
                Team Management
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                พนักงานประจำร้านยา
              </h2>
              <p className="text-slate-400 font-medium font-prompt">จัดการข้อมูลบุคลากรและตารางเวลาทำงานของทีมงานในระบบของคุณ</p>
            </div>
            
            <button
              className="group relative px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 overflow-hidden font-prompt"
              onClick={() => navigate(`/form_staff?pharmacyId=${documentId}`)}
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              <span>เพิ่มพนักงานใหม่</span>
            </button>
          </div>
        </div>
        {/* Staff List Grid */}
        {staffList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm font-prompt">
            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">ไม่พบข้อมูลพนักงาน</h3>
            <p className="text-slate-400 font-medium max-w-xs text-center leading-relaxed">
              ยังไม่มีการบันทึกข้อมูลพนักงานในร้านรายนี้ คุณสามารถเริ่มเพิ่มพนักงานได้โดยกดที่ปุ่มด้านบน
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 font-prompt">
            {staffList.map(staff => {
              const user = staff.users_permissions_user?.data?.attributes || staff.users_permissions_user || staff.attributes?.users_permissions_user;
              const profileImageObj = staff.profileimage?.data?.attributes || staff.profileimage || null;
              const profileImg = profileImageObj?.documentId 
                ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}/api/upload/files/${profileImageObj.documentId}/serve`
                : null;
              const staffDocumentId = staff.documentId || staff.attributes?.documentId;
              const userId = 
                staff.users_permissions_user?.data?.id ||
                staff.attributes?.users_permissions_user?.data?.id ||
                staff.users_permissions_user?.id ||
                staff.attributes?.users_permissions_user?.id ||
                null;
              const staffName = user?.full_name || 'พนักงาน';

              return (
                <div 
                  key={staff.id} 
                  className="bg-white rounded-[2.5rem] p-8 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col h-full group"
                >
                  <div className="flex items-start gap-6 mb-8">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-24 h-24 rounded-[1.8rem] bg-indigo-50 border-2 border-indigo-100 overflow-hidden shadow-inner flex items-center justify-center">
                        {profileImg ? (
                          <img
                            src={profileImg}
                            alt={staffName}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-2 opacity-30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>
                            <span className="text-[8px] font-black uppercase mt-1 leading-none">NO PHOTO</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg ring-4 ring-white">
                        <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>

                    {/* Basic Info */}
                    <div className="flex-grow min-w-0 pt-2 font-prompt">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                          {staff.position || 'พนักงาน'}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 truncate leading-none mb-2">
                        {user?.full_name || 'ไม่พบชื่อ'}
                      </h3>
                      <div className="flex items-center gap-2 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        <span className="text-sm font-bold">{user?.phone || 'ไม่ระบุเบอร์โทร'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Work Schedule */}
                  <div className="bg-slate-50/80 rounded-[2rem] p-6 mb-6 flex-grow font-prompt">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">ตารางเวลาทำงาน</span>
                    </div>
                    
                    <div className="space-y-2">
                      {staff.work_schedule && Array.isArray(staff.work_schedule) && staff.work_schedule.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {staff.work_schedule.map((schedule, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                              <span className="text-[11px] font-black text-slate-500 w-12">{schedule.day}:</span>
                              <span className="text-[11px] font-bold text-slate-800">{schedule.start_time} - {schedule.end_time}</span>
                            </div>
                          ))}
                        </div>
                      ) : staff.working_days && staff.working_days.length > 0 ? (
                        <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-xs font-black text-slate-800 mb-1">{staff.working_days.join(", ")}</p>
                          <p className="text-xs font-bold text-indigo-600">{formatTime(staff.time_start)} - {formatTime(staff.time_end)}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 opacity-30">
                          <p className="text-xs font-bold italic">ไม่ระบุตารางเวลา</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50 font-prompt">
                    <button
                      className="flex items-center justify-center gap-2 px-4 py-4 bg-indigo-50 text-indigo-700 font-black rounded-2xl hover:bg-indigo-100 transition-all active:scale-95 group"
                      onClick={() => {
                        if (!staff.id) {
                          toast.error("ไม่พบ ID ของพนักงาน ไม่สามารถแก้ไขได้");
                          return;
                        }
                        navigate(`/form_staff?documentId=${staffDocumentId}&pharmacyId=${documentId}`);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      แก้ไขสมาชิก
                    </button>
                    
                    <button 
                      className="flex items-center justify-center gap-2 px-4 py-4 bg-rose-50 text-rose-600 font-black rounded-2xl hover:bg-rose-100 transition-all active:scale-95 group"
                      onClick={() => deleteStaff(staff.id, staffDocumentId, userId, staffName)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      ลบพนักงาน
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-12 flex justify-center pb-10">
          <button
            className="group flex items-center gap-3 px-10 py-4 bg-white text-slate-500 font-black rounded-[2rem] shadow-sm border border-slate-100 hover:text-slate-800 hover:shadow-lg hover:border-slate-200 transition-all duration-300 active:scale-95 font-prompt"
            onClick={() => navigate("/pharmacyHome")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
            กลับสู่หน้าหลัก
          </button>
        </div>
      </main>
    </div>
  );
}

export default StaffPage;