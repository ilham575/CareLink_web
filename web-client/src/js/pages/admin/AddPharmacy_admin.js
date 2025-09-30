import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/HomeHeader";
import Footer from "../../components/footer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

  // ✅ Fetch existing pharmacists - แก้ไขการ debug
  useEffect(() => {
    const fetchExistingPharmacists = async () => {
      if (!jwt) {
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          "http://localhost:1337/api/pharmacy-profiles?populate=users_permissions_user&populate=drug_stores",
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setExistingPharmacists(data.data);
        } else {
          // await response.text(); // Removed unused assignment
        }
      } catch (error) {
        toast.error("ไม่สามารถโหลดข้อมูลเภสัชกรได้");
      } finally {
        setLoading(false);
      }
    };

    fetchExistingPharmacists();
  }, [jwt]);

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

  // ✅ Handle pharmacist selection - แก้ไขการเข้าถึงข้อมูล
  const handlePharmacistSelect = (e) => {
    const pharmacistId = e.target.value;
    const pharmacist = existingPharmacists.find(
      (p) => p.id.toString() === pharmacistId
    );
    setSelectedPharmacist(pharmacist);
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
          `http://localhost:1337/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${userId}&filters[drug_stores][documentId][$eq]=${storeId}`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        const checkData = await checkRes.json();
        if (checkData.data && checkData.data.length > 0) {
          toast.error("เภสัชกรนี้มีโปรไฟล์ในร้านนี้อยู่แล้ว");
          return;
        }

        // เตรียมข้อมูลสำหรับสร้าง profile ใหม่ (ไม่แก้ไข profile เดิม)
        const workingTimeForStore = storeWorkingTime
          .filter((wt) => wt.time_in && wt.time_out)
          .map((wt) => ({
            day: dayMapReverse[wt.day] || wt.day,
            time_in: wt.time_in,
            time_out: wt.time_out,
          }));

        const payload = {
          data: {
            license_number: selectedPharmacist.license_number || "",
            services: selectedPharmacist.services || {},
            drug_stores: [storeId],
            users_permissions_user: userId,
            profileimage:
              selectedPharmacist.profileimage?.[0]?.id ||
              selectedPharmacist.profileimage?.id ||
              null,
            working_time: workingTimeForStore,
          },
        };

        // สร้าง pharmacy profile ใหม่
        const res = await fetch("http://localhost:1337/api/pharmacy-profiles", {
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

        toast.success(`✅ เพิ่มเภสัชกรให้ร้านเรียบร้อย!`);
      } else {
        // 🟢 ตรวจสอบเวลาทำงานซ้ำ
        if (hasOverlappingWorkingTimes(formData.working_time)) {
          toast.error("เวลาทำงานซ้ำกัน กรุณาตรวจสอบวันและเวลา");
          return;
        }

        // 1. สมัคร User
        const userRes = await fetch(
          "http://localhost:1337/api/auth/local/register",
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
          "http://localhost:1337/api/users-permissions/roles",
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );
        const roleData = await roleRes.json();
        const pharmacistRole = roleData.roles.find((r) => r.name === "pharmacy");
        if (!pharmacistRole) throw new Error("ไม่พบ role pharmacist");

        // 3. อัปเดต User
        await fetch(`http://localhost:1337/api/users/${userData.user.id}`, {
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

          const uploadRes = await fetch("http://localhost:1337/api/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
            body: imageForm,
          });

          if (!uploadRes.ok) throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");

          const uploadData = await uploadRes.json();
          uploadedImageId = uploadData[0].id;
        }

        // 5. สร้าง Pharmacy Profile (1 profile ต่อ 1 ร้าน)
        const workingTimeForStore = formData.working_time.map((wt) => ({
          ...wt,
          day: dayMapReverse[wt.day] || wt.day,
        }));

        const payload = {
          data: {
            license_number: formData.license_number,
            services: formData.services,
            drug_stores: [storeId],
            users_permissions_user: userData.user.id,
            profileimage: uploadedImageId || null,
            working_time: workingTimeForStore,
          },
        };

        const res = await fetch("http://localhost:1337/api/pharmacy-profiles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error?.message || "เพิ่มเภสัชกรไม่สำเร็จ");
        }

        toast.success(`✅ เพิ่มเภสัชกรใหม่เรียบร้อย!`);
      }

      // Force refresh หน้าที่เกี่ยวข้อง
      setTimeout(() => {
        navigate(`/pharmacist_detail_admin/${storeId}`, {
          state: { forceRefresh: true, timestamp: Date.now() }
        });
      }, 1000);
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  return (
    <>
      <Header />

      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-bold text-green-700 mb-4 text-center">
          เพิ่มเภสัชกรประจำร้านขายยา
        </h2>

        {/* Mode Toggle */}
        <div className="mb-6 flex justify-center">
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              type="button"
              onClick={() => {
                setMode("select");
                setSelectedPharmacist(null);
              }}
              className={`px-4 py-2 rounded ${
                mode === "select"
                  ? "bg-green-600 text-white"
                  : "bg-transparent text-gray-700 hover:bg-gray-200"
              }`}
            >
              เลือกจากเภสัชกรที่มีอยู่
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("create");
              }}
              className={`px-4 py-2 rounded ${
                mode === "create"
                  ? "bg-green-600 text-white"
                  : "bg-transparent text-gray-700 hover:bg-gray-200"
              }`}
            >
              สร้างเภสัชกรใหม่
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "select" ? (
            /* Select Existing Pharmacist */
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">
                  เลือกเภสัชกรที่มีอยู่*
                </label>
                {loading ? (
                  <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                ) : existingPharmacists.length === 0 ? (
                  <div>
                    <p className="text-gray-500">ไม่มีเภสัชกรในระบบ</p>
                  </div>
                ) : (
                  <div>
                    <select
                      value={selectedPharmacist?.id || ""}
                      onChange={handlePharmacistSelect}
                      className="w-full border rounded p-2"
                      required
                    >
                      <option value="">-- เลือกเภสัชกร --</option>
                      {Array.from(
                        new Map(
                          existingPharmacists
                            .filter((pharmacist) => {
                              const stores =
                                pharmacist.drug_stores ||
                                pharmacist.attributes?.drug_stores?.data ||
                                [];
                              const storeDocumentIds = stores.map(
                                (store) => store.documentId || store.attributes?.documentId
                              );
                              const isAlreadyInStore = storeDocumentIds.includes(storeId);
                              return !isAlreadyInStore;
                            })
                            .map((pharmacist) => [
                              // ใช้ user id เป็น key เพื่อ uniqueness
                              pharmacist.users_permissions_user?.id ||
                                pharmacist.users_permissions_user?.data?.id,
                              pharmacist,
                            ])
                        ).values()
                      ).map((pharmacist) => {
                        const user =
                          pharmacist.users_permissions_user ||
                          pharmacist.attributes?.users_permissions_user?.data;
                        const userName = user?.full_name || user?.attributes?.full_name;
                        const username = user?.username || user?.attributes?.username;
                        const licenseNumber =
                          pharmacist.license_number ||
                          pharmacist.attributes?.license_number ||
                          "ไม่ระบุ";
                        return (
                          <option key={pharmacist.id} value={pharmacist.id}>
                            {userName || `เภสัชกร ID: ${pharmacist.id}`}
                            {username ? ` (username: ${username}) ` : " "}
                            (ใบอนุญาต: {licenseNumber})
                          </option>
                        );
                      })}
                    </select>
                    {(() => {
                      const availablePharmacists = existingPharmacists.filter((pharmacist) => {
                        const stores = pharmacist.drug_stores || pharmacist.attributes?.drug_stores?.data || [];
                        const storeDocumentIds = stores.map((store) => store.documentId || store.attributes?.documentId);
                        return !storeDocumentIds.includes(storeId);
                      });
                      
                      return availablePharmacists.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-2">
                          เภสัชกรทั้งหมดทำงานในร้านนี้แล้ว
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">
                          พบเภสัชกรที่ใช้งานได้ {availablePharmacists.length} คน
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Show selected pharmacist details */}
              {selectedPharmacist && (
                <>
                  <div className="bg-gray-50 p-4 rounded border">
                    <h3 className="font-semibold text-lg mb-2">
                      ข้อมูลเภสัชกรที่เลือก
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <strong>ชื่อ:</strong>{" "}
                        {(() => {
                          const user = selectedPharmacist.users_permissions_user || selectedPharmacist.attributes?.users_permissions_user?.data;
                          return user?.full_name || user?.attributes?.full_name || "ไม่ระบุ";
                        })()}
                      </div>
                      <div>
                        <strong>USERNAME:</strong>{" "}
                        {(() => {
                          const user = selectedPharmacist.users_permissions_user || selectedPharmacist.attributes?.users_permissions_user?.data;
                          return user?.username || user?.attributes?.username || "ไม่ระบุ";
                        })()}
                      </div>
                      <div>
                        <strong>เลขที่ใบอนุญาต:</strong>{" "}
                        {selectedPharmacist.license_number || selectedPharmacist.attributes?.license_number || "ไม่ระบุ"}
                      </div>
                      <div>
                        <strong>เบอร์โทรศัพท์:</strong>{" "}
                        {(() => {
                          const user = selectedPharmacist.users_permissions_user || selectedPharmacist.attributes?.users_permissions_user?.data;
                          return user?.phone || user?.attributes?.phone || "ไม่ระบุ";
                        })()}
                      </div>
                      <div className="md:col-span-2">
                        <strong>ร้านที่ทำงานอยู่:</strong>{" "}
                        {(() => {
                          const stores = selectedPharmacist.drug_stores || selectedPharmacist.attributes?.drug_stores?.data;
                          return stores?.length || 0;
                        })()} ร้าน
                      </div>
                    </div>
                  </div>

                  {/* เพิ่มฟอร์มเวลาทำงานสำหรับร้านนี้ */}
                  <div className="bg-blue-50 p-4 rounded border">
                    <h3 className="font-semibold text-lg mb-2">
                      กำหนดเวลาทำงานสำหรับร้านนี้*
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      กรุณากำหนดเวลาทำงานของเภสัชกรสำหรับร้านนี้โดยเฉพาะ (Store ID: {storeId})
                    </p>
                    {storeWorkingTime.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center mb-2">
                        <select
                          value={item.day}
                          onChange={(e) => {
                            handleStoreWorkingTimeChange(index, "day", e.target.value);
                          }}
                          className="border p-2 rounded"
                        >
                          <option value="จันทร์">จันทร์</option>
                          <option value="อังคาร">อังคาร</option>
                          <option value="พุธ">พุธ</option>
                          <option value="พฤหัสบดี">พฤหัสบดี</option>
                          <option value="ศุกร์">ศุกร์</option>
                          <option value="เสาร์">เสาร์</option>
                          <option value="อาทิตย์">อาทิตย์</option>
                        </select>

                        <input
                          type="time"
                          value={item.time_in}
                          onChange={(e) => {
                            handleStoreWorkingTimeChange(index, "time_in", e.target.value);
                          }}
                          className="border p-2 rounded"
                          required
                        />
                        <input
                          type="time"
                          value={item.time_out}
                          onChange={(e) => {
                            handleStoreWorkingTimeChange(index, "time_out", e.target.value);
                          }}
                          className="border p-2 rounded"
                          required
                        />

                        {storeWorkingTime.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              removeStoreWorkingTime(index);
                            }}
                            className="text-red-500 ml-2"
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-center mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          addStoreWorkingTime();
                        }}
                        className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                      >
                        + เพิ่มวัน/เวลา
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Create New Pharmacist Form */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Firstname & Lastname */}
              <div>
                <label className="block font-semibold mb-1">ชื่อ*</label>
                <input
                  type="text"
                  name="firstname"
                  value={formData.firstname}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">นามสกุล*</label>
                <input
                  type="text"
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  required
                />
              </div>

              {/* License & Phone */}
              <div className="md:col-span-2">
                <label className="block font-semibold mb-1">เลขที่ใบอนุญาต*</label>
                <input
                  type="text"
                  name="license_number"
                  value={formData.license_number}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">เบอร์โทรศัพท์*</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  required
                  pattern="[0-9]+"
                  inputMode="numeric"
                />
              </div>

              {/* Working Times */}
              <div className="md:col-span-2">
                <label className="block font-semibold mb-2">
                  วันและเวลาเข้างาน*
                </label>
                {formData.working_time.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center mb-2">
                    <select
                      value={item.day}
                      onChange={(e) =>
                        handleWorkingTimeChange(index, "day", e.target.value)
                      }
                      className="border p-2 rounded"
                    >
                      <option value="จันทร์">จันทร์</option>
                      <option value="อังคาร">อังคาร</option>
                      <option value="พุธ">พุธ</option>
                      <option value="พฤหัสบดี">พฤหัสบดี</option>
                      <option value="ศุกร์">ศุกร์</option>
                      <option value="เสาร์">เสาร์</option>
                      <option value="อาทิตย์">อาทิตย์</option>
                    </select>

                    <input
                      type="time"
                      value={item.time_in}
                      onChange={(e) =>
                        handleWorkingTimeChange(index, "time_in", e.target.value)
                      }
                      className="border p-2 rounded"
                    />
                    <input
                      type="time"
                      value={item.time_out}
                      onChange={(e) =>
                        handleWorkingTimeChange(index, "time_out", e.target.value)
                      }
                      className="border p-2 rounded"
                    />

                    <button
                      type="button"
                      onClick={() => removeWorkingTime(index)}
                      className="text-red-500 ml-2"
                    >
                      ลบ
                    </button>
                  </div>
                ))}
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    onClick={addWorkingTime}
                    className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                  >
                    + เพิ่มวัน/เวลา
                  </button>
                </div>
              </div>

              {/* Username & Password */}
              <div>
                <label className="block font-semibold mb-1">USERNAME*</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">PASSWORD*</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  required
                />
              </div>

              {/* Profile Image */}
              <div className="md:col-span-2">
                <label className="block font-semibold mb-2 text-center">
                  รูปภาพโปรไฟล์
                </label>
                {imagePreview && (
                  <div className="mb-2 flex justify-center">
                    <img
                      src={imagePreview}
                      alt="preview"
                      className="w-32 h-32 object-cover rounded-full border"
                    />
                  </div>
                )}
                <div className="flex justify-center">
                  <label className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300">
                    เลือกรูปภาพ
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Services */}
              <div className="md:col-span-2">
                <label className="block font-semibold mb-2">การให้บริการ*</label>
                <div className="space-y-3 p-4 bg-gray-100 rounded">
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
                    <label key={item.key} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        name={item.key}
                        checked={formData.services[item.key]}
                        onChange={handleChange}
                        className="mt-1"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Submit & Back Button */}
          <div className="flex justify-end items-center gap-4 mt-6">
            <button
              type="button"
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              onClick={() => navigate(-1)}
            >
              กลับ
            </button>
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
              disabled={mode === "select" && !selectedPharmacist}
            >
              {mode === "select" ? "เพิ่มเภสัชกรให้ร้าน" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>

      <Footer />
      <ToastContainer />
    </>
  );
}

export default AddPharmacist_admin;