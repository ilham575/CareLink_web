import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/HomeHeader";
// Footer is rendered globally in App.js
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API } from "../../../utils/apiConfig";

// 🟢 mapping วัน ไทย -> ไทย (เก็บเป็นวันไทยใน DB)
const dayMapReverse = {
  จันทร์: "จันทร์",
  อังคาร: "อังคาร",
  พุธ: "พุธ",
  พฤหัสบดี: "พฤหัสบดี",
  ศุกร์: "ศุกร์",
  เสาร์: "เสาร์",
  อาทิตย์: "อาทิตย์",
};

function AddPharmacist_admin() {
  const navigate = useNavigate();
  const { storeId } = useParams();
  const jwt = localStorage.getItem("jwt");

  // เพิ่ม state ใหม่
  const [mode, setMode] = useState("create"); // "create" หรือ "select"
  const [existingPharmacists, setExistingPharmacists] = useState([]);
  const [selectedPharmacist, setSelectedPharmacist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState(""); // เพิ่ม state สำหรับชื่อร้าน

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    license_number: "",
    phone: "",
    username: "",
    password: "",
    profileImage: null,
    services: {
      sell_products: false,
      consulting: false,
      wholesale: false,
      delivery: false,
    },
    working_time: [{ day: "จันทร์", time_in: "", time_out: "" }], // 🟢 เปลี่ยนจาก working_times เป็น working_time
  });

  const [imagePreview, setImagePreview] = useState(null);

  // เพิ่ม state สำหรับเวลาทำงานของร้านนี้
  const [storeWorkingTime, setStoreWorkingTime] = useState([
    { day: "จันทร์", time_in: "", time_out: "" },
  ]);

  // เพิ่ม state สำหรับ store opening/closing time
  const [storeOpenClose, setStoreOpenClose] = useState([
    // { day: "จันทร์", open: "08:00", close: "20:00" }
  ]);

  // เพิ่ม state สำหรับเลือกหลายวัน (multi-day selection)
  const [selectedDays, setSelectedDays] = useState([]);
  const [bulkTimeIn, setBulkTimeIn] = useState("");
  const [bulkTimeOut, setBulkTimeOut] = useState("");

  // สำหรับ modal แสดงเวลาทำงานทั้งหมดของเภสัชกร
  const [showWorkTimesModal, setShowWorkTimesModal] = useState(false);

  // ✅ ดึงข้อมูลเภสัชกรทั้งหมดพร้อมข้อมูลร้านที่ทำงาน
  useEffect(() => {
    const fetchExistingPharmacists = async () => {
      if (!jwt) {
        return;
      }

      try {
        setLoading(true);
        // ใช้ listAll เพื่อให้ได้ข้อมูล drug_stores ว่าเภสัชกรคนไหนทำงานในร้านไหน
        const response = await fetch(
          API.pharmacyProfiles.listAll(),
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log('✅ ดึงเภสัชกรทั้งหมด:', data.data?.length, 'คน');
          setExistingPharmacists(data.data);
        } else {
          console.warn('⚠️ ไม่สามารถดึงเภสัชกรได้');
        }
      } catch (error) {
        console.error('❌ เกิดข้อผิดพลาด:', error);
        toast.error("ไม่สามารถโหลดข้อมูลเภสัชกรได้");
      } finally {
        setLoading(false);
      }
    };

    fetchExistingPharmacists();
  }, [jwt]);

  // ดึงเวลาทำการของร้าน
  useEffect(() => {
    if (!storeId || !jwt) return;
    fetch(
      API.drugStores.getByDocumentId(storeId),
      {
        headers: { Authorization: `Bearer ${jwt}` },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.data && data.data.length > 0) {
          const store = data.data[0];
          // สมมติว่า store.time_open, store.time_close เป็นเวลาเปิด/ปิดร้าน (string "HH:mm")
          // ถ้าเก็บเป็น array รายวัน ให้ map ให้ครบ 7 วัน
          let openCloseArr = [];
          if (Array.isArray(store.time_open) && Array.isArray(store.time_close)) {
            // กรณีเก็บเป็น array รายวัน
            openCloseArr = store.time_open.map((open, idx) => ({
              day: [
                "จันทร์",
                "อังคาร",
                "พุธ",
                "พฤหัสบดี",
                "ศุกร์",
                "เสาร์",
                "อาทิตย์",
              ][idx],
              open,
              close: store.time_close[idx],
            }));
          } else {
            // กรณีเก็บเป็น string เดียว ใช้กับทุกวัน
            openCloseArr = [
              "จันทร์",
              "อังคาร",
              "พุธ",
              "พฤหัสบดี",
              "ศุกร์",
              "เสาร์",
              "อาทิตย์",
            ].map((day) => ({
              day,
              open: store.time_open || "08:00",
              close: store.time_close || "20:00",
            }));
          }
          setStoreOpenClose(openCloseArr);
        }
      });
  }, [storeId, jwt]);

  // เพิ่ม useEffect สำหรับดึงชื่อร้าน
  useEffect(() => {
    const fetchStoreName = async () => {
      if (!storeId || !jwt) return;

      try {
        const response = await fetch(
          API.drugStores.getByDocumentId(storeId),
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const store = data.data?.[0];
          if (store) {
            setStoreName(store.name_th || store.attributes?.name_th || "");
          }
        }
      } catch (error) {
        console.error("ไม่สามารถดึงชื่อร้านได้:", error);
      }
    };

    fetchStoreName();
  }, [storeId, jwt]);

  // ✅ Handle Change
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === "checkbox") {
      setFormData({
        ...formData,
        services: { ...formData.services, [name]: checked },
      });
    } else if (type === "file") {
      const file = files[0];
      if (file) {
        setFormData({ ...formData, profileImage: file });

        // preview image
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target.result);
        reader.readAsDataURL(file);
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // 📦 รวบรวมรายการร้านจาก pharmacist object หลายรูปแบบ และ dedupe
  const getAllStoresFromPharmacist = (ph) => {
    if (!ph) return [];
    const collected = [];

    const entriesFrom = (src) => {
      if (!src) return [];
      if (Array.isArray(src)) return src;
      if (Array.isArray(src.data)) return src.data;
      return [];
    };

    const pushStore = (s) => {
      if (!s) return;
      if (typeof s === 'string') {
        collected.push({ id: s, documentId: s, name: s });
        return;
      }
      const attrs = s.attributes || s;
      const id = s.id || attrs.id || attrs.documentId || attrs.document_id || attrs.documentId;
      const documentId = attrs.documentId || attrs.document_id || s.documentId || s.document_id || id;
      const name = attrs.name_th || attrs.name || attrs.title || s.name;
      collected.push({ id, documentId, name });
    };

    // top-level drug_stores
    entriesFrom(ph.drug_stores).forEach(pushStore);
    entriesFrom(ph.attributes?.drug_stores?.data).forEach(pushStore);
    entriesFrom(ph.attributes?.drug_stores).forEach(pushStore);

    // nested pharmacy_profiles -> each profile may have drug_stores
    const profiles = ph.attributes?.pharmacy_profiles?.data || ph.pharmacy_profiles?.data || ph.pharmacy_profiles || ph.attributes?.pharmacy_profiles;
    if (profiles) {
      const profileArray = Array.isArray(profiles) ? profiles : profiles.data || [];
      profileArray.forEach((p) => {
        entriesFrom(p.drug_stores || p.attributes?.drug_stores?.data || p.attributes?.drug_stores).forEach(pushStore);
      });
    }

    // dedupe by documentId or id
    const seen = new Set();
    const uniq = [];
    collected.forEach((s) => {
      const key = s.documentId || s.id || s.name;
      if (!key) return;
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(s);
      }
    });

    return uniq;
  };

  // ✅ Working Times
  const addWorkingTime = () => {
    setFormData({
      ...formData,
      working_time: [
        ...formData.working_time,
        { day: "จันทร์", time_in: "", time_out: "" },
      ],
    });
  };

  const handleWorkingTimeChange = (index, field, value) => {
    const updated = [...formData.working_time];
    updated[index][field] = value;
    setFormData({ ...formData, working_time: updated });
  };

  const removeWorkingTime = (index) => {
    const updated = [...formData.working_time];
    updated.splice(index, 1);
    setFormData({ ...formData, working_time: updated });
  };

  // ✅ เพิ่มฟังก์ชันจัดการเวลาทำงานสำหรับร้าน
  const addStoreWorkingTime = () => {
    setStoreWorkingTime([
      ...storeWorkingTime,
      { day: "จันทร์", time_in: "", time_out: "" },
    ]);
  };

  const handleStoreWorkingTimeChange = (index, field, value) => {
    const updated = [...storeWorkingTime];
    updated[index][field] = value;
    setStoreWorkingTime(updated);
  };

  const removeStoreWorkingTime = (index) => {
    const updated = [...storeWorkingTime];
    updated.splice(index, 1);
    setStoreWorkingTime(updated);
  };

  // 👉 เพิ่มฟังก์ชันสำหรับเพิ่มเวลา bulk (หลายวันพร้อมกัน) สำหรับ mode "create"
  const addBulkWorkingTime = () => {
    if (selectedDays.length === 0 || !bulkTimeIn || !bulkTimeOut) {
      toast.error("กรุณาเลือกวันและเวลาที่ต้องการเพิ่ม");
      return;
    }

    const newWorkingTimes = [...formData.working_time];
    selectedDays.forEach(day => {
      newWorkingTimes.push({
        day: day,
        time_in: bulkTimeIn,
        time_out: bulkTimeOut,
      });
    });

    setFormData({
      ...formData,
      working_time: newWorkingTimes,
    });

    // Reset bulk inputs
    setSelectedDays([]);
    setBulkTimeIn("");
    setBulkTimeOut("");
  };

  // 👉 เพิ่มฟังก์ชันสำหรับเพิ่มเวลา bulk ใน mode "select" (storeWorkingTime)
  const addBulkStoreWorkingTime = () => {
    if (selectedDays.length === 0 || !bulkTimeIn || !bulkTimeOut) {
      toast.error("กรุณาเลือกวันและเวลาที่ต้องการเพิ่ม");
      return;
    }

    const newWorkingTimes = [...storeWorkingTime];
    selectedDays.forEach((day) => {
      newWorkingTimes.push({ day: day, time_in: bulkTimeIn, time_out: bulkTimeOut });
    });

    setStoreWorkingTime(newWorkingTimes);

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

  // ✅ Handle pharmacist selection - แก้ไขการเข้าถึงข้อมูล
  const handlePharmacistSelect = (e) => {
    const userId = e.target.value;
    if (!userId) {
      setSelectedPharmacist(null);
      return;
    }

    // หา pharmacy profiles ทั้งหมดของ user นี้ และรวมเป็น selectedPharmacist เดียว
    const profiles = existingPharmacists.filter((p) => {
      const pUserId =
        p.users_permissions_user?.id ||
        p.users_permissions_user?.data?.id ||
        p.attributes?.users_permissions_user?.data?.id ||
        p.attributes?.users_permissions_user?.id;
      return String(pUserId) === String(userId);
    });

    if (profiles.length === 0) {
      setSelectedPharmacist(null);
      return;
    }

    const representative = profiles[0];
    const userObj =
      representative.users_permissions_user ||
      representative.attributes?.users_permissions_user?.data ||
      representative.attributes?.users_permissions_user ||
      null;

    const combined = {
      users_permissions_user: userObj,
      pharmacy_profiles: { data: profiles },
      // keep some top-level fields from the representative for display
      license_number: representative.license_number || representative.attributes?.license_number,
      profileimage: representative.profileimage || representative.attributes?.profileimage,
      // aggregate any top-level working_time entries too
      working_time: profiles.flatMap((p) => p.working_time || p.attributes?.working_time || p.attributes?.working_time?.data || []),
    };

    setSelectedPharmacist(combined);
  };

  // 💡 รวบรวมเวลาทำงานทั้งหมดจาก selectedPharmacist (รวมจากทุก profile และ nested attributes) และจัดเรียง/ลบซ้ำ
  const getAggregatedWorkingTimesFromSelected = () => {
    if (!selectedPharmacist) return [];
    const collected = [];

    // normalize source into array of entries
    const entriesFrom = (src) => {
      if (!src) return [];
      if (Array.isArray(src)) return src;
      if (Array.isArray(src.data)) return src.data;
      return [];
    };

    const pushIfValid = (day, time_in, time_out, store_id) => {
      if (!day || !time_in || !time_out) return;
      const d = typeof day === "string" ? day.trim() : day;
      collected.push({ day: d, time_in, time_out, store_id: store_id || null });
    };

    const addFrom = (src) => {
      const arr = entriesFrom(src);
      arr.forEach((entry) => {
        const wt = entry?.attributes ? entry.attributes : entry;
        // support common variants
        const day = wt?.day || wt?.weekday || wt?.name;
        const time_in = wt?.time_in || wt?.timeIn || wt?.open || wt?.start_time;
        const time_out = wt?.time_out || wt?.timeOut || wt?.close || wt?.end_time;
        const store_id = wt?.store_id || wt?.storeId || wt?.store || wt?.drug_store_id;
        pushIfValid(day, time_in, time_out, store_id);
      });
    };

    // gather from multiple possible fields/shapes
    addFrom(selectedPharmacist.working_time);
    addFrom(selectedPharmacist.attributes?.working_time);
    // also support case where working_time is wrapped as { data: [...] }
    addFrom(selectedPharmacist.attributes?.working_time?.data);

    // nested pharmacy profiles (various shapes)
    const profiles =
      selectedPharmacist.attributes?.pharmacy_profiles?.data ||
      selectedPharmacist.pharmacy_profiles?.data ||
      selectedPharmacist.pharmacy_profiles ||
      selectedPharmacist.attributes?.pharmacy_profiles;

    if (profiles) {
      const profileArray = Array.isArray(profiles) ? profiles : profiles.data || [];
      profileArray.forEach((p) => {
        addFrom(p.working_time || p.attributes?.working_time || p.attributes?.working_time?.data);
      });
    }

    if (collected.length === 0) return [];

    // dedupe by day/time
    const keySet = new Set();
    const unique = [];
    collected.forEach((t) => {
      const key = `${t.day}|${t.time_in}|${t.time_out}`;
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
      if (a.time_in !== b.time_in) return a.time_in.localeCompare(b.time_in);
      return a.time_out.localeCompare(b.time_out);
    });

    return unique;
  };

  // 🟢 ฟังก์ชันตรวจสอบเวลาทำงานซ้ำ (ชนกัน)
  function hasOverlappingWorkingTimes(times) {
    // times: [{ day, time_in, time_out }]
    function toMinutes(t) {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    const byDay = {};
    for (const t of times) {
      if (!t.time_in || !t.time_out) continue;
      if (!byDay[t.day]) byDay[t.day] = [];
      byDay[t.day].push([t.time_in, t.time_out]);
    }
    for (const day in byDay) {
      const slots = byDay[day]
        .map(([start, end]) => [toMinutes(start), toMinutes(end), start, end])
        .sort((a, b) => a[0] - b[0]);
      // DEBUG: log slots for each day
      console.log(
        `[DEBUG] Checking overlaps for day: ${day} (${slots.length} slot${slots.length > 1 ? "s" : ""})`,
        slots.map((s) => ({ from: s[2], to: s[3] }))
      );
      for (let i = 1; i < slots.length; ++i) {
        if (slots[i][0] < slots[i - 1][1]) {
          // เวลาซ้อนกัน
          console.warn(
            `[DEBUG] Overlap detected on ${day}:`,
            { from: slots[i - 1][2], to: slots[i - 1][3] },
            { from: slots[i][2], to: slots[i][3] }
          );
          return true;
        }
      }
    }
    return false;
  }

  // 🟢 ตรวจสอบเวลาทำงานซ้ำกับร้านอื่น (ข้ามร้าน) สำหรับ mode === "select"
  function hasOverlapWithOtherStoresForSelectedPharmacist(storeWorkingTime) {
    if (!selectedPharmacist) return false;
    // รวม working_time ของ profile อื่นๆ (ข้ามร้าน)
    // ต้องกรอง pharmacy_profiles ที่ user เดียวกันแต่ไม่ใช่ร้านปัจจุบัน และไม่ซ้ำกัน
    let otherTimes = [];
    // fallback: หา pharmacy-profiles ทั้งหมดของ user นี้จาก existingPharmacists
    const userId =
      selectedPharmacist.users_permissions_user?.id ||
      selectedPharmacist.users_permissions_user?.data?.id;
    const usedProfileIds = new Set();
    existingPharmacists.forEach((p) => {
      const pUserId =
        p.users_permissions_user?.id || p.users_permissions_user?.data?.id;
      if (pUserId === userId) {
        // ตัดร้านปัจจุบันออก
        const stores = p.drug_stores || [];
        if (!stores.some((s) => (s.documentId || s.id) === storeId)) {
          // ป้องกันซ้ำ profile
          if (!usedProfileIds.has(p.id)) {
            usedProfileIds.add(p.id);
            if (Array.isArray(p.working_time)) {
              otherTimes = otherTimes.concat(
                p.working_time.map((wt) => ({
                  day: wt.day,
                  time_in: wt.time_in,
                  time_out: wt.time_out,
                  store: stores[0]?.name_th || stores[0]?.name || "ร้านอื่น",
                }))
              );
            }
          }
        }
      }
    });
    function toMinutes(t) {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    for (const cur of storeWorkingTime) {
      if (!cur.time_in || !cur.time_out) continue;
      const curStart = toMinutes(cur.time_in);
      const curEnd = toMinutes(cur.time_out);
      for (const other of otherTimes) {
        if (cur.day !== other.day) continue;
        if (!other.time_in || !other.time_out) continue;
        const otherStart = toMinutes(other.time_in);
        const otherEnd = toMinutes(other.time_out);
        if (curStart < otherEnd && otherStart < curEnd) {
          return true;
        }
      }
    }
    return false;
  }

  // ฟังก์ชันตรวจสอบเวลาทำงานเภสัชกรเทียบกับเวลาร้าน
  function isWorkingTimeWithinStoreTime(workingTimes) {
    // workingTimes: [{ day, time_in, time_out }]
    // storeOpenClose: [{ day, open, close }]
    function toMinutes(t) {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    for (const wt of workingTimes) {
      if (!wt.day || !wt.time_in || !wt.time_out) continue;
      const storeDay = storeOpenClose.find((s) => s.day === wt.day);
      if (!storeDay) continue;
      const open = toMinutes(storeDay.open);
      const close = toMinutes(storeDay.close);
      const minIn = open - 60; // เร็วสุดก่อนร้านเปิด 1 ชม.
      const maxOut = close + 60; // ช้าสุดหลังร้านปิด 1 ชม.
      const inTime = toMinutes(wt.time_in);
      const outTime = toMinutes(wt.time_out);
      if (inTime < minIn || outTime > maxOut) {
        return {
          valid: false,
          day: wt.day,
          storeOpen: storeDay.open,
          storeClose: storeDay.close,
          inTime: wt.time_in,
          outTime: wt.time_out,
        };
      }
    }
    return { valid: true };
  }

  // ✅ Modified Submit - แก้ไขการเข้าถึงข้อมูล
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!jwt) {
      toast.error("กรุณาเข้าสู่ระบบใหม่");
      navigate("/login");
      return;
    }

    try {
      if (mode === "select") {
        if (!selectedPharmacist) {
          toast.error("กรุณาเลือกเภสัชกร");
          return;
        }

        // 🟢 ตรวจสอบเวลาทำงานซ้ำในร้านเดียวกัน
        if (hasOverlappingWorkingTimes(storeWorkingTime)) {
          toast.error("เวลาทำงานซ้ำกัน กรุณาตรวจสอบวันและเวลา");
          return;
        }
        // 🟢 ตรวจสอบเวลาทำงานซ้ำกับร้านอื่น (ข้ามร้าน)
        if (hasOverlapWithOtherStoresForSelectedPharmacist(storeWorkingTime)) {
          toast.error("เวลาทำงานซ้ำกับร้านอื่น กรุณาตรวจสอบวันและเวลา");
          return;
        }

        // 🟢 ตรวจสอบเวลาทำงานเภสัชกรต้องอยู่ในช่วงเวลาร้าน (อนุโลม +/- 1 ชม.)
        const storeTimeCheck = isWorkingTimeWithinStoreTime(storeWorkingTime);
        if (!storeTimeCheck.valid) {
          toast.error(
            `วัน${storeTimeCheck.day}: เวลาทำงานต้องอยู่ในช่วง ${storeTimeCheck.storeOpen} - ${storeTimeCheck.storeClose} (อนุโลมเข้าเร็วสุด 1 ชม.ก่อนเปิด, ออกช้าสุด 1 ชม.หลังปิด)`
          );
          return;
        }

        const hasWorkingTime = storeWorkingTime.some(
          (wt) => wt.time_in && wt.time_out
        );
        if (!hasWorkingTime) {
          toast.error("กรุณากรอกเวลาทำงานอย่างน้อย 1 วัน");
          return;
        }

        // ตรวจสอบว่ามี profile สำหรับ user+store นี้อยู่แล้วหรือยัง
        const userId =
          selectedPharmacist.users_permissions_user?.id ||
          selectedPharmacist.users_permissions_user?.data?.id;
        const checkRes = await fetch(
          API.pharmacyProfiles.list(`filters[users_permissions_user][id][\$eq]=\${userId}&filters[drug_stores][documentId][\$eq]=\${storeId}`),
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        const checkData = await checkRes.json();
        if (checkData.data && checkData.data.length > 0) {
          toast.error("เภสัชกรนี้มีโปรไฟล์ในร้านนี้อยู่แล้ว");
          return;
        }

        // ดึงข้อมูล pharmacy profile ที่มีอยู่ของ user นี้
        const existingProfileRes = await fetch(
          API.pharmacyProfiles.list(`filters[users_permissions_user][id][\$eq]=\${userId}&populate=drug_stores`),
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        const existingProfileData = await existingProfileRes.json();
        const existingProfile = existingProfileData.data?.[0];

        if (existingProfile) {
          // อัปเดต profile ที่มีอยู่โดยเพิ่มร้านใหม่เข้าไป
          const currentStores = existingProfile.drug_stores || [];
          const currentStoreIds = currentStores.map(store => store.documentId || store.id);
          
          // เพิ่มร้านใหม่ถ้ายังไม่มี
          if (!currentStoreIds.includes(storeId)) {
            // แยกเวลาทำงานตามร้าน - เก็บเฉพาะเวลาทำงานที่ไม่ใช่ของร้านปัจจุบัน
            const existingWorkingTime = existingProfile.working_time || [];
            const newWorkingTime = storeWorkingTime
              .filter((wt) => wt.time_in && wt.time_out)
              .map((wt) => ({
                day: dayMapReverse[wt.day] || wt.day,
                time_in: wt.time_in,
                time_out: wt.time_out,
                store_id: storeId, // เพิ่ม store_id เพื่อระบุว่าเวลาทำงานนี้เป็นของร้านไหน
              }));

            // รวมเวลาทำงานเดิม (จากร้านอื่น) กับเวลาทำงานใหม่ (ร้านปัจจุบัน)
            const combinedWorkingTime = [...existingWorkingTime, ...newWorkingTime];

            const updatePayload = {
              data: {
                drug_stores: { connect: [storeId] },
                working_time: combinedWorkingTime,
              },
            };

            const updateRes = await fetch(
              API.pharmacyProfiles.update(existingProfile.documentId),
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify(updatePayload),
              }
            );

            if (!updateRes.ok) {
              const errorData = await updateRes.json();
              console.error("Update pharmacy profile error:", errorData);
              throw new Error(errorData.error?.message || "อัปเดตข้อมูลเภสัชกรไม่สำเร็จ");
            }
          }
        } else {
          // สร้าง profile ใหม่ถ้าไม่มี
          const workingTimeForStore = storeWorkingTime
            .filter((wt) => wt.time_in && wt.time_out)
            .map((wt) => ({
              day: dayMapReverse[wt.day] || wt.day,
              time_in: wt.time_in,
              time_out: wt.time_out,
              store_id: storeId, // เพิ่ม store_id
            }));

          const payload = {
            data: {
              license_number: selectedPharmacist.license_number || "",
              services: selectedPharmacist.services || {},
              drug_stores: { connect: [storeId] },
              users_permissions_user: userId,
              profileimage:
                selectedPharmacist.profileimage?.[0]?.id ||
                selectedPharmacist.profileimage?.id ||
                null,
              working_time: workingTimeForStore,
            },
          };

          const res = await fetch(API.pharmacyProfiles.create(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error?.message || "เพิ่มเภสัชกรให้ร้านไม่สำเร็จ");
          }
        }

        toast.success(`✅ เพิ่มเภสัชกรให้ร้านเรียบร้อย!`);
      } else {
        // 🟢 ตรวจสอบเวลาทำงานซ้ำ
        if (hasOverlappingWorkingTimes(formData.working_time)) {
          toast.error("เวลาทำงานซ้ำกัน กรุณาตรวจสอบวันและเวลา");
          return;
        }

        // 🟢 ตรวจสอบเวลาทำงานเภสัชกรต้องอยู่ในช่วงเวลาร้าน (อนุโลม +/- 1 ชม.)
        const storeTimeCheck = isWorkingTimeWithinStoreTime(formData.working_time);
        if (!storeTimeCheck.valid) {
          toast.error(
            `วัน${storeTimeCheck.day}: เวลาทำงานต้องอยู่ในช่วง ${storeTimeCheck.storeOpen} - ${storeTimeCheck.storeClose} (อนุโลมเข้าเร็วสุด 1 ชม.ก่อนเปิด, ออกช้าสุด 1 ชม.หลังปิด)`
          );
          return;
        }

        // 1. สมัคร User
        const userRes = await fetch(
          API.auth.register,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: formData.username,
              email: `${formData.username}@mail.com`,
              password: formData.password,
            }),
          }
        );

        if (!userRes.ok) {
          const error = await userRes.json();
          throw new Error(error.error?.message || "สร้าง User ไม่สำเร็จ");
        }

        const userData = await userRes.json();

        // 2. หา role pharmacist
        const roleRes = await fetch(
          API.roles.list(),
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );
        const roleData = await roleRes.json();
        const pharmacistRole = roleData.roles.find((r) => r.name === "pharmacy");
        if (!pharmacistRole) throw new Error("ไม่พบ role pharmacist");

        // 3. อัปเดต User
        await fetch(API.users.update(userData.user.id), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            full_name: `${formData.firstname} ${formData.lastname}`,
            phone: formData.phone,
            role: pharmacistRole.id,
          }),
        });

        // 4. อัปโหลดรูปถ้ามี
        let uploadedImageId = null;
        if (formData.profileImage) {
          const imageForm = new FormData();
          imageForm.append("files", formData.profileImage);

          const uploadRes = await fetch(API.upload(), {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
            body: imageForm,
          });

          if (!uploadRes.ok) throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");

          const uploadData = await uploadRes.json();
          uploadedImageId = uploadData[0].id;
        }

        // 5. สร้าง Pharmacy Profile สำหรับเภสัชกรใหม่
        const workingTimeForStore = formData.working_time.map((wt) => ({
          ...wt,
          day: dayMapReverse[wt.day] || wt.day,
          store_id: storeId, // เพิ่ม store_id
        }));

        const payload = {
          data: {
            license_number: formData.license_number,
            services: formData.services,
            drug_stores: { connect: [storeId] },
            users_permissions_user: userData.user.id,
            profileimage: uploadedImageId || null,
            working_time: workingTimeForStore,
          },
        };

        const res = await fetch(API.pharmacyProfiles.create(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = await res.json();
          console.error("Create pharmacy profile error:", error);
          throw new Error(error.error?.message || "เพิ่มเภสัชกรไม่สำเร็จ");
        }

        const createdProfile = await res.json();
        console.log("Created profile:", createdProfile);

        toast.success(`✅ เพิ่มเภสัชกรใหม่เรียบร้อย!`);
      }

      // Force refresh หน้าที่เกี่ยวข้อง
      setTimeout(() => {
        navigate(`/pharmacist_detail_admin/${storeId}`, {
          state: { forceRefresh: true, timestamp: Date.now() },
        });
      }, 1000);
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header pharmacyName={storeName} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              เพิ่มเภสัชกรประจำร้านขายยา
            </h2>
          </div>

          {/* Mode Toggle */}
          <div className="mb-8 flex justify-center">
            <div className="bg-slate-100 rounded-xl p-1.5 flex flex-col sm:flex-row gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setMode("select");
                  setSelectedPharmacist(null);
                }}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex-1 sm:flex-none flex items-center justify-center gap-2 ${
                  mode === "select"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                เลือกจากเภสัชกรที่มีอยู่
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                }}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex-1 sm:flex-none flex items-center justify-center gap-2 ${
                  mode === "create"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                สร้างเภสัชกรใหม่
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {mode === "select" ? (
              /* Select Existing Pharmacist */
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    เลือกเภสัชกรที่มีอยู่ <span className="text-rose-500">*</span>
                  </label>
                  {loading ? (
                    <div className="flex items-center gap-2 text-slate-500 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <svg className="animate-spin w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      กำลังโหลดข้อมูล...
                    </div>
                  ) : existingPharmacists.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-center">
                      ไม่มีเภสัชกรในระบบ
                    </div>
                  ) : (
                    <div>
                      <select
                        value={
                          selectedPharmacist
                            ? selectedPharmacist.users_permissions_user?.id || selectedPharmacist.users_permissions_user?.data?.id || selectedPharmacist.id
                            : ""
                        }
                        onChange={handlePharmacistSelect}
                        className="w-full border border-slate-300 rounded-xl p-3 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        required
                      >
                        <option value="">-- เลือกเภสัชกร --</option>
                        {Array.from(
                          new Map(
                            existingPharmacists
                              .filter((pharmacist) => {
                                const storesList = getAllStoresFromPharmacist(pharmacist);
                                const storeDocumentIds = storesList.map(s => s.documentId || s.id).filter(Boolean);
                                return !storeDocumentIds.includes(storeId);
                              })
                              .map((pharmacist) => {
                                const userId =
                                  pharmacist.users_permissions_user?.id ||
                                  pharmacist.users_permissions_user?.data?.id ||
                                  pharmacist.attributes?.users_permissions_user?.data?.id ||
                                  pharmacist.attributes?.users_permissions_user?.id ||
                                  pharmacist.id;
                                return [userId, pharmacist];
                              })
                          ).values()
                        ).map((pharmacist) => {
                          const user =
                            pharmacist.users_permissions_user ||
                            pharmacist.attributes?.users_permissions_user?.data ||
                            pharmacist.attributes?.users_permissions_user;
                          const userId = user?.id || user?.data?.id || user?.attributes?.id || pharmacist.users_permissions_user?.id || pharmacist.id;
                          const userName = user?.full_name || user?.attributes?.full_name;
                          const username = user?.username || user?.attributes?.username;
                          const licenseNumber =
                            pharmacist.license_number ||
                            pharmacist.attributes?.license_number ||
                            "ไม่ระบุ";
                          return (
                            <option key={userId} value={userId}>
                              {userName || `เภสัชกร ID: ${userId}`}
                              {username ? ` (username: ${username}) ` : " "}
                              (ใบอนุญาต: {licenseNumber})
                            </option>
                          );
                        })}
                      </select>
                      {(() => {
                        // Dedupe by users_permissions_user id so we count unique pharmacists (one user = one pharmacist)
                        const map = new Map();
                        existingPharmacists.forEach((ph) => {
                          // skip profiles that already include current store
                          const stores = getAllStoresFromPharmacist(ph).map(s => s.documentId || s.id).filter(Boolean);
                          if (stores.includes(storeId)) return;

                          const userId = ph.users_permissions_user?.id || ph.users_permissions_user?.data?.id || ph.attributes?.users_permissions_user?.data?.id || ph.attributes?.users_permissions_user?.id;
                          const key = userId || ph.id;
                          if (!map.has(key)) map.set(key, ph);
                        });

                        const uniquePharmacists = Array.from(map.values());
                        return uniquePharmacists.length === 0 ? (
                          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            เภสัชกรทั้งหมดทำงานในร้านนี้แล้ว
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            พบเภสัชกรที่สามารถเพิ่มได้ {uniquePharmacists.length} คน
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Show selected pharmacist details */}
                {selectedPharmacist && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        ข้อมูลเภสัชกรที่เลือก
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex flex-col">
                          <span className="text-slate-500 font-medium">ชื่อ-นามสกุล</span>
                          <span className="text-slate-800 font-semibold text-base">
                            {(() => {
                              const user = selectedPharmacist.users_permissions_user || selectedPharmacist.attributes?.users_permissions_user?.data;
                              return user?.full_name || user?.attributes?.full_name || "ไม่ระบุ";
                            })()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-500 font-medium">ชื่อผู้ใช้งาน (Username)</span>
                          <span className="text-slate-800 font-semibold text-base">
                            {(() => {
                              const user = selectedPharmacist.users_permissions_user || selectedPharmacist.attributes?.users_permissions_user?.data;
                              return user?.username || user?.attributes?.username || "ไม่ระบุ";
                            })()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-500 font-medium">เลขที่ใบอนุญาต</span>
                          <span className="text-slate-800 font-semibold text-base">
                            {selectedPharmacist.license_number || selectedPharmacist.attributes?.license_number || "ไม่ระบุ"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-500 font-medium">เบอร์โทรศัพท์</span>
                          <span className="text-slate-800 font-semibold text-base">
                            {(() => {
                              const user = selectedPharmacist.users_permissions_user || selectedPharmacist.attributes?.users_permissions_user?.data;
                              return user?.phone || user?.attributes?.phone || "ไม่ระบุ";
                            })()}
                          </span>
                        </div>
                        <div className="md:col-span-2 flex flex-col">
                          <span className="text-slate-500 font-medium">จำนวนร้านที่ทำงานอยู่</span>
                          <span className="inline-flex items-center gap-1.5 text-indigo-700 font-bold bg-indigo-50 px-3 py-1 rounded-lg w-fit mt-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {(() => {
                              const storesList = getAllStoresFromPharmacist(selectedPharmacist);
                              return storesList.length || 0;
                            })()} ร้าน
                          </span>
                        </div>
                      </div>

                      {/* แสดงเวลาทำงานปัจจุบัน */}
                      <div className="mt-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          เวลาทำงานปัจจุบัน (ทุกร้าน)
                        </h4>

                        {(() => {
                          const allTimes = getAggregatedWorkingTimesFromSelected();
                          if (!allTimes || allTimes.length === 0) {
                            return <p className="text-slate-500 text-sm italic">ไม่มีข้อมูลเวลาทำงาน</p>;
                          }

                          // Group by day for compact display
                          const grouped = allTimes.reduce((acc, t) => {
                            if (!acc[t.day]) acc[t.day] = [];
                            acc[t.day].push(t);
                            return acc;
                          }, {});

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              {Object.keys(grouped).map((day) => (
                                <div key={day} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
                                  <span className="font-bold text-slate-700">{day}</span>
                                  <div className="flex flex-col gap-1">
                                    {grouped[day].map((t, idx) => (
                                      <span key={idx} className="text-indigo-600 font-medium bg-indigo-50/50 px-2 py-0.5 rounded w-fit">
                                        {t.time_in} - {t.time_out}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* เพิ่มฟอร์มเวลาทำงานสำหรับร้านนี้ */}
                    <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100">
                      <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        กำหนดเวลาทำงานสำหรับร้านนี้ <span className="text-rose-500">*</span>
                      </h3>
                      <p className="text-sm text-indigo-700/80 mb-4">
                        กรุณากำหนดเวลาทำงานของเภสัชกรสำหรับร้านนี้โดยเฉพาะ
                      </p>
                      
                      {/* แสดงคำเตือนถ้ามีเวลาทำงานอื่นที่อาจชนกัน */}
                      {(() => {
                        const storesList = getAllStoresFromPharmacist(selectedPharmacist);
                        const storeDocumentIds = storesList.map(s => s.documentId || s.id).filter(Boolean);
                        const hasOtherStoreWorkingTime = storeDocumentIds.some(id => id && id !== storeId);

                        return hasOtherStoreWorkingTime && (
                          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                            <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span><strong>ข้อควรระวัง:</strong> เภสัชกรคนนี้มีเวลาทำงานในร้านอื่นอยู่แล้ว กรุณาตรวจสอบให้แน่ใจว่าเวลาทำงานไม่ซ้อนทับกัน</span>
                          </div>
                        );
                      })()} 

                      {/* Bulk Add for select mode */}
                      <div className="mb-5 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          เพิ่มเวลาเดียวกันสำหรับหลายวัน
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"].map(day => (
                            <label key={day} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${selectedDays.includes(day) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                              <input
                                type="checkbox"
                                checked={selectedDays.includes(day)}
                                onChange={(e) => handleDaySelection(day, e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                              />
                              <span className="text-sm font-medium">{day}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="time"
                              value={bulkTimeIn}
                              onChange={(e) => setBulkTimeIn(e.target.value)}
                              className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                            />
                            <span className="text-slate-400 font-medium">-</span>
                            <input
                              type="time"
                              value={bulkTimeOut}
                              onChange={(e) => setBulkTimeOut(e.target.value)}
                              className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={addBulkStoreWorkingTime}
                            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                          >
                            เพิ่มช่วงเวลา
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-bold text-slate-700 mb-2">ตารางเวลาทำงานที่กำหนด</h4>
                        {storeWorkingTime.map((item, index) => (
                          <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <select
                              value={item.day}
                              onChange={(e) => {
                                handleStoreWorkingTimeChange(index, "day", e.target.value);
                              }}
                              className="w-full sm:w-40 border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                            >
                              <option value="จันทร์">จันทร์</option>
                              <option value="อังคาร">อังคาร</option>
                              <option value="พุธ">พุธ</option>
                              <option value="พฤหัสบดี">พฤหัสบดี</option>
                              <option value="ศุกร์">ศุกร์</option>
                              <option value="เสาร์">เสาร์</option>
                              <option value="อาทิตย์">อาทิตย์</option>
                            </select>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <input
                                type="time"
                                value={item.time_in}
                                onChange={(e) => {
                                  handleStoreWorkingTimeChange(index, "time_in", e.target.value);
                                }}
                                className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                                required
                              />
                              <span className="text-slate-400 font-medium">-</span>
                              <input
                                type="time"
                                value={item.time_out}
                                onChange={(e) => {
                                  handleStoreWorkingTimeChange(index, "time_out", e.target.value);
                                }}
                                className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                                required
                              />
                            </div>

                            {storeWorkingTime.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  removeStoreWorkingTime(index);
                                }}
                                className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-auto text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                ลบ
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          addStoreWorkingTime();
                        }}
                        className="mt-4 inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        เพิ่มวัน/เวลา แยก
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Create New Pharmacist Form */
              <div className="space-y-8">
                {/* User Info */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">ข้อมูลส่วนตัว</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อ <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        name="firstname"
                        value={formData.firstname}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">นามสกุล <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        name="lastname"
                        value={formData.lastname}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">เลขที่ใบอนุญาต <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        name="license_number"
                        value={formData.license_number}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">เบอร์โทรศัพท์ <span className="text-rose-500">*</span></label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                        required
                        pattern="[0-9]+"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Info */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">ข้อมูลบัญชีผู้ใช้</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">รหัสผ่าน (Password) <span className="text-rose-500">*</span></label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Profile Image */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">รูปโปรไฟล์</h3>
                  <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                    <div className="relative w-32 h-32 shrink-0">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="preview"
                          className="w-full h-full object-cover rounded-2xl border-2 border-slate-200 shadow-sm"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-slate-200 border-dashed">
                          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center h-32">
                      <label className="inline-flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors shadow-sm font-medium">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        อัปโหลดรูปภาพ
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-slate-500 mt-2">รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Working Times */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">วันและเวลาเข้างาน <span className="text-rose-500">*</span></h3>
                  
                  {/* Bulk Add Section */}
                  <div className="mb-6 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      เพิ่มเวลาเดียวกันสำหรับหลายวัน
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"].map(day => (
                        <label key={day} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${selectedDays.includes(day) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={selectedDays.includes(day)}
                            onChange={(e) => handleDaySelection(day, e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium">{day}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="time"
                          value={bulkTimeIn}
                          onChange={(e) => setBulkTimeIn(e.target.value)}
                          className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32"
                        />
                        <span className="text-slate-400 font-medium">-</span>
                        <input
                          type="time"
                          value={bulkTimeOut}
                          onChange={(e) => setBulkTimeOut(e.target.value)}
                          className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addBulkWorkingTime}
                        className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                      >
                        เพิ่มช่วงเวลา
                      </button>
                    </div>
                  </div>

                  {/* Individual Working Times List */}
                  {formData.working_time && formData.working_time.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-700 mb-2">ตารางเวลาทำงานปัจจุบัน</h4>
                      {formData.working_time.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                          <select
                            value={item.day}
                            onChange={(e) =>
                              handleWorkingTimeChange(index, "day", e.target.value)
                            }
                            className="w-full sm:w-40 border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                          >
                            <option value="จันทร์">จันทร์</option>
                            <option value="อังคาร">อังคาร</option>
                            <option value="พุธ">พุธ</option>
                            <option value="พฤหัสบดี">พฤหัสบดี</option>
                            <option value="ศุกร์">ศุกร์</option>
                            <option value="เสาร์">เสาร์</option>
                            <option value="อาทิตย์">อาทิตย์</option>
                          </select>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="time"
                              value={item.time_in}
                              onChange={(e) =>
                                handleWorkingTimeChange(index, "time_in", e.target.value)
                              }
                              className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                            />
                            <span className="text-slate-400 font-medium">-</span>
                            <input
                              type="time"
                              value={item.time_out}
                              onChange={(e) =>
                                handleWorkingTimeChange(index, "time_out", e.target.value)
                              }
                              className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeWorkingTime(index)}
                            className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-auto text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            ลบ
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 border border-slate-200 border-dashed rounded-xl mb-4">
                      <svg className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-slate-500 font-medium">ยังไม่มีเวลาทำงาน กรุณาเพิ่มเวลาทำงาน</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addWorkingTime}
                    className="mt-4 inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    เพิ่มวัน/เวลา แยก
                  </button>
                </div>

                {/* Services */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">การให้บริการ <span className="text-rose-500">*</span></h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                    {[
                      {
                        key: "sell_products",
                        label: "จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ",
                      },
                      { key: "consulting", label: "ให้คำปรึกษาทางเภสัชกรรม" },
                      { key: "wholesale", label: "ขายปลีกและขายส่ง" },
                      {
                        key: "delivery",
                        label: "บริการจัดส่งกล่องยาสามัญประจำบ้าน",
                      },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300 transition-colors">
                        <input
                          type="checkbox"
                          name={item.key}
                          checked={formData.services[item.key]}
                          onChange={handleChange}
                          className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium text-sm">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submit & Back Button */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                className="w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm order-2 sm:order-1"
                onClick={() => navigate(-1)}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm order-1 sm:order-2 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mode === "select" && !selectedPharmacist}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                {mode === "select" ? "เพิ่มเภสัชกรให้ร้าน" : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal: แสดงเวลาทำงานทั้งหมด (ไม่แสดงชื่อร้าน) */}
      {showWorkTimesModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowWorkTimesModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="เวลาทำงานทั้งหมดของเภสัชกร"
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                เวลาทำงานทั้งหมด
              </h3>
              <button
                type="button"
                onClick={() => setShowWorkTimesModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition-colors"
                aria-label="ปิด"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  const allTimes = getAggregatedWorkingTimesFromSelected();
                  if (allTimes.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-slate-500 font-medium">ไม่มีข้อมูลเวลาทำงาน</p>
                      </div>
                    );
                  }

                  // Group by day
                  const grouped = allTimes.reduce((acc, t) => {
                    if (!acc[t.day]) acc[t.day] = [];
                    acc[t.day].push(t);
                    return acc;
                  }, {});

                  return Object.keys(grouped).map((day) => (
                    <div key={day} className="flex flex-col p-3.5 bg-slate-50 rounded-xl border border-slate-100 gap-2">
                      <span className="font-bold text-slate-700">{day}</span>
                      <div className="flex flex-col gap-1.5">
                        {grouped[day].map((t, idx) => (
                          <span key={idx} className="text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm font-medium w-fit">
                            {t.time_in} - {t.time_out}
                          </span>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowWorkTimesModal(false)}
                className="bg-white border border-slate-300 text-slate-700 px-5 py-2 rounded-xl hover:bg-slate-100 transition-colors font-medium shadow-sm"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddPharmacist_admin;
