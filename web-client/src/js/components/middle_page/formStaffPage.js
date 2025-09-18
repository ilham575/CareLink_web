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
    profileImage: null, // file object
    timeStart: "",
    timeEnd: "",
    workDays: [],
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // preview ชั่วคราว
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null); // รูปจริงจาก Strapi
  const [isNewUser, setIsNewUser] = useState(true);
  const [existingUsers, setExistingUsers] = useState([]);
  const [originalStaff, setOriginalStaff] = useState(null);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  // ===== 1. ดึง user สำหรับเลือก (แก้ไขแล้ว) =====
  // ===== 1. ดึง user สำหรับเลือก (แก้ไขแล้ว) =====
  useEffect(() => {
    if (!documentId && pharmacyId) {
      (async () => {
        const token = localStorage.getItem('jwt');
        
        // หา internal ID ของร้าน
        const drugStoreRes = await fetch(
          `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${pharmacyId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const drugStoreJson = await drugStoreRes.json();
        
        // *** แก้ไข: หาร้านที่ตรงกับ documentId แทนการใช้ [0] ***
        const targetStore = drugStoreJson.data?.find(store => store.documentId === pharmacyId);
        
        if (!targetStore) {
          return;
        }
        
        const drugStoreInternalId = targetStore.id;
        
        if (!drugStoreInternalId) {
          return;
        }

        const usersRes = await fetch(
          'http://localhost:1337/api/users?filters[role][name][$eq]=staff',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        let users = await usersRes.json();
        if (!Array.isArray(users)) users = [];
        
        // ใช้ internal ID ในการ filter
        const staffRes = await fetch(
          `http://localhost:1337/api/staff-profiles?filters[drug_store]=${drugStoreInternalId}&populate=users_permissions_user`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const staffProfiles = await staffRes.json();
        
        const staffUserIds = Array.isArray(staffProfiles.data)
          ? staffProfiles.data.map(profile =>
              profile.users_permissions_user?.id ||
              profile.users_permissions_user ||
              null
            ).filter(Boolean)
          : [];
          
        const selectableUsers = users.filter(u => !staffUserIds.includes(u.id));
        
        setExistingUsers(selectableUsers);
      })();
    }
  }, [pharmacyId, documentId]);

  // ===== 2. โหลดข้อมูล staff-profile เดิม =====
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
          profileImage: null, // reset ฟิลด์ไฟล์
          timeStart: staffRaw.time_start?.split(':').slice(0, 2).join(':') || "",
          timeEnd: staffRaw.time_end?.split(':').slice(0, 2).join(':') || "",
          workDays: staffRaw.working_days || [],
        });

        // รูปจริงจาก Strapi
        let imageUrl = null;
        if (staffRaw.profileimage?.data) {
          const imgAttr = staffRaw.profileimage.data.attributes;
          imageUrl = imgAttr?.formats?.thumbnail?.url || imgAttr?.url || null;
        }
        if (!imageUrl && staffRaw.profileimage?.formats) {
          imageUrl = staffRaw.profileimage.formats.thumbnail?.url || staffRaw.profileimage.url || null;
        }
        if (!imageUrl && typeof staffRaw.profileimage === "string") {
          imageUrl = staffRaw.profileimage;
        }
        if (imageUrl) {
          const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
          setUploadedImageUrl(imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl);
        } else {
          setUploadedImageUrl(null);
        }
        setImagePreviewUrl(null); // reset preview
      })
      .catch(() => toast.error("ไม่พบข้อมูลพนักงาน"));
  }, [documentId]);

  // ===== 3. Input/Preview image =====
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm(f => ({ ...f, profileImage: e.target.files[0] }));
      setImagePreviewUrl(URL.createObjectURL(e.target.files[0])); // preview
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

  // ===== 4. Unlink รูปเก่า (ถ้ามี) ก่อน upload ใหม่ =====
  const unlinkOldProfileImage = async (staffId, token) => {
    await fetch(`http://localhost:1337/api/staff-profiles/${staffId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: { profileimage: null } }),
    });
  };

  // ===== 5. Upload รูปใหม่แล้ว patch ใส่ staff-profile =====
  const uploadProfileImageAndUpdateStaff = async (profileImage, _documentId) => {
    const token = localStorage.getItem('jwt');
    if (!profileImage || !_documentId) return;
    // หา staffId จาก documentId
    const profileRes = await fetch(
      `http://localhost:1337/api/staff-profiles?filters[documentId][$eq]=${_documentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const profileJson = await profileRes.json();
    const staff = profileJson?.data?.[0];
    const staffId = profileJson?.data?.[0]?.id;
    if (!staffId) {
      toast.error("ไม่พบ staff-profile ที่จะอัพเดตรูป");
      return;
    }
    // unlink รูปเก่า
    await unlinkOldProfileImage(staffId, token);
    // upload file
    const formData = new FormData();
    formData.append("files", profileImage);
    const uploadRes = await fetch(`http://localhost:1337/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    if (!Array.isArray(uploadJson) || !uploadJson[0]?.id) {
      toast.error("อัพโหลดรูปไม่สำเร็จ");
      return;
    }
    const imageId = uploadJson[0].id;
    // patch profileimage
    const patchRes = await fetch(
      `http://localhost:1337/api/staff-profiles/${staffId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { profileimage: imageId } }),
      }
    );
    if (!patchRes.ok) {
      toast.error("อัพเดตรูปใน staff-profile ไม่สำเร็จ");
      return;
    }
    // ดึง url จริงมาแสดงใหม่
    const profileAfter = await fetch(
      `http://localhost:1337/api/staff-profiles/${staffId}?populate=profileimage`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const afterJson = await profileAfter.json();
    let imageUrl = null;
    if (afterJson?.data?.attributes?.profileimage?.data) {
      const imgAttr = afterJson.data.attributes.profileimage.data.attributes;
      imageUrl = imgAttr?.formats?.thumbnail?.url || imgAttr?.url || null;
    }
    if (imageUrl) {
      const base = process.env.REACT_APP_API_URL || "http://localhost:1337";
      setUploadedImageUrl(imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl);
    }
    setImagePreviewUrl(null); // ลบ preview ออก
    toast.success("อัพโหลดรูปสำเร็จ");
  };

  const getDrugStoreIdFromDocumentId = async (documentId) => {
    const token = localStorage.getItem('jwt');
    const res = await fetch(
      `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${documentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json();
    return json.data?.[0]?.documentId;
  };

  // ===== 6. Create staff-profile (แก้ไขแล้ว) =====
  // ===== 6. Create staff-profile (Debug ครอบคลุม) =====
  const createStaffProfile = async () => {
    try {
      const token = localStorage.getItem('jwt');
      let userId = form.userId;

      if (isNewUser) {
        const roleRes = await fetch('http://localhost:1337/api/users-permissions/roles', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const roleData = await roleRes.json();

        const staffRole = roleData.roles.find(r => r.name === 'staff');
        const targetRoleId = staffRole?.id;

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

        if (!userRes.ok) throw new Error("เกิดข้อผิดพลาดในการสร้างบัชชีผู้ใช้");
        const user = await userRes.json();

        userId = user?.user?.id;

        await fetch(`http://localhost:1337/api/users/${userId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: `${form.firstName} ${form.lastName}`.trim(),
            phone: form.phone,
            role: targetRoleId,
          }),
        });
      }

      // *** ลอง URL หลายแบบ ***
      // วิธีที่ 1: แบบเดิม
      const url1 = `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${pharmacyId}`;
      
      const drugStoreRes1 = await fetch(url1, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const drugStoreJson1 = await drugStoreRes1.json();

      // วิธีที่ 2: ลอง encode URI
      const url2 = `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${encodeURIComponent(pharmacyId)}`;
      
      const drugStoreRes2 = await fetch(url2, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const drugStoreJson2 = await drugStoreRes2.json();

      // วิธีที่ 3: ดึงทุกร้านแล้วหาเอง
      const url3 = `http://localhost:1337/api/drug-stores`;
      
      const drugStoreRes3 = await fetch(url3, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const drugStoreJson3 = await drugStoreRes3.json();
      
      // *** ใช้วิธีที่ 3 (ดึงทุกร้านแล้วหาเอง) เพื่อความแน่ใจ ***
      const targetStore = drugStoreJson3.data?.find(store => {
        return store.documentId === pharmacyId;
      });
      
      if (!targetStore) {
        toast.error(`ไม่พบร้านยาที่มี documentId: ${pharmacyId}`);
        return null;
      }
      
      const drugStoreInternalId = targetStore.id;
      // ตรวจสอบ duplicate อีกรอบ
      const checkUrl = `http://localhost:1337/api/staff-profiles?filters[users_permissions_user]=${userId}&filters[drug_store]=${drugStoreInternalId}`;
      
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const checkData = await checkRes.json();

      if (checkData.data?.length > 0) {
        toast.error("user นี้เป็น staff ของร้านนี้อยู่แล้ว");
        return null;
      }

      // *** สร้าง staff profile ***
      const staffData = {
        data: {
          position: form.position,
          users_permissions_user: {
            connect: [userId]
          },
          drug_store: {
            connect: [drugStoreInternalId]
          },
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

      if (!staffRes.ok) {
        const errorText = await staffRes.text();
        throw new Error("เกิดข้อผิดพลาดในการสร้างข้อมูลพนักงาน: " + errorText);
      }

      const staff = await staffRes.json();
      const newDocumentId = staff?.data?.documentId;
      if (!newDocumentId) {
        throw new Error("ไม่พบ documentId ของ staff profile ที่สร้าง");
      }

      // ดึงข้อมูล staff พร้อม populate
      const verifyUrl = `http://localhost:1337/api/staff-profiles/${newDocumentId}?populate=drug_store,users_permissions_user`;
      
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        
        const linkedDrugStore = verifyData.data?.drug_store;
        if (linkedDrugStore) {
          if (linkedDrugStore.documentId !== pharmacyId) {
            // ลบ staff profile ที่สร้างผิด
            await fetch(`http://localhost:1337/api/staff-profiles/${newDocumentId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.error('สร้าง staff ไปผิดร้าน! ได้ลบออกแล้ว กรุณาลองใหม่');
            return null;
          } 
        } else {
          console.error('Debug - ERROR: No drug_store relation found!');
        }
      }

      toast.success("เพิ่มพนักงานสำเร็จ");
      return newDocumentId;
    } catch (err) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการเพิ่มพนักงาน");
      return null;
    }
  };

  // ===== 7. Update staff-profile =====
  const updateStaffProfile = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const staff = originalStaff;
      const userId = staff?.users_permissions_user?.id;
      const staffId = staff?.id;
      const staffDocumentId = staff?.documentId;

      if (!staffId) {
        toast.error("เกิดข้อผิดพลาด: ไม่พบ staff id ที่จะ update");
        return null;
      }

      const staffData = {
        data: {
          position: form.position,
          users_permissions_user: userId,
          time_start: form.timeStart ? `${form.timeStart}:00.000` : null,
          time_end: form.timeEnd ? `${form.timeEnd}:00.000` : null,
          working_days: form.workDays,
        },
      };

      const staffUpdateRes = await fetch(`http://localhost:1337/api/staff-profiles/${staffDocumentId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(staffData),
      });

      if (!staffUpdateRes.ok) {
        throw new Error("เกิดข้อผิดพลาดในการอัปเดตข้อมูล staff-profile");
      }

      const userData = {
        full_name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
      };

      const userUpdateRes = await fetch(`http://localhost:1337/api/users/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (!userUpdateRes.ok) {
        throw new Error("เกิดข้อผิดพลาดในการอัปเดตข้อมูล user");
      }

      toast.success("แก้ไขข้อมูลพนักงานสำเร็จ");

      return staffDocumentId;
    } catch (err) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูลพนักงาน");
      return null;
    }
  };

  // ===== 8. SUBMIT =====
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.timeStart && form.timeEnd && form.timeStart >= form.timeEnd) {
      toast.error("เวลาเริ่มงานต้องก่อนเวลาเลิกงาน");
      return;
    }

    const token = localStorage.getItem("jwt");
    let docId = documentId;
    let uploadedImageId = null;

    try {
      // 1. ถ้ามีรูป → อัปโหลดรูปก่อน
      if (form.profileImage) {
        const formData = new FormData();
        formData.append("files", form.profileImage);

        const uploadRes = await fetch("http://localhost:1337/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const uploadJson = await uploadRes.json();
        uploadedImageId = uploadJson?.[0]?.id;

        if (!uploadedImageId) {
          toast.error("อัปโหลดรูปภาพไม่สำเร็จ");
          return;
        }
      }

      // 2. ถ้าไม่มี docId → แสดงว่าเป็นการเพิ่ม
      if (!docId) {
        docId = await createStaffProfile();
        if (!docId) {
          toast.error("สร้างพนักงานไม่สำเร็จ");
          return;
        }
      } else {
        // 3. ถ้ามี docId → อัปเดตข้อมูล (ไม่รวมรูป)
        const updated = await updateStaffProfile();
        if (!updated) {
          toast.error("อัปเดตพนักงานไม่สำเร็จ");
          return;
        }
      }

      // 4. ถ้ามีรูปที่อัปโหลด → PATCH ด้วย docId (ค้น internal id)
      if (uploadedImageId && docId) {
        const staffRes = await fetch(
          `http://localhost:1337/api/staff-profiles?filters[documentId][$eq]=${docId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const staffJson = await staffRes.json();
        const internalId = staffJson?.data?.[0]?.id;

        if (!internalId) {
          toast.error("ไม่พบพนักงานจาก docId");
          return;
        }

        const patchRes = await fetch(
          `http://localhost:1337/api/staff-profiles/${docId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: {
                profileimage: uploadedImageId,
              },
            }),
          }
        );

        if (!patchRes.ok) {
          toast.error("อัปเดตรูปภาพไม่สำเร็จ");
          return;
        }

        toast.success("อัปโหลดและผูกรูปภาพสำเร็จ");
      }

      // 5. กลับหน้าก่อน พร้อม toast
      navigate(-1, {
        state: {
          toastMessage: documentId
            ? "แก้ไขข้อมูลพนักงานสำเร็จ"
            : "เพิ่มพนักงานสำเร็จ",
        },
      });
    } catch (err) {
      console.error("เกิดข้อผิดพลาด:", err);
      toast.error("เกิดข้อผิดพลาดระหว่างบันทึกข้อมูล");
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
                    disabled={!!documentId}
                  />
                  <label>PASSWORD</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required={isNewUser && !documentId}
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
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="profile" className="signup-profile-preview" />
                ) : uploadedImageUrl ? (
                  <img src={uploadedImageUrl} alt="profile" className="signup-profile-preview" />
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
