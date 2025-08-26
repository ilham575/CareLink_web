import React, { useRef, useState, useEffect } from "react";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useParams, useSearchParams } from "react-router-dom";
import "../../../css/theme.css";

function FormStaffPage() {
  const { documentId: paramId, id } = useParams();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("documentId");

  const documentId = paramId || id || queryId;
  const pharmacyId = searchParams.get('pharmacyId');
  const [profileImage, setProfileImage] = useState(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    username: "",
    password: "",
    position: "",
    profileImage: null,
    timeStart: "", // Add timeStart field
    timeEnd: "",   // Add timeEnd field
  });
  const [originalStaff, setOriginalStaff] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    if (!documentId) {
      toast.error("ไม่พบ documentId ของพนักงาน");
      return;
    }

    const token = localStorage.getItem('jwt');

    fetch(
      `http://localhost:1337/api/staff-profiles?filters[documentId][$eq]=${documentId}&populate=*`,
      { headers: { Authorization: token ? `Bearer ${token}` : "" } }
    )
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(json => {
        const staffRaw = json.data?.[0];
        if (!staffRaw) {
          toast.error("ไม่พบข้อมูลพนักงาน");
          return;
        }

        const staff = {
          id: staffRaw.id,
          position: staffRaw.position,
          ...staffRaw.attributes,
          users_permissions_user: staffRaw.users_permissions_user,
          profileimage: staffRaw.profileimage,
        };

        const user = staff.users_permissions_user || {};
        const userId = staff.users_permissions_user?.id;
        const profileImg = staff.profileimage || {};

        setOriginalStaff({ ...staff, userId });

        setForm({
          firstName: user.full_name?.split(" ")[0] || "",
          lastName: user.full_name?.split(" ")[1] || "",
          phone: user.phone || "",
          username: user.username || "",
          password: "",
          position: staff.position || "",
          profileImage: null,
          timeStart: staffRaw.time_start?.split(':').slice(0, 2).join(':') || "",
          timeEnd: staffRaw.time_end?.split(':').slice(0, 2).join(':') || "",
        });

        const imageUrl =
          profileImg.formats?.thumbnail?.url || profileImg.url || null;

        if (imageUrl) {
          const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
          const fullUrl = imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl;
          setProfileImage(fullUrl);
        }
      })
      .catch(err => {
        toast.error(`ไม่พบข้อมูลพนักงาน ID: ${documentId}`);
      });
  }, [documentId]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm((f) => ({ ...f, profileImage: e.target.files[0] }));
      setProfileImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUploadClick = () => fileInputRef.current.click();

  const updateStaffProfile = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const staff = originalStaff;

      if (!staff?.id) {
        throw new Error("ไม่พบ ID ของพนักงาน");
      }

      const userId = staff?.users_permissions_user?.id;
      if (!userId) {
        throw new Error("ไม่พบ ID ของผู้ใช้ที่เกี่ยวข้อง");
      }

      const formatTime = (time) => {
        if (!time) return null;
        return `${time}:00.000`;
      };

      const staffData = {
        data: {
          position: form.position,
          users_permissions_user: userId,
          time_start: formatTime(form.timeStart),
          time_end: formatTime(form.timeEnd),
        },
      };

      const staffRes = await fetch(`http://localhost:1337/api/staff-profiles/${documentId}?populate=*`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(staffData),
      });

      if (!staffRes.ok) {
        const staffError = await staffRes.json();
        throw new Error(staffError?.error?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลพนักงาน");
      }

      const userData = {
        full_name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
      };
      if (form.password) userData.password = form.password;

      const userRes = await fetch(`http://localhost:1337/api/users/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!userRes.ok) {
        const userError = await userRes.json();
        throw new Error(userError?.error?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้");
      }

      if (form.profileImage) {
        const formData = new FormData();
        formData.append("files", form.profileImage);
        formData.append("ref", "api::staff-profile.staff-profile");
        formData.append("refId", staff.id);
        formData.append("field", "profileimage");

        const uploadRes = await fetch(`http://localhost:1337/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) {
          toast.warning("บันทึกข้อมูลสำเร็จ แต่อัพโหลดรูปภาพไม่สำเร็จ");
        } else {
          const uploadResult = await uploadRes.json();
          const uploadedImageId = uploadResult?.[0]?.id;

          if (uploadedImageId) {
            await fetch(`http://localhost:1337/api/staff-profiles/${documentId}?populate=*`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                data: {
                  profileimage: uploadedImageId
                },
              }),
            });
          }
        }
      }

      toast.success("แก้ไขข้อมูลพนักงานสำเร็จ");
    } catch (err) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูลพนักงาน");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (documentId) {
      updateStaffProfile();
    } else {
      toast.error("ไม่พบ documentId ของพนักงาน");
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
          <div className="signup-form-flex">
            <div className="signup-form-left">
              <label>ชื่อ<span className="required">*</span></label>
              <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required />

              <label>นามสกุล<span className="required">*</span></label>
              <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required />

              <label>เบอร์โทรศัพท์</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange} />

              <label>USERNAME<span className="required">*</span></label>
              <input type="text" name="username" value={form.username} onChange={handleChange} required disabled />

              <label>PASSWORD</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="เปลี่ยนรหัสผ่านใหม่หากต้องการ" />

              <label>ตำแหน่งงาน<span className="required">*</span></label>
              <input type="text" name="position" value={form.position} onChange={handleChange} required />

              <div className="form-group">
                <label>เวลาเริ่มงานและเวลาหยุดงาน</label>
                <div className="time-input-group">
                  <input
                    type="time"
                    name="timeStart"
                    value={form.timeStart}
                    onChange={handleChange}
                    className="time-input"
                    placeholder="เวลาเริ่มงาน"
                  />
                  <span className="time-separator">ถึง</span>
                  <input
                    type="time"
                    name="timeEnd"
                    value={form.timeEnd}
                    onChange={handleChange}
                    className="time-input"
                    placeholder="เวลาหยุดงาน"
                  />
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
