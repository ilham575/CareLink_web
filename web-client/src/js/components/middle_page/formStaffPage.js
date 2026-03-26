import React, { useRef, useState, useEffect } from "react";
import HomeHeader from "../HomeHeader";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { API, fetchWithAuth } from "../../../utils/apiConfig";

function FormStaffPage() {
  const { documentId: paramId, id, pharmacyId: paramPharmacyId } = useParams();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("documentId");
  // pharmacyId may be passed as a path param (/:pharmacyId) or as a query (?pharmacyId=...)
  const pharmacyId = searchParams.get('pharmacyId') || paramPharmacyId || null;
  const documentId = paramId || id || queryId;

  console.log('🔍 FormStaffPage params:', {
    paramId,
    id,
    paramPharmacyId,
    queryId,
    documentId,
    pharmacyId,
    fullParams: useParams(),
    searchParams: Object.fromEntries(searchParams.entries())
  });

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
  const [selectedUserStaffInfo, setSelectedUserStaffInfo] = useState([]); // เพิ่ม state สำหรับเก็บข้อมูล staff ของ user ที่เลือก
  const [showStaffInfoPopup, setShowStaffInfoPopup] = useState(false); // เพิ่ม state สำหรับควบคุม popup
  const [originalStaff, setOriginalStaff] = useState(null);
  const [selectedDays, setSelectedDays] = useState([]); // เพิ่ม state สำหรับเลือกหลายวัน
  const [bulkTimeIn, setBulkTimeIn] = useState(""); // เพิ่ม state สำหรับเวลาเริ่ม bulk
  const [bulkTimeOut, setBulkTimeOut] = useState(""); // เพิ่ม state สำหรับเวลาสิ้นสุด bulk
  const fileInputRef = useRef();
  const navigate = useNavigate();

  // ===== 1. ดึง user สำหรับเลือก (แก้ไขแล้ว) =====
  useEffect(() => {
    if (!documentId && pharmacyId) {
      (async () => {
        const token = localStorage.getItem('jwt');
        
        // หา internal ID ของร้าน
        const drugStoreRes = await fetch(
          API.drugStores.getByDocumentId(pharmacyId),
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
        API.users.list(),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let users = await usersRes.json();
      if (!Array.isArray(users)) users = [];
      
      // Filter users ที่มี role เป็น staff ใน frontend
      const staffUsers = users.filter(u => {
        const role = u.role;
        if (!role) return false;
        
        // เช็ค role name หรือ type
        if (typeof role === 'object') {
          return role.name === 'staff' || role.type === 'staff';
        }
        return role === 'staff';
      });        // ใช้ internal ID ในการ filter
        const staffRes = await fetch(
          API.staffProfiles.list(`filters[drug_store]=${drugStoreInternalId}&populate[0]=users_permissions_user&populate[1]=drug_store`),
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
          
        const selectableUsers = staffUsers.filter(u => !staffUserIds.includes(u.id));
        
        console.log('🔍 Debug - staffProfiles:', staffProfiles);
        console.log('🔍 Debug - staffUserIds:', staffUserIds);
        console.log('🔍 Debug - staffUsers before filter:', staffUsers.length);
        console.log('🔍 Debug - selectableUsers:', selectableUsers.length);

        setExistingUsers(selectableUsers);
      })();
    }
  }, [pharmacyId, documentId]);

  // ===== 2. โหลดข้อมูล staff-profile เดิม (อัพเดต) =====
  useEffect(() => {
    if (!documentId) return;
    
    console.log('🔍 Loading staff data for documentId:', documentId);
    console.log('🏪 pharmacyId:', pharmacyId);
    
    const token = localStorage.getItem('jwt');
    fetch(
      API.staffProfiles.list(`filters[documentId][$eq]=${documentId}&populate=*`),
      { headers: { Authorization: token ? `Bearer ${token}` : "" } }
    )
      .then(res => res.json())
      .then(json => {
        console.log('📋 API Response:', json);
        const staffRaw = json.data?.[0];
        if (!staffRaw) {
          toast.error("ไม่พบข้อมูลพนักงาน");
          return;
        }
        
        console.log('👨‍💼 Staff data found:', staffRaw);
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

        // แปลงชื่อ-นามสกุล
        const fullName = user.full_name || "";
        const nameParts = fullName.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        setForm({
          firstName: firstName,
          lastName: lastName,
          phone: user.phone || "",
          username: user.username || "",
          password: "",
          userId: user.id || "",
          position: staffRaw.position || "",
          profileImage: null,
          workSchedule: workSchedule,
        });

        console.log('📝 Form data set:', {
          fullName: fullName,
          firstName: firstName,
          lastName: lastName,
          phone: user.phone || "",
          username: user.username || "",
          position: staffRaw.position || "",
          workSchedule: workSchedule
        });

        // รูปจริงจาก Strapi - ใช้ documentId endpoint
        let imageUrl = null;
        const profileImageObj = staffRaw.profileimage?.data?.attributes || staffRaw.profileimage || null;
        if (profileImageObj?.documentId) {
          imageUrl = `${API.BASE_URL}/api/upload/files/${profileImageObj.documentId}/serve`;
        }
        if (imageUrl) {
          setUploadedImageUrl(imageUrl);
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

  // ===== 4. Unlink รูปเก่า (ถ้ามี) ก่อน upload ใหม่ =====
  const unlinkOldProfileImage = async (staffId, token) => {
    await fetch(API.staffProfiles.update(staffId), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: { profileimage: null } }),
    });
  };

  // ===== เพิ่มฟังก์ชันเช็คเวลาชน =====
  const checkTimeConflict = async (userId, newWorkSchedule, excludeStaffId = null) => {
    const token = localStorage.getItem('jwt');
    
    try {
      const response = await fetch(
        API.staffProfiles.list(`filters[users_permissions_user][id][$eq]=${userId}&populate=drug_store`),
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
        const roleRes = await fetch(API.roles.list(), {
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

        const userRes = await fetch(API.auth.register, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        });

        if (!userRes.ok) throw new Error("เกิดข้อผิดพลาดในการสร้างบัชชีผู้ใช้");
        const user = await userRes.json();

        userId = user?.user?.id;

        await fetch(API.users.getById(userId), {
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
      const url3 = API.drugStores.create();
      
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
      const checkUrl = API.staffProfiles.list(`filters[users_permissions_user]=${userId}&filters[drug_store]=${drugStoreInternalId}`);
      
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

      const staffRes = await fetch(API.staffProfiles.create(), {
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
      const verifyUrl = API.staffProfiles.list(`filters[documentId][$eq]=${newDocumentId}&populate[0]=drug_store&populate[1]=users_permissions_user`);
      
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        
        const linkedDrugStore = verifyData.data?.drug_store;
        if (linkedDrugStore) {
          if (linkedDrugStore.documentId !== pharmacyId) {
            // ลบ staff profile ที่สร้างผิด
            await fetch(API.staffProfiles.delete(newDocumentId), {
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

      const staffUpdateRes = await fetch(API.staffProfiles.update(staffDocumentId), {
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

      const userUpdateRes = await fetch(API.users.getById(userId), {
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

        const uploadRes = await fetch(API.upload(), {
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
          API.staffProfiles.list(`filters[documentId][$eq]=${docId}`),
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
          API.staffProfiles.update(docId),
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

  // 👉 เพิ่มฟังก์ชันสำหรับเพิ่มเวลา bulk (หลายวันพร้อมกัน)
  const addBulkWorkDay = () => {
    if (selectedDays.length === 0 || !bulkTimeIn || !bulkTimeOut) {
      toast.error("กรุณาเลือกวันและเวลาที่ต้องการเพิ่ม");
      return;
    }

    const newSchedules = selectedDays.map(day => ({
      day: day,
      start_time: bulkTimeIn,
      end_time: bulkTimeOut,
    }));

    setForm(prevForm => ({
      ...prevForm,
      workSchedule: [...prevForm.workSchedule, ...newSchedules]
    }));

    // Reset bulk inputs
    setSelectedDays([]);
    setBulkTimeIn("");
    setBulkTimeOut("");
  };

  // 👉 จัดการ checkbox สำหรับเลือกวัน bulk
  const handleDaySelection = (day, checked) => {
    if (checked) {
      setSelectedDays(prev => [...prev, day]);
    } else {
      setSelectedDays(prev => prev.filter(d => d !== day));
    }
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

  // ===== เพิ่ม: ฟังก์ชันดึงข้อมูล staff profiles ของ user ที่เลือก =====
  const fetchUserStaffInfo = async (userId) => {
    if (!userId) {
      setSelectedUserStaffInfo([]);
      return;
    }

    try {
      const token = localStorage.getItem('jwt');
      
      // *** แก้ไข: แยกการ populate ออกจากกัน ***
      const response = await fetch(
        API.staffProfiles.list(`filters[users_permissions_user][id][$eq]=${userId}&populate[0]=drug_store&populate[1]=users_permissions_user`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const data = await response.json();
      const staffProfiles = Array.isArray(data.data) ? data.data : [];
      
      // แปลงข้อมูลให้แสดงผลได้
      const staffInfo = staffProfiles.map(profile => {
        const drugStore = profile.drug_store;
        let workScheduleText = 'ไม่มีข้อมูลเวลา';
        
        // แปลงตารางเวลาทำงาน
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
        
        return {
          id: profile.id,
          documentId: profile.documentId,
          position: profile.position || 'ไม่ระบุตำแหน่ง',
          pharmacyName: drugStore?.name_th || drugStore?.name_en || 'ไม่ทราบชื่อร้าน',
          pharmacyId: drugStore?.documentId || '',
          workSchedule: workScheduleText
        };
      });
      
      setSelectedUserStaffInfo(staffInfo);
    } catch (error) {
      console.error('Error fetching user staff info:', error);
      setSelectedUserStaffInfo([]);
    }
  };

  // ===== เพิ่ม: ฟังก์ชันจัดการเมื่อเลือก user =====
  const handleUserSelection = (e) => {
    const userId = e.target.value;
    setForm(f => ({ ...f, userId }));
    
    // ดึงข้อมูล staff profiles ของ user ที่เลือก
    fetchUserStaffInfo(userId);
    
    // ถ้าเลือก user แล้ว ให้ดึงข้อมูลส่วนตัวมาใส่ในฟอร์ม
    if (userId) {
      const selectedUser = existingUsers.find(u => u.id === parseInt(userId));
      if (selectedUser) {
        const nameParts = selectedUser.full_name ? selectedUser.full_name.split(' ') : ['', ''];
        setForm(f => ({
          ...f,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: selectedUser.phone || '',
          username: selectedUser.username || ''
        }));
      }
    } else {
      // ถ้าไม่เลือก user ให้เคลียร์ข้อมูล
      setForm(f => ({
        ...f,
        firstName: '',
        lastName: '',
        phone: '',
        username: ''
      }));
      setShowStaffInfoPopup(false); // ปิด popup เมื่อไม่เลือก user
    }
  };

  // ===== เพิ่ม: ฟังก์ชันเปิด/ปิด popup =====
  const handleShowStaffInfo = () => {
    if (selectedUserStaffInfo.length > 0) {
      setShowStaffInfoPopup(true);
    }
  };

  const handleClosePopup = () => {
    setShowStaffInfoPopup(false);
  };

  // ===== เพิ่ม: ฟังก์ชันกลับหน้า =====
  const handleCancel = () => {
    navigate(-1);
  };

  // ===== เพิ่ม: Component Popup =====
  const StaffInfoPopup = () => {
    if (!showStaffInfoPopup) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 font-prompt">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300 border border-slate-100">
          {/* Header */}
          <div className="p-8 border-b border-slate-100 bg-indigo-50/30 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.05] pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">ข้อมูลการทำงานปัจจุบัน</h3>
                <p className="text-slate-400 font-medium">แสดงรายละเอียดภาระงานในร้านยาอื่นๆ</p>
              </div>
            </div>

            <button 
              onClick={handleClosePopup}
              className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90 border border-slate-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Stats Bar */}
          <div className="bg-indigo-600 px-8 py-3 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
             <span className="text-white text-xs font-black uppercase tracking-widest leading-none">
               พนักงานคนนี้ปัจจุบันทำงานอยู่ {selectedUserStaffInfo.length} ร้าน
             </span>
          </div>

          {/* Content */}
          <div className="flex-grow overflow-y-auto p-8 space-y-6 bg-slate-50/30">
            {selectedUserStaffInfo.map((info, index) => (
              <div key={info.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-200 group-hover:bg-indigo-600 transition-colors"></div>
                
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-wider">
                      ร้านที่ {index + 1}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pharmacy Info */}
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ชื่อร้านยา</p>
                          <p className="font-bold text-slate-800">{info.pharmacyName}</p>
                          {info.pharmacyId && <p className="text-[10px] text-slate-400 font-medium">ID: {info.pharmacyId}</p>}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ตำแหน่งงาน</p>
                          <p className="font-bold text-slate-800">{info.position}</p>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Info */}
                    <div className="bg-slate-50 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ตารางเวลาทำงาน</span>
                      </div>
                      <div className="space-y-2">
                        {info.workSchedule === 'ไม่มีข้อมูลเวลา' ? (
                          <div className="px-3 py-2 bg-rose-50 text-rose-500 rounded-lg text-xs font-bold border border-rose-100 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            ไม่มีข้อมูลเวลาทำงาน
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {info.workSchedule.split(', ').map((schedule, scheduleIndex) => {
                              const [day, time] = schedule.split(': ');
                              return (
                                <div key={scheduleIndex} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-100 shadow-sm">
                                  <span className="text-[10px] font-black text-slate-400">{day}</span>
                                  <span className="text-[10px] font-bold text-slate-800">{time}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Warning Section */}
            <div className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100">
               <div className="flex items-start gap-4">
                 <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 9 4 7H8l4-7Z"/><path d="M12 19v.01"/><path d="M12 2v2"/></svg>
                 </div>
                 <div className="space-y-2">
                   <h4 className="font-black text-amber-800 text-sm italic">หมายเหตุสําคัญ & คำแนะนำ</h4>
                   <ul className="text-xs font-medium text-amber-700/80 space-y-1.5 list-disc pl-4">
                     <li><strong>ตรวจสอบเวลา:</strong> กรุณาตรวจสอบตารางเวลาข้างต้นก่อนกำหนดเวลาใหม่</li>
                     <li><strong>หลีกเลี่ยงการชน:</strong> เลือกเวลาที่ไม่ซ้อนทับกับร้านอื่น</li>
                     <li><strong>ตรวจสอบอัตโนมัติ:</strong> ระบบจะแจ้งเตือนหากมีเวลาชนกัน</li>
                   </ul>
                 </div>
               </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
            <button 
              onClick={handleClosePopup}
              className="px-10 py-3 bg-white text-slate-600 font-black rounded-xl border border-slate-200 shadow-sm hover:bg-slate-100 transition-all active:scale-95"
            >
              รับทราบและปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-prompt overflow-x-hidden">
      <HomeHeader />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-5">
            <button
              onClick={handleCancel}
              className="group flex items-center justify-center w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all duration-300 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                {documentId ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานร้านยา"}
              </h1>
              <p className="text-slate-500 font-medium">จัดการรายละเอียดบัญชี ตารางเวลา และรูปโปรไฟล์</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="px-5 py-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
               <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${documentId ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
               <span className="text-sm font-bold text-slate-700">{documentId ? "Editing Mode" : "New Registration"}</span>
             </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Account & Personal Info */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Card 1: Account Selection / Creation */}
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-indigo-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">จัดการผู้ใช้งาน</h3>
                      <p className="text-slate-400 text-sm font-medium">เลือกผู้ใช้ที่มีอยู่แล้วหรือกำหนดบัญชีใหม่</p>
                    </div>
                  </div>

                  {!documentId && (
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setIsNewUser(false)}
                        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${!isNewUser ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        บัญชีเดิม
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNewUser(true)}
                        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${isNewUser ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        สร้างใหม่
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-8 space-y-8">
                   {/* User Selection (Existing) */}
                   {!documentId && !isNewUser && (
                     <div className="space-y-4">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                         ค้นหาพนักงานในระบบ CareLink
                       </label>
                       <div className="relative group">
                         <select
                           name="userId"
                           value={form.userId}
                           onChange={handleUserSelection}
                           required
                           className="w-full pl-12 pr-12 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                         >
                           <option value="">-- กรุณาเลือกบัญชีผู้ใช้ --</option>
                           {existingUsers.map(u => (
                             <option key={u.id} value={u.id}>
                               {u.full_name || u.username} ({u.username})
                             </option>
                           ))}
                         </select>
                         <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                         </div>
                         <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                         </div>
                       </div>

                       {selectedUserStaffInfo.length > 0 && (
                         <button
                           type="button"
                           onClick={handleShowStaffInfo}
                           className="flex items-center gap-3 px-6 py-4 bg-emerald-50 text-emerald-700 rounded-2xl border-2 border-emerald-100/50 hover:bg-emerald-100 transition-all group w-full"
                         >
                           <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                           </div>
                           <div className="text-left">
                             <p className="text-xs font-black uppercase tracking-wider leading-none mb-1">สถานะภาระงาน</p>
                             <p className="font-bold text-sm">ปัจจุบันทำงานอยู่ {selectedUserStaffInfo.length} ร้าน (คลิกเพื่อดูรายละเอียด)</p>
                           </div>
                         </button>
                       )}
                     </div>
                   )}

                   {/* Personal Details Form */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อจริง <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          name="firstName" 
                          value={form.firstName} 
                          onChange={handleChange} 
                          required 
                          disabled={!isNewUser && !documentId && form.userId}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 disabled:opacity-60 disabled:bg-slate-100"
                          placeholder="ภาษาไทย หรือ อังกฤษ"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">นามสกุล <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          name="lastName" 
                          value={form.lastName} 
                          onChange={handleChange} 
                          required 
                          disabled={!isNewUser && !documentId && form.userId}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 disabled:opacity-60 disabled:bg-slate-100"
                          placeholder="นามสกุล"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">เบอร์โทรศัพท์ติดต่อ</label>
                        <input 
                          type="text" 
                          name="phone" 
                          value={form.phone} 
                          onChange={handleChange} 
                          disabled={!isNewUser && !documentId && form.userId}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 disabled:opacity-60 disabled:bg-slate-100"
                          placeholder="08X-XXX-XXXX"
                        />
                      </div>
                      
                      {/* Account Info (New or Edit) */}
                      {(isNewUser || documentId) && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">USERNAME <span className="text-rose-500">*</span></label>
                            <input
                              type="text"
                              name="username"
                              value={form.username}
                              onChange={handleChange}
                              required
                              disabled={!!documentId}
                              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 disabled:opacity-60 disabled:bg-slate-100"
                              placeholder="ระบุ username สำหรับเข้าระบบ"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">PASSWORD {isNewUser && !documentId && <span className="text-rose-500">*</span>}</label>
                            <input
                              type="password"
                              name="password"
                              value={form.password}
                              onChange={handleChange}
                              required={isNewUser && !documentId}
                              disabled={!isNewUser && !documentId}
                              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 disabled:opacity-60 disabled:bg-slate-100"
                              placeholder="••••••••"
                            />
                          </div>
                        </>
                      )}
                      
                      {/* Display Info when searching existing */}
                      {!documentId && !isNewUser && form.userId && (
                        <div className="md:col-span-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4 text-emerald-800 animate-in slide-in-from-left duration-300">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-wider opacity-60">Verified Account</p>
                            <p className="font-bold text-sm">ระบบตรวจสอบข้อมูลผู้ใช้ "{form.username}" เรียบร้อยแล้ว</p>
                          </div>
                        </div>
                      )}
                   </div>
                </div>
              </div>

              {/* Card 2: Work Schedule */}
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-emerald-50/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">ตารางเวลาทำงาน</h3>
                      <p className="text-slate-400 text-sm font-medium">กำหนดวันและเวลาทำงานที่แน่นอนในแต่ละสัปดาห์</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {/* Bulk Add Section */}
                  <div className="bg-slate-50 rounded-[2rem] p-8 border-2 border-dashed border-slate-200 group hover:border-emerald-300 transition-all">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-1.9"/><path d="m3.5 14.5 2.8-2.8"/><path d="m4.8 5.8 2.1-2.1"/><path d="m2 2 20 20"/><path d="M21 15.5c0-4.1-3.4-7.5-7.5-7.5s-7.5 3.4-7.5 7.5 3.4 7.5 7.5 7.5c1.1 0 2.1-.2 3.1-.7"/></svg>
                       </div>
                       <h4 className="font-black text-slate-800 tracking-tight">เพิ่มช่วงเวลาด่วน (Bulk Add)</h4>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-2">
                        {["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"].map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleDaySelection(day, !selectedDays.includes(day))}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border-2 ${
                              selectedDays.includes(day) 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-grow grid grid-cols-2 gap-4 w-full">
                           <div className="relative">
                             <input
                              type="time"
                              value={bulkTimeIn}
                              onChange={(e) => setBulkTimeIn(e.target.value)}
                              className="w-full px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700"
                            />
                            <span className="absolute -top-2.5 left-4 px-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">เริ่ม</span>
                           </div>
                           <div className="relative">
                             <input
                              type="time"
                              value={bulkTimeOut}
                              onChange={(e) => setBulkTimeOut(e.target.value)}
                              className="w-full px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700"
                            />
                            <span className="absolute -top-2.5 left-4 px-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">เลิกงาน</span>
                           </div>
                        </div>
                        <button
                          type="button"
                          onClick={addBulkWorkDay}
                          className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                          เพิ่มช่วงเวลา
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {form.workSchedule.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-[2rem] border-2 border-dotted border-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-20"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <p className="font-bold tracking-tight">ยังไม่ได้กำหนดตารางเวลาทำงาน</p>
                        <p className="text-xs font-medium">กรุณากดเพิ่มเวลา หรือใช้วิธี Bulk Add ด้านบน</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                        {form.workSchedule.map((schedule, index) => (
                          <div key={index} className="flex flex-col sm:flex-row items-center gap-4 p-5 bg-white rounded-3xl border-2 border-slate-50 hover:border-indigo-100 shadow-sm transition-all group">
                            <div className="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                              <div className="relative">
                                <select
                                  value={schedule.day || ""}
                                  onChange={(e) => handleWorkScheduleChange(index, 'day', e.target.value)}
                                  className="w-full pl-5 pr-10 py-3.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-black text-slate-700 appearance-none cursor-pointer transition-all"
                                  required
                                >
                                  <option value="">เลือกวัน</option>
                                  {["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]
                                    .filter(day => 
                                      !form.workSchedule.some((s, i) => s.day === day && i !== index) || schedule.day === day
                                    )
                                    .map((day) => (
                                      <option key={day} value={day}>{day}</option>
                                    ))
                                  }
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                              </div>
                              <input
                                type="time"
                                value={schedule.start_time || ""}
                                onChange={(e) => handleWorkScheduleChange(index, 'start_time', e.target.value)}
                                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold text-slate-700 transition-all"
                                required={!!schedule.day}
                              />
                              <div className="relative">
                                <input
                                  type="time"
                                  value={schedule.end_time || ""}
                                  onChange={(e) => handleWorkScheduleChange(index, 'end_time', e.target.value)}
                                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold text-slate-700 transition-all"
                                  required={!!schedule.day}
                                />
                                <span className="absolute -left-2 top-1/2 -translate-y-1/2 text-slate-300 hidden sm:block font-bold">ถึง</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeWorkDay(index)}
                              className="p-3.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={addWorkDay}
                      disabled={form.workSchedule.length >= 7}
                      className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[1.5rem] text-slate-400 font-extrabold hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                      เพิ่มวันทำงาน แยก
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Profile Image & Position */}
            <div className="lg:col-span-4 space-y-8">
               {/* Card 3: Profile Image */}
               <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                   <h3 className="text-xl font-black text-slate-800">รูปภาพโปรไฟล์</h3>
                   <p className="text-slate-400 text-sm font-medium">รูปพนักงานสำหรับแสดงผลในระบบ</p>
                </div>
                <div className="p-10 flex flex-col items-center">
                  <div 
                    onClick={handleUploadClick}
                    className="relative group cursor-pointer"
                  >
                    <div className="w-56 h-56 rounded-[3rem] overflow-hidden ring-8 ring-slate-50 shadow-inner bg-slate-100 flex items-center justify-center transition-all group-hover:scale-105">
                       {imagePreviewUrl ? (
                         <img src={imagePreviewUrl} alt="profile" className="w-full h-full object-cover" />
                       ) : uploadedImageUrl ? (
                         <img src={uploadedImageUrl} alt="profile" className="w-full h-full object-cover" />
                       ) : (
                         <div className="flex flex-col items-center text-slate-300">
                           <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                         </div>
                       )}
                    </div>
                    
                    <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl flex items-center justify-center text-white ring-4 ring-white group-hover:rotate-12 transition-all">
                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </div>
                    <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleImageChange} />
                  </div>
                  
                  <div className="mt-10 w-full space-y-4">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">ตำแหน่งงาน <span className="text-rose-500">*</span></label>
                       <input
                         type="text"
                         name="position"
                         value={form.position}
                         onChange={handleChange}
                         required
                         className="w-full px-5 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-black text-slate-700 placeholder:text-slate-300"
                         placeholder="ระบุตำแหน่งงาน (เช่น เภสัชกร, พนักงานทั่วไป)"
                       />
                    </div>
                  </div>
                </div>
               </div>

               {/* Action Buttons */}
               <div className="space-y-4 pt-10">
                  <button 
                    type="submit" 
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {documentId ? "ยืนยันการแก้ไขข้อมูล" : "เสร็จสิ้นการเพิ่มพนักงาน"}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleCancel}
                    className="w-full py-5 bg-white text-slate-500 font-extrabold rounded-3xl border-2 border-slate-100 hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95"
                  >
                    ยกเลิกและย้อนกลับ
                  </button>
               </div>

               <div className="text-center">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">CareLink Pharmacy Network</span>
               </div>
            </div>
          </div>
        </form>
      </div>
      
      {/* Popup Component */}
      <StaffInfoPopup />
    </div>
  );
}

export default FormStaffPage;
