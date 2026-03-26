import React, { useRef, useState, useEffect } from "react";
// Footer is rendered globally in App.js
import HomeHeader from "../../components/HomeHeader";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { API } from '../../../utils/apiConfig';

function EditStaffProfile() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
    profileImage: null,
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingData, setEditingData] = useState({ position: '', workSchedule: [] });
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ position: '', workSchedule: [] });
  const [modalStaffId, setModalStaffId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const loadStaffData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const userDocumentId = localStorage.getItem('user_documentId');

        if (!userDocumentId) {
          toast.error('ไม่พบข้อมูลผู้ใช้');
          navigate('/login');
          return;
        }

        // โหลดข้อมูล user ปัจจุบัน
        const userRes = await fetch(API.users.me(), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');

        const user = await userRes.json();
        console.log('User data:', user);

        // เก็บ user id
        setUserId(user.id);

        // แปลงชื่อ
        const fullName = user.full_name || "";
        const nameParts = fullName.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        setForm(prev => ({
          ...prev,
          firstName: firstName,
          lastName: lastName,
          phone: user.phone || "",
          username: user.username || "",
          profileImage: null,
        }));

        // โหลดข้อมูล staff profiles ของร้านทั้งหมดที่ทำงานอยู่
        // ใช้ user.id จาก API response แทน userDocumentId
        const staffRes = await fetch(
          API.staffProfiles.list(`filters[users_permissions_user][id][$eq]=${user.id}&populate[0]=drug_store&populate[1]=users_permissions_user&populate[2]=profileimage`),
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (staffRes.ok) {
          const staffData = await staffRes.json();
          const profiles = Array.isArray(staffData.data) ? staffData.data : [];
          setStaffProfiles(profiles);

          // ดึงรูปภาพจาก staff profile แรก
          if (profiles.length > 0 && profiles[0].profileimage) {
            let imageUrl = null;
            const profileImg = profiles[0].profileimage;

            // เช็ค documentId ก่อน
            if (profileImg?.documentId) {
              const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
              imageUrl = `${base}/api/upload/files/${profileImg.documentId}/serve`;
            } else if (profileImg?.data?.documentId) {
              const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
              imageUrl = `${base}/api/upload/files/${profileImg.data.documentId}/serve`;
            } else if (profileImg?.data?.attributes) {
              const imgAttr = profileImg.data.attributes;
              imageUrl = imgAttr?.formats?.thumbnail?.url || imgAttr?.url || null;
              if (imageUrl) {
                const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
                imageUrl = imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl;
              }
            } else if (profileImg?.formats) {
              imageUrl = profileImg.formats.thumbnail?.url || profileImg.url || null;
              if (imageUrl) {
                const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
                imageUrl = imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl;
              }
            } else if (typeof profileImg === "string") {
              imageUrl = profileImg;
            }

            if (imageUrl) {
              setUploadedImageUrl(imageUrl);
            }
          }
        }

      } catch (error) {
        console.error('Error loading staff data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };

    loadStaffData();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm(f => ({ ...f, profileImage: e.target.files[0] }));
      setImagePreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUploadClick = () => fileInputRef.current.click();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ตรวจสอบ password
    if (form.password || form.confirmPassword) {
      if (!form.password) {
        toast.error('กรุณากรอกรหัสผ่าน');
        return;
      }
      if (!form.confirmPassword) {
        toast.error('กรุณากรอกยืนยันรหัสผ่าน');
        return;
      }
      if (form.password.length < 6) {
        toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }
    }

    try {
      const token = localStorage.getItem('jwt');

      // อัปเดตข้อมูล user โดยใช้ userId ที่เก็บไว้
      const userData = {
        full_name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
      };

      // ถ้ามีการแก้ไขรหัสผ่าน
      if (form.password) {
        userData.password = form.password;
      }

      const userUpdateRes = await fetch(API.users.update(userId), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (!userUpdateRes.ok) {
        throw new Error("เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้");
      }

      // ถ้ามีรูปภาพใหม่ ให้อัปโหลดและอัปเดต
      if (form.profileImage) {
        const formData = new FormData();
        formData.append("files", form.profileImage);

        const uploadRes = await fetch(API.upload(), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const uploadJson = await uploadRes.json();
        const uploadedImageId = uploadJson?.[0]?.id;

        if (uploadedImageId) {
          // อัปเดต profileimage ในทุก staff profile
          for (const profile of staffProfiles) {
            await fetch(API.staffProfiles.update(profile.documentId), {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                data: {
                  profileimage: uploadedImageId,
                },
              }),
            });
          }
        }
      }

      toast.success("แก้ไขข้อมูลส่วนตัวสำเร็จ");
      setForm(f => ({ ...f, password: '', confirmPassword: '' }));
      navigate(-1);

    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล");
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  // 💡 รวบรวมเวลาทำงานทั้งหมดจาก profile (รวมจากทุก field และ nested attributes) และจัดเรียง/ลบซ้ำ
  const getAggregatedWorkingTimesFromProfile = (profile) => {
    if (!profile) return [];
    const collected = [];

    // normalize source into array of entries
    const entriesFrom = (src) => {
      if (!src) return [];
      if (Array.isArray(src)) return src;
      if (Array.isArray(src.data)) return src.data;
      return [];
    };

    const pushIfValid = (day, time_in, time_out) => {
      if (!day || !time_in || !time_out) return;
      const d = typeof day === "string" ? day.trim() : day;
      collected.push({ day: d, start_time: time_in, end_time: time_out });
    };

    const addFrom = (src) => {
      const arr = entriesFrom(src);
      arr.forEach((entry) => {
        const wt = entry?.attributes ? entry.attributes : entry;
        // support common variants
        const day = wt?.day || wt?.weekday || wt?.name;
        const time_in = wt?.time_in || wt?.timeIn || wt?.open || wt?.start_time;
        const time_out = wt?.time_out || wt?.timeOut || wt?.close || wt?.end_time;
        pushIfValid(day, time_in, time_out);
      });
    };

    // gather from multiple possible fields/shapes
    addFrom(profile.work_schedule);
    addFrom(profile.attributes?.work_schedule);
    addFrom(profile.attributes?.work_schedule?.data);
    addFrom(profile.working_days); // legacy field
    addFrom(profile.attributes?.working_days);

    if (collected.length === 0) return [];

    // dedupe by day/time
    const keySet = new Set();
    const unique = [];
    collected.forEach((t) => {
      const key = `${t.day}|${t.start_time}|${t.end_time}`;
      if (!keySet.has(key)) {
        keySet.add(key);
        unique.push(t);
      }
    });

    const dayOrder = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"];
    unique.sort((a,b) => {
      const da = dayOrder.indexOf(a.day);
      const db = dayOrder.indexOf(b.day);
      if (da !== db) return da - db;
      if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
      return a.end_time.localeCompare(b.end_time);
    });

    return unique;
  };

  const handleEditStaff = (profile) => {
    setModalStaffId(profile.documentId);
    // ใช้ aggregated times สำหรับ modal
    const aggregatedTimes = getAggregatedWorkingTimesFromProfile(profile);
    setModalData({
      position: profile.position || '',
      workSchedule: aggregatedTimes.length > 0 ? aggregatedTimes : (profile.work_schedule || [])
    });
    setShowModal(true);
  };

  const handleSaveStaffEdit = async (staffDocumentId) => {
    try {
      // ตรวจสอบเวลาชนกัน
      const conflicts = checkTimeConflict();
      if (conflicts.length > 0) {
        const conflictMsg = conflicts.map(c => 
          `🏪 ${c.pharmacy}: วัน${c.day} (คุณ: ${c.currentTime}, ร้านนี้: ${c.otherTime})`
        ).join('\n');
        toast.error(`⚠️ เวลาทำงานชนกับร้านอื่น:\n${conflictMsg}`);
        return;
      }

      const token = localStorage.getItem('jwt');
      
      const staffData = {
        data: {
          position: modalData.position,
          work_schedule: modalData.workSchedule,
        }
      };

      const updateRes = await fetch(API.staffProfiles.update(staffDocumentId), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(staffData),
      });

      if (!updateRes.ok) throw new Error("ไม่สามารถบันทึกข้อมูลได้");

      toast.success("บันทึกข้อมูลร้านยาสำเร็จ");
      setShowModal(false);
      setModalStaffId(null);
      
      // รีเฟรชข้อมูล
      const staffRes = await fetch(
        API.staffProfiles.list(`filters[users_permissions_user][id][$eq]=${userId}&populate[0]=drug_store&populate[1]=users_permissions_user&populate[2]=profileimage`),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        const profiles = Array.isArray(staffData.data) ? staffData.data : [];
        setStaffProfiles(profiles);
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const handleCancelEdit = () => {
    setShowModal(false);
    setModalStaffId(null);
    setModalData({ position: '', workSchedule: [] });
  };

  const handleAddWorkDay = () => {
    setModalData(prev => ({
      ...prev,
      workSchedule: [...prev.workSchedule, { day: '', start_time: '', end_time: '' }]
    }));
  };

  const handleRemoveWorkDay = (index) => {
    setModalData(prev => ({
      ...prev,
      workSchedule: prev.workSchedule.filter((_, i) => i !== index)
    }));
  };

  const handleWorkScheduleChange = (index, field, value) => {
    setModalData(prev => ({
      ...prev,
      workSchedule: prev.workSchedule.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const timeToMinutes = (timeString) => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const checkTimeConflict = () => {
    const currentSchedule = modalData.workSchedule || [];
    const conflicts = [];

    // ตรวจสอบกับเวลาทำงานของร้านอื่น
    for (let i = 0; i < staffProfiles.length; i++) {
      const profile = staffProfiles[i];
      if (profile.documentId === modalStaffId) continue; // ข้ามตัวเอง

      const otherSchedule = profile.work_schedule || [];
      
      for (const current of currentSchedule) {
        if (!current.day || !current.start_time || !current.end_time) continue;

        for (const other of otherSchedule) {
          if (!other.day || !other.start_time || !other.end_time) continue;
          
          if (current.day === other.day) {
            const currentStart = timeToMinutes(current.start_time);
            const currentEnd = timeToMinutes(current.end_time);
            const otherStart = timeToMinutes(other.start_time);
            const otherEnd = timeToMinutes(other.end_time);

            // ตรวจสอบว่าเวลาซ้อนทับกันหรือไม่
            if (!(currentEnd <= otherStart || currentStart >= otherEnd)) {
              const pharmacy = profile.drug_store?.name_th || 'ไม่ระบุชื่อ';
              conflicts.push({
                pharmacy: pharmacy,
                day: current.day,
                currentTime: `${current.start_time} - ${current.end_time}`,
                otherTime: `${other.start_time} - ${other.end_time}`
              });
            }
          }
        }
      }
    }

    return conflicts;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <HomeHeader />
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <HomeHeader />
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-[1200px] mx-auto bg-white rounded-[24px] shadow-xl shadow-slate-200/50 overflow-hidden relative border border-slate-100 p-6 md:p-12">
          {/* Decorative Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600" />
          
          <div className="text-3xl font-bold text-slate-800 text-center mb-10 flex items-center justify-center gap-3">
            <span>✏️</span>
            <b>แก้ไขข้อมูลส่วนตัว</b>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
              {/* Form Left Content */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block ml-1">ชื่อ <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block ml-1">นามสกุล <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block ml-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-slate-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block ml-1">USERNAME</label>
                  <input
                    type="text"
                    name="username"
                    value={form.username}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed italic"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block ml-1">รหัสผ่านใหม่</label>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="ปล่อยว่างไว้หากไม่ต้องแก้ไข"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block ml-1">ยืนยันรหัสผ่าน</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Pharmacy Section */}
                <div className="pt-6 border-t border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="w-2 h-8 bg-sky-500 rounded-full" />
                    ร้านยาที่ทำงานอยู่ ({staffProfiles.length} ร้าน)
                  </h3>
                  
                  <div className="space-y-4">
                    {staffProfiles.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-slate-50 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200">
                        ไม่มีข้อมูลร้านยา
                      </div>
                    ) : (
                      staffProfiles.map((profile, index) => {
                        const pharmacy = profile.drug_store;
                        const aggregatedTimes = getAggregatedWorkingTimesFromProfile(profile);
                        let workScheduleText = 'ไม่มีข้อมูลเวลา';

                        if (aggregatedTimes.length > 0) {
                          workScheduleText = aggregatedTimes
                            .map(t => `${t.day}: ${formatTimeForDisplay(t.start_time)} - ${formatTimeForDisplay(t.end_time)}`)
                            .join(', ');
                        }

                        return (
                          <div key={profile.documentId} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="flex gap-4">
                                <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center font-bold text-sky-600 shrink-0">
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 text-lg group-hover:text-sky-600 transition-colors">
                                    {pharmacy?.name_th || 'ไม่ระบุชื่อ'}
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg uppercase">
                                      {profile.position || 'ไม่ระบุตำแหน่ง'}
                                    </span>
                                    <span className="px-3 py-1 bg-sky-50 text-sky-600 text-xs font-medium rounded-lg">
                                      ⏰ {workScheduleText}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleEditStaff(profile)}
                                className="w-full sm:w-auto px-5 py-2.5 bg-sky-100 hover:bg-sky-500 text-sky-600 hover:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                              >
                                ✏️ แก้ไข
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Image Section */}
              <div className="bg-slate-50 rounded-2xl p-10 border-2 border-slate-100 flex flex-col items-center gap-6 group hover:border-sky-200 transition-colors">
                <label className="text-sm font-black text-slate-400 uppercase tracking-widest">รูปภาพโปรไฟล์</label>
                <div 
                  className="relative w-48 h-48 rounded-[40px] overflow-hidden bg-white shadow-xl shadow-slate-200 flex items-center justify-center cursor-pointer border-4 border-white group-hover:scale-105 transition-transform duration-500"
                  onClick={handleUploadClick}
                >
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="profile" className="w-full h-full object-cover" />
                  ) : uploadedImageUrl ? (
                    <img src={uploadedImageUrl} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📤</span>
                      <span className="text-xs font-bold text-slate-400">คลิกเพื่ออัปโหลด</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-white font-bold text-sm bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/30">เปลี่ยนรูป</span>
                  </div>
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageChange} />
                </div>
                <p className="text-xs text-slate-400 text-center max-w-[200px] leading-relaxed italic">แนะนำรูปภาพสัดส่วน 1:1 และมีพื้นหลังเรียบง่าย</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 border-t border-slate-100">
               <button
                type="button"
                className="order-2 sm:order-1 px-10 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                onClick={handleCancel}
              >
                ← ย้อนกลับ
              </button>
              <button 
                type="submit" 
                className="order-1 sm:order-2 px-10 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
              >
                💾 บันทึกการแก้ไข
              </button>
            </div>
            
            <div className="text-center text-xs text-slate-400">
              <span className="text-rose-500 font-bold">*</span> หมายถึง ข้อมูลที่จำเป็นต้องกรอก
            </div>
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCancelEdit} />
          
          <div className="relative w-full max-w-lg bg-white rounded-[24px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <span>📝</span> แก้ไขข้อมูลร้านยา
              </h3>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400" 
                onClick={handleCancelEdit}
              >✕</button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Position Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 block">ตำแหน่ง <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={modalData.position}
                  onChange={(e) => setModalData({...modalData, position: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  placeholder="เช่น เภสัชกร, พนักงาน"
                />
              </div>

              {/* Work Schedule */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 block">ตารางเวลาทำงาน</label>
                <div className="space-y-3">
                  {modalData.workSchedule.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 text-center text-slate-400 font-medium italic border border-slate-100">
                      ยังไม่มีตารางเวลา
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {modalData.workSchedule.map((schedule, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <select
                            value={schedule.day || ''}
                            onChange={(e) => handleWorkScheduleChange(idx, 'day', e.target.value)}
                            className="flex-grow px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm"
                          >
                            <option value="">เลือกวัน</option>
                            {['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={schedule.start_time || ''}
                              onChange={(e) => handleWorkScheduleChange(idx, 'start_time', e.target.value)}
                              className="px-2 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                              type="time"
                              value={schedule.end_time || ''}
                              onChange={(e) => handleWorkScheduleChange(idx, 'end_time', e.target.value)}
                              className="px-2 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveWorkDay(idx)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                          >🗑️</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleAddWorkDay}
                    className="w-full py-3 border-2 border-dashed border-sky-200 text-sky-500 hover:bg-sky-50 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                    disabled={modalData.workSchedule.length >= 7}
                  >
                    + เพิ่มวันทำงาน
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex flex-col gap-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                >ยกเลิก</button>
                <button
                  type="button"
                  onClick={() => handleSaveStaffEdit(modalStaffId)}
                  className="flex-[2] py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
                >บันทึกข้อมูล</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditStaffProfile;