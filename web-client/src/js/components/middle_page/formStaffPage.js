import React, { useRef, useState, useEffect } from "react";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import "../../../css/theme.css";

function FormStaffPage() {
  const { documentId: paramId, id } = useParams();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("documentId");
  const documentId = paramId || id || queryId;
  const pharmacyId = searchParams.get('pharmacyId');

  // State
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    username: "",
    password: "",
    userId: "",
    position: "",
    profileImage: null,
    timeStart: "",
    timeEnd: "",
    workDays: [],
  });
  const [profileImage, setProfileImage] = useState(null);
  const [isNewUser, setIsNewUser] = useState(true);
  const [existingUsers, setExistingUsers] = useState([]);
  const [originalStaff, setOriginalStaff] = useState(null);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  // ดึง user เดิมที่ยังไม่เป็น staff ร้านนี้
  // useEffect ดึง user staff เฉพาะคนที่ยังไม่ได้เป็น staff ร้านนี้
  useEffect(() => {
    if (!documentId && pharmacyId) {
      (async () => {
        const token = localStorage.getItem('jwt');
        // 1. users ที่ role เป็น staff
        const usersRes = await fetch(
          'http://localhost:1337/api/users?filters[role][name][$eq]=staff',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        let users = await usersRes.json();
        if (!Array.isArray(users)) users = [];

        // 2. staff-profiles ร้านนี้
        const staffRes = await fetch(
          `http://localhost:1337/api/staff-profiles?filters[drug_store][documentId][$eq]=${pharmacyId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const staffProfiles = await staffRes.json();
        // staff-profiles ที่ร้านนี้
        const staffUserIds = Array.isArray(staffProfiles.data)
          ? staffProfiles.data.map(profile =>
              profile.users_permissions_user?.id ||
              profile.users_permissions_user ||
              null
            ).filter(Boolean)
          : [];

        // 3. filter users ที่ยังไม่มี staff-profile ในร้านนี้
        const selectableUsers = users.filter(u => !staffUserIds.includes(u.id));
        setExistingUsers(selectableUsers);
      })();
    }
  }, [pharmacyId, documentId]);

  // โหลดข้อมูลเดิมกรณีแก้ไข
  useEffect(() => {
    if (!documentId) return;
    const token = localStorage.getItem('jwt');
    fetch(
      `http://localhost:1337/api/staff-profiles?filters[documentId][$eq]=${documentId}&populate=*`,
      { headers: { Authorization: token ? `Bearer ${token}` : "" } }
    )
      .then(res => res.json())
      .then(json => {
        const staffRaw = json.data?.[0];
        if (!staffRaw) {
          toast.error("ไม่พบข้อมูลพนักงาน");
          return;
        }
        const user = staffRaw.users_permissions_user || {};
        setOriginalStaff(staffRaw);
        setForm({
          firstName: user.full_name?.split(" ")[0] || "",
          lastName: user.full_name?.split(" ")[1] || "",
          phone: user.phone || "",
          username: user.username || "",
          password: "",
          userId: user.id || "",
          position: staffRaw.position || "",
          profileImage: null,
          timeStart: staffRaw.time_start?.split(':').slice(0, 2).join(':') || "",
          timeEnd: staffRaw.time_end?.split(':').slice(0, 2).join(':') || "",
          workDays: staffRaw.working_days || [],
        });
        const profileImg = staffRaw.profileimage || {};
        const imageUrl = profileImg.formats?.thumbnail?.url || profileImg.url || null;
        if (imageUrl) {
          const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
          setProfileImage(imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl);
        }
      })
      .catch(() => toast.error("ไม่พบข้อมูลพนักงาน"));
  }, [documentId]);

  // ฟังก์ชัน input ต่างๆ
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm(f => ({ ...f, profileImage: e.target.files[0] }));
      setProfileImage(URL.createObjectURL(e.target.files[0]));
    }
  };
  const handleUploadClick = () => fileInputRef.current.click();
  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    setForm(f => ({
      ...f,
      workDays: checked
        ? [...f.workDays, value]
        : f.workDays.filter((day) => day !== value),
    }));
  };

  // เวลาสร้างใหม่
  const createStaffProfile = async () => {
    try {
      const token = localStorage.getItem('jwt');
      let userId = form.userId;
      // กรณี user ใหม่
      if (isNewUser) {
        // 1. Get role ID for 'staff'
        const roleRes = await fetch('http://localhost:1337/api/users-permissions/roles', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const roleData = await roleRes.json();
        const staffRole = roleData.roles.find(r => r.name === 'staff');
        const targetRoleId = staffRole?.id;

        // 2. สร้าง user ใหม่ (ไม่ใส่ role)
        const userData = {
          username: form.username,
          password: form.password,
          email: `${form.username}@example.com`,
        };
        const userRes = await fetch(`http://localhost:1337/api/auth/local/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        });
        if (!userRes.ok) throw new Error("เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้");
        const user = await userRes.json();
        userId = user?.user?.id;

        // 3. PATCH full_name, phone, และ role
        await fetch(`http://localhost:1337/api/users/${userId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: `${form.firstName} ${form.lastName}`.trim(),
            phone: form.phone,
            role: targetRoleId, // อัพเดท role ที่นี่
          }),
        });
      }
      // เช็คซ้ำก่อน
      const checkRes = await fetch(
        `http://localhost:1337/api/staff-profiles?filters[users_permissions_user]=${userId}&filters[drug_store][documentId][$eq]=${pharmacyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const checkData = await checkRes.json();
      if (checkData.data?.length > 0) {
        toast.error("user นี้เป็น staff ของร้านนี้อยู่แล้ว");
        return;
      }
      // สร้าง staff-profile ใหม่
      const staffData = {
        data: {
          position: form.position,
          users_permissions_user: userId,
          drug_store: pharmacyId,
          time_start: form.timeStart ? `${form.timeStart}:00.000` : null,
          time_end: form.timeEnd ? `${form.timeEnd}:00.000` : null,
          working_days: form.workDays,
        },
      };
      const staffRes = await fetch(`http://localhost:1337/api/staff-profiles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(staffData),
      });
      if (!staffRes.ok) throw new Error("เกิดข้อผิดพลาดในการสร้างข้อมูลพนักงาน");
      const staff = await staffRes.json();
      const staffId = staff?.data?.id;
      // อัพโหลดรูป
      if (form.profileImage && staffId) {
        const formData = new FormData();
        formData.append("files", form.profileImage);
        formData.append("ref", "api::staff-profile.staff-profile");
        formData.append("refId", staffId);
        formData.append("field", "profileimage");
        await fetch(`http://localhost:1337/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }
      toast.success("เพิ่มพนักงานสำเร็จ");
      navigate(-1, { state: { toastMessage: "เพิ่มพนักงานสำเร็จ" } });
    } catch (err) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการเพิ่มพนักงาน");
    }
  };

  // เวลาบันทึกแก้ไข
  const updateStaffProfile = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const staff = originalStaff;
      const userId = staff?.users_permissions_user?.id;
      // อัปเดต staff-profile
      const staffData = {
        data: {
          position: form.position,
          users_permissions_user: userId,
          time_start: form.timeStart ? `${form.timeStart}:00.000` : null,
          time_end: form.timeEnd ? `${form.timeEnd}:00.000` : null,
          working_days: form.workDays,
        },
      };
      await fetch(`http://localhost:1337/api/staff-profiles/${documentId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(staffData),
      });
      // อัปเดต user (optional)
      await fetch(`http://localhost:1337/api/users/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: `${form.firstName} ${form.lastName}`.trim(),
          phone: form.phone,
        }),
      });
      // อัพโหลดรูป
      if (form.profileImage && staff.id) {
        const formData = new FormData();
        formData.append("files", form.profileImage);
        formData.append("ref", "api::staff-profile.staff-profile");
        formData.append("refId", staff.id);
        formData.append("field", "profileimage");
        await fetch(`http://localhost:1337/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }
      toast.success("แก้ไขข้อมูลพนักงานสำเร็จ");
      navigate(-1, { state: { toastMessage: "แก้ไขข้อมูลพนักงานสำเร็จ" } });
    } catch (err) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูลพนักงาน");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.timeStart && form.timeEnd && form.timeStart >= form.timeEnd) {
      toast.error("เวลาเริ่มงานต้องก่อนเวลาเลิกงาน");
      return;
    }
    if (documentId) {
      updateStaffProfile();
    } else {
      createStaffProfile();
    }
  };

  return (
    <div className="signup-page-container">
      <HomeHeader />
      <ToastContainer />
      <div className="signup-content">
        <div className="signup-note">
          <b>{documentId ? "แก้ไขข้อมูลพนักงานร้านยา" : "เพิ่มข้อมูลพนักงานร้านยา"}</b>
        </div>
        <form className="signup-form" onSubmit={handleSubmit}>
          {!documentId && (
            <div style={{ marginBottom: 12 }}>
              <label>
                <input type="radio" checked={isNewUser} onChange={() => setIsNewUser(true)} /> สร้าง user ใหม่
              </label>
              <label style={{ marginLeft: 16 }}>
                <input type="radio" checked={!isNewUser} onChange={() => setIsNewUser(false)} /> เลือก user ที่มีอยู่แล้ว
              </label>
            </div>
          )}
          <div className="signup-form-flex">
            <div className="signup-form-left">
              {!documentId && !isNewUser && (
                <div>
                  <label>เลือก user ที่มีอยู่ในระบบ</label>
                  <select
                    name="userId"
                    value={form.userId}
                    onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                    required
                  >
                    <option value="">-- เลือก user --</option>
                    {existingUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.username} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(isNewUser || documentId) && (
                <>
                  <label>ชื่อ<span className="required">*</span></label>
                  <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required />
                  <label>นามสกุล<span className="required">*</span></label>
                  <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required />
                  <label>เบอร์โทรศัพท์</label>
                  <input type="text" name="phone" value={form.phone} onChange={handleChange} />
                  <label>USERNAME<span className="required">*</span></label>
                  <input
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    required
                    disabled={!!documentId} // Disable when editing
                  />
                  <label>PASSWORD</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required={isNewUser && !documentId} // Required only for new users
                  />
                </>
              )}
              <label>ตำแหน่งงาน<span className="required">*</span></label>
              <input type="text" name="position" value={form.position} onChange={handleChange} required />
              <div className="form-group">
                <label>เวลาเริ่มงานและเวลาหยุดงาน</label>
                <div className="time-input-group">
                  <input type="time" name="timeStart" value={form.timeStart} onChange={handleChange} className="time-input" />
                  <span className="time-separator">ถึง</span>
                  <input type="time" name="timeEnd" value={form.timeEnd} onChange={handleChange} className="time-input" />
                </div>
              </div>
              <div className="form-group">
                <label>เลือกวันทำงาน</label>
                <div className="workdays-checkbox-group">
                  {["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"].map((day) => (
                    <label key={day} className="checkbox-label">
                      <input
                        type="checkbox"
                        value={day}
                        checked={form.workDays.includes(day)}
                        onChange={handleCheckboxChange}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="signup-form-right">
              <label>เพิ่มรูปภาพพนักงาน</label>
              <div className="signup-upload-box" onClick={handleUploadClick}>
                {profileImage ? (
                  <img src={profileImage} alt="profile" className="signup-profile-preview" />
                ) : (
                  <span className="signup-upload-icon">&#8682;</span>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleImageChange} />
              </div>
            </div>
          </div>
          <button type="submit" className="signup-submit-btn">{documentId ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}</button>
        </form>
        <div className="signup-footer-note">
          <span>" * " หมายถึง จำเป็นต้องใส่</span>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default FormStaffPage;
