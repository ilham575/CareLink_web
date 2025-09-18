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

  // State - เปลี่ยนโครงสร้าง
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    username: "",
    password: "",
    userId: "",
    position: "",
    profileImage: null,
    workSchedule: [], // เปลี่ยนเป็น array ของ { day, start_time, end_time }
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // preview ชั่วคราว
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null); // รูปจริงจาก Strapi
  const [isNewUser, setIsNewUser] = useState(true);
  const [existingUsers, setExistingUsers] = useState([]);
  const [originalStaff, setOriginalStaff] = useState(null);
  const fileInputRef = useRef();
  const navigate = useNavigate();

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

  // ===== 2. โหลดข้อมูล staff-profile เดิม (อัพเดต) =====
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
        
        // *** แก้ไข: ปรับปรุงการแปลงข้อมูลเวลาทำงาน ***
        let workSchedule = [];
        if (staffRaw.work_schedule && Array.isArray(staffRaw.work_schedule) && staffRaw.work_schedule.length > 0) {
          // ถ้ามีข้อมูลใหม่แล้ว - ใช้ข้อมูลใหม่
          workSchedule = staffRaw.work_schedule.map(schedule => ({
            day: schedule.day || "",
            start_time: schedule.start_time || "",
            end_time: schedule.end_time || ""
          }));
        } else if (staffRaw.working_days && Array.isArray(staffRaw.working_days) && staffRaw.working_days.length > 0) {
          // แปลงจากข้อมูลเก่า - สร้างตารางเวลาจากวันทำงาน
          const startTime = staffRaw.time_start ? formatTimeForDisplay(staffRaw.time_start) : "";
          const endTime = staffRaw.time_end ? formatTimeForDisplay(staffRaw.time_end) : "";
          
          workSchedule = staffRaw.working_days.map(day => ({
            day: day,
            start_time: startTime,
            end_time: endTime
          }));
        }
        
        // *** แก้ไข: ถ้าไม่มีตารางเวลา ให้เป็น array ว่าง ***
        if (workSchedule.length === 0) {
          workSchedule = [];
        }

        setForm({
          firstName: user.full_name?.split(" ")[0] || "",
          lastName: user.full_name?.split(" ")[1] || "",
          phone: user.phone || "",
          username: user.username || "",
          password: "",
          userId: user.id || "",
          position: staffRaw.position || "",
          profileImage: null,
          workSchedule: workSchedule,
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

  // ===== เพิ่มฟังก์ชันเช็คเวลาชน =====
  const checkTimeConflict = async (userId, newWorkSchedule, excludeStaffId = null) => {
    const token = localStorage.getItem('jwt');
    
    try {
      const response = await fetch(
        `http://localhost:1337/api/staff-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=drug_store`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const data = await response.json();
      const existingProfiles = Array.isArray(data.data) ? data.data : [];
      
      const otherProfiles = excludeStaffId 
        ? existingProfiles.filter(profile => profile.id !== excludeStaffId)
        : existingProfiles;
      
      // เช็คความขัดแย้งกับแต่ละ profile
      for (const profile of otherProfiles) {
        const pharmacyName = profile.drug_store?.name_th || 'ร้านยาอื่น';
        
        // แปลงข้อมูลเก่าให้เป็นรูปแบบใหม่
        let existingSchedule = [];
        if (profile.work_schedule && Array.isArray(profile.work_schedule)) {
          existingSchedule = profile.work_schedule;
        } else if (profile.working_days && profile.time_start && profile.time_end) {
          existingSchedule = profile.working_days.map(day => ({
            day: day,
            start_time: formatTimeForDisplay(profile.time_start),
            end_time: formatTimeForDisplay(profile.time_end)
          }));
        }
        
        // เช็คความขัดแย้งระหว่างตารางเวลา
        for (const newSlot of newWorkSchedule) {
          for (const existingSlot of existingSchedule) {
            if (newSlot.day === existingSlot.day) {
              const newStartMinutes = timeToMinutes(newSlot.start_time);
              const newEndMinutes = timeToMinutes(newSlot.end_time);
              const existingStartMinutes = timeToMinutes(existingSlot.start_time);
              const existingEndMinutes = timeToMinutes(existingSlot.end_time);
              
              const isTimeOverlap = (
                (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes)
              );
              
              if (isTimeOverlap) {
                return {
                  hasConflict: true,
                  conflictDetails: {
                    pharmacyName,
                    day: newSlot.day,
                    existingTime: `${existingSlot.start_time} - ${existingSlot.end_time}`,
                    newTime: `${newSlot.start_time} - ${newSlot.end_time}`
                  }
                };
              }
            }
          }
        }
      }
      
      return { hasConflict: false };
      
    } catch (error) {
      console.error('Error checking time conflict:', error);
      return { hasConflict: false };
    }
  };

  // ===== อัพเดต Create staff-profile =====
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

      // *** เช็คเวลาชนก่อนสร้าง staff profile ***
      if (form.workSchedule.length > 0) {
        const validSchedules = form.workSchedule.filter(s => s.day && s.start_time && s.end_time);
        if (validSchedules.length > 0) {
          const conflictCheck = await checkTimeConflict(userId, validSchedules);
          
          if (conflictCheck.hasConflict) {
            const { pharmacyName, day, existingTime, newTime } = conflictCheck.conflictDetails;
            toast.error(
              `เวลาทำงานขัดแย้งกับ ${pharmacyName}\n` +
              `วัน${day}: เวลาเดิม ${existingTime}, เวลาใหม่ ${newTime}`,
              { autoClose: 8000 }
            );
            return null;
          }
        }
      }

      // *** ลอง URL หลายแบบ ***
      const url3 = `http://localhost:1337/api/drug-stores`;
      
      const drugStoreRes3 = await fetch(url3, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const drugStoreJson3 = await drugStoreRes3.json();
      
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
          work_schedule: form.workSchedule.filter(s => s.day && s.start_time && s.end_time),
          // เก็บข้อมูลเก่าไว้เพื่อ backward compatibility
          working_days: form.workSchedule.map(s => s.day).filter(Boolean),
          time_start: form.workSchedule[0]?.start_time ? `${form.workSchedule[0].start_time}:00.000` : null,
          time_end: form.workSchedule[0]?.end_time ? `${form.workSchedule[0].end_time}:00.000` : null,
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

  // ===== อัพเดต Update staff-profile =====
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

      // *** เช็คเวลาชนก่อนอัพเดต ***
      if (form.workSchedule.length > 0) {
        const validSchedules = form.workSchedule.filter(s => s.day && s.start_time && s.end_time);
        if (validSchedules.length > 0) {
          const conflictCheck = await checkTimeConflict(userId, validSchedules, staffId);
          
          if (conflictCheck.hasConflict) {
            const { pharmacyName, day, existingTime, newTime } = conflictCheck.conflictDetails;
            toast.error(
              `เวลาทำงานขัดแย้งกับ ${pharmacyName}\n` +
              `วัน${day}: เวลาเดิม ${existingTime}, เวลาใหม่ ${newTime}`,
              { autoClose: 8000 }
            );
            return null;
          }
        }
      }

      const staffData = {
        data: {
          position: form.position,
          users_permissions_user: userId,
          work_schedule: form.workSchedule.filter(s => s.day && s.start_time && s.end_time),
          // เก็บข้อมูลเก่าไว้เพื่อ backward compatibility
          working_days: form.workSchedule.map(s => s.day).filter(Boolean),
          time_start: form.workSchedule[0]?.start_time ? `${form.workSchedule[0].start_time}:00.000` : null,
          time_end: form.workSchedule[0]?.end_time ? `${form.workSchedule[0].end_time}:00.000` : null,
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

    // ตรวจสอบวันซ้ำ
    if (!validateWorkSchedule()) {
      return;
    }

    // ตรวจสอบเวลาในแต่ละวัน
    for (const schedule of form.workSchedule) {
      if (schedule.day && schedule.start_time && schedule.end_time && schedule.start_time >= schedule.end_time) {
        toast.error(`วัน${schedule.day}: เวลาเริ่มงานต้องก่อนเวลาเลิกงาน`);
        return;
      }
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

  // ===== ฟังก์ชันจัดการตารางเวลาทำงาน =====
  const handleWorkScheduleChange = (index, field, value) => {
    setForm(prevForm => ({
      ...prevForm,
      workSchedule: prevForm.workSchedule.map((schedule, i) => 
        i === index ? { ...schedule, [field]: value } : schedule
      )
    }));
  };

  const addWorkDay = () => {
    setForm(prevForm => ({
      ...prevForm,
      workSchedule: [...prevForm.workSchedule, { day: "", start_time: "", end_time: "" }]
    }));
  };

  const removeWorkDay = (index) => {
    if (form.workSchedule.length > 1) {
      setForm(prevForm => ({
        ...prevForm,
        workSchedule: prevForm.workSchedule.filter((_, i) => i !== index)
      }));
    }
  };

  // *** เพิ่มการตรวจสอบวันซ้ำ ***
  const validateWorkSchedule = () => {
    const days = form.workSchedule.map(s => s.day).filter(Boolean);
    const uniqueDays = [...new Set(days)];
    
    if (days.length !== uniqueDays.length) {
      toast.error("ไม่สามารถเลือกวันเดียวกันได้มากกว่า 1 ครั้ง");
      return false;
    }
    
    return true;
  };

  // ฟังก์ชันช่วยแปลงเวลาเป็น minutes
  const timeToMinutes = (timeString) => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  // ฟังก์ชันช่วยแสดงเวลา
  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5); // แสดงแค่ HH:MM
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
                <label>ตารางเวลาทำงาน</label>
                <div className="work-schedule-container">
                  {form.workSchedule.length === 0 ? (
                    <div className="no-schedule">
                      <p>ยังไม่มีตารางเวลาทำงาน</p>
                    </div>
                  ) : (
                    form.workSchedule.map((schedule, index) => (
                      <div key={index} className="work-schedule-row">
                        <select
                          value={schedule.day || ""}
                          onChange={(e) => handleWorkScheduleChange(index, 'day', e.target.value)}
                          className="day-select"
                          required
                        >
                          <option value="">เลือกวัน</option>
                          {["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]
                            .filter(day => 
                              // แสดงเฉพาะวันที่ยังไม่ถูกเลือก หรือวันที่เลือกอยู่ในแถวนี้
                              !form.workSchedule.some((s, i) => s.day === day && i !== index) || schedule.day === day
                            )
                            .map((day) => (
                              <option key={day} value={day}>{day}</option>
                            ))
                          }
                        </select>
                        <input
                          type="time"
                          value={schedule.start_time || ""}
                          onChange={(e) => handleWorkScheduleChange(index, 'start_time', e.target.value)}
                          className="time-input"
                          required={!!schedule.day}
                        />
                        <span className="time-separator">-</span>
                        <input
                          type="time"
                          value={schedule.end_time || ""}
                          onChange={(e) => handleWorkScheduleChange(index, 'end_time', e.target.value)}
                          className="time-input"
                          required={!!schedule.day}
                        />
                        <button
                          type="button"
                          onClick={() => removeWorkDay(index)}
                          className="remove-day-btn"
                        >
                          ลบ
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={addWorkDay}
                    className="add-day-btn"
                    disabled={form.workSchedule.length >= 7} // จำกัดไม่เกิน 7 วัน
                  >
                    + เพิ่มวันทำงาน
                  </button>
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
          <button type="submit" className="signup-submit-btn">
            {documentId ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}
          </button>
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