import React, { useRef, useState, useEffect } from "react";
import Footer from "../../components/footer";
import HomeHeader from "../../components/HomeHeader";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import '../../../css/pages/staff/editStaffProfile.css';
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

        // โหลดข้อมูล user
        const userRes = await fetch(API.users.list(), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');

        const user = await userRes.json();
        console.log('User data:', user);

        // แปลงชื่อ
        const fullName = user.full_name || "";
        const nameParts = fullName.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        setForm({
          firstName: firstName,
          lastName: lastName,
          phone: user.phone || "",
          username: user.username || "",
          profileImage: null,
        });

        // โหลดข้อมูล staff profiles ของร้านทั้งหมดที่ทำงานอยู่
        const staffRes = await fetch(
          API.staffProfiles.list(`filters[users_permissions_user][documentId][$eq]=${userDocumentId}&populate[0]=drug_store&populate[1]=users_permissions_user&populate[2]=profileimage`),
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

            if (profileImg?.data?.attributes) {
              const imgAttr = profileImg.data.attributes;
              imageUrl = imgAttr?.formats?.thumbnail?.url || imgAttr?.url || null;
            } else if (profileImg?.formats) {
              imageUrl = profileImg.formats.thumbnail?.url || profileImg.url || null;
            } else if (typeof profileImg === "string") {
              imageUrl = profileImg;
            }

            if (imageUrl) {
              const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
              setUploadedImageUrl(imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl);
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
      const userDocumentId = localStorage.getItem('user_documentId');

      // อัปเดตข้อมูล user
      const userData = {
        full_name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
      };

      // ถ้ามีการแก้ไขรหัสผ่าน
      if (form.password) {
        userData.password = form.password;
      }

      const userUpdateRes = await fetch(API.users.update(userDocumentId), {
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

  const handleEditStaff = (profile) => {
    setModalStaffId(profile.documentId);
    setModalData({
      position: profile.position || '',
      workSchedule: profile.work_schedule && Array.isArray(profile.work_schedule) ? profile.work_schedule : (profile.working_days || [])
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
        API.staffProfiles.list(`filters[users_permissions_user][documentId][$eq]=${localStorage.getItem('user_documentId')}&populate[0]=drug_store&populate[1]=users_permissions_user&populate[2]=profileimage`),
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
      <div className="edit-profile-page-container">
        <HomeHeader />
        <div className="edit-profile-content">
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div className="loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="edit-profile-page-container">
      <HomeHeader />
      <ToastContainer />
      <div className="edit-profile-content">
        <div className="edit-profile-note">
          <b>แก้ไขข้อมูลส่วนตัว</b>
        </div>
        <form className="edit-profile-form" onSubmit={handleSubmit}>
          <div className="edit-profile-form-flex">
            <div className="edit-profile-form-left">
              <label>ชื่อ<span className="required">*</span></label>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
              />

              <label>นามสกุล<span className="required">*</span></label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
              />

              <label>เบอร์โทรศัพท์</label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />

              <label>USERNAME</label>
              <input
                type="text"
                name="username"
                value={form.username}
                disabled
                className="disabled-input"
              />

              <label>รหัสผ่านใหม่ (ถ้าต้องการแก้ไข)</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="ปล่อยว่างไว้หากไม่ต้องแก้ไข"
              />

              <label>ยืนยันรหัสผ่าน</label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              />

              {/* แสดงข้อมูลร้านที่ทำงานอยู่ */}
              <div className="staff-pharmacies-section">
                <label>ร้านยาที่ทำงานอยู่ ({staffProfiles.length} ร้าน)</label>
                <div className="pharmacies-list">
                  {staffProfiles.length === 0 ? (
                    <div className="no-pharmacies-message">
                      <p>ไม่มีข้อมูลร้านยา</p>
                    </div>
                  ) : (
                    staffProfiles.map((profile, index) => {
                      const pharmacy = profile.drug_store;
                      
                      // Debug: แสดงข้อมูลที่ได้มา
                      console.log('Profile data:', profile);
                      console.log('Work schedule:', profile.work_schedule);
                      console.log('Working days:', profile.working_days);
                      
                      let workScheduleText = 'ไม่มีข้อมูลเวลา';

                      if (profile.work_schedule && Array.isArray(profile.work_schedule) && profile.work_schedule.length > 0) {
                        workScheduleText = profile.work_schedule
                          .filter(s => s.day && s.start_time && s.end_time)
                          .map(s => `${s.day}: ${s.start_time} - ${s.end_time}`)
                          .join(', ');
                      } else if (profile.working_days && Array.isArray(profile.working_days) && profile.working_days.length > 0) {
                        const startTime = profile.time_start ? formatTimeForDisplay(profile.time_start) : '';
                        const endTime = profile.time_end ? formatTimeForDisplay(profile.time_end) : '';
                        if (startTime && endTime) {
                          workScheduleText = profile.working_days.map(day => `${day}: ${startTime} - ${endTime}`).join(', ');
                        }
                      }

                      return (
                        <div key={profile.documentId} className="staff-pharmacy-card">
                          <div className="edit-pharmacy-header">
                            <span className="edit-pharmacy-number">#{index + 1}</span>
                            <span className="edit-pharmacy-name">{pharmacy?.name_th || 'ไม่ระบุชื่อ'}</span>
                          </div>
                          <div className="edit-pharmacy-details">
                            <div className="edit-detail-item">
                              <span className="label">ตำแหน่ง:</span>
                              <span className="value">{profile.position || 'ไม่ระบุ'}</span>
                            </div>
                            <div className="edit-detail-item">
                              <span className="label">เวลาทำงาน:</span>
                              <span className="value">{workScheduleText}</span>
                            </div>
                            <div className="edit-detail-item">
                              <span className="label">จัดการ:</span>
                              <div className="edit-button-group">
                                <button
                                  type="button"
                                  onClick={() => handleEditStaff(profile)}
                                  className="edit-pharmacy-btn"
                                >
                                  ✏️ แก้ไข
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="edit-profile-form-right">
              <label>รูปภาพโปรไฟล์</label>
              <div className="edit-profile-upload-box" onClick={handleUploadClick}>
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="profile" className="edit-profile-profile-preview" />
                ) : uploadedImageUrl ? (
                  <img src={uploadedImageUrl} alt="profile" className="edit-profile-profile-preview" />
                ) : (
                  <span className="edit-profile-upload-icon">&#8682;</span>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleImageChange} />
              </div>
            </div>
          </div>
          <div className="edit-profile-buttons">
            <button type="submit" className="edit-profile-submit-btn">
              บันทึกการแก้ไข
            </button>
            <button
              type="button"
              className="edit-profile-cancel-btn"
              onClick={handleCancel}
            >
              ← กลับ
            </button>
          </div>
        </form>
        <div className="edit-profile-footer-note">
          <span>" * " หมายถึง จำเป็นต้องใส่</span>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 แก้ไขข้อมูลร้านยา</h3>
              <button className="modal-close-btn" onClick={handleCancelEdit}>✕</button>
            </div>

            <div className="modal-body">
              {/* Position Input */}
              <div className="modal-form-group">
                <label>ตำแหน่ง<span className="required">*</span></label>
                <input
                  type="text"
                  value={modalData.position}
                  onChange={(e) => setModalData({...modalData, position: e.target.value})}
                  className="modal-input"
                  placeholder="เช่น เภสัชกร, พนักงาน"
                />
              </div>

              {/* Work Schedule */}
              <div className="modal-form-group">
                <label>ตารางเวลาทำงาน</label>
                <div className="work-schedule-modal">
                  {modalData.workSchedule.length === 0 ? (
                    <div className="no-schedule-msg">ยังไม่มีตารางเวลา</div>
                  ) : (
                    <div className="schedule-list">
                      {modalData.workSchedule.map((schedule, idx) => (
                        <div key={idx} className="schedule-row">
                          <select
                            value={schedule.day || ''}
                            onChange={(e) => handleWorkScheduleChange(idx, 'day', e.target.value)}
                            className="schedule-day-select"
                          >
                            <option value="">เลือกวัน</option>
                            {['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={schedule.start_time || ''}
                            onChange={(e) => handleWorkScheduleChange(idx, 'start_time', e.target.value)}
                            className="schedule-time-input"
                          />
                          <span className="time-dash">-</span>
                          <input
                            type="time"
                            value={schedule.end_time || ''}
                            onChange={(e) => handleWorkScheduleChange(idx, 'end_time', e.target.value)}
                            className="schedule-time-input"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveWorkDay(idx)}
                            className="schedule-remove-btn"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleAddWorkDay}
                    className="add-schedule-btn"
                    disabled={modalData.workSchedule.length >= 7}
                  >
                    + เพิ่มวันทำงาน
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="conflict-warning" id="conflictWarning" style={{display: 'none'}}>
                <span className="warning-icon">⚠️</span>
                <span className="warning-text">มีเวลาทำงานชนกับร้านอื่น!</span>
              </div>
              <button
                type="button"
                onClick={() => handleSaveStaffEdit(modalStaffId)}
                className="modal-save-btn"
              >
                ✓ บันทึก
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="modal-cancel-btn"
              >
                ✕ ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default EditStaffProfile;