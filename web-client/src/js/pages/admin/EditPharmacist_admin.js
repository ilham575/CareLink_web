import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import HomeHeader from "../../components/HomeHeader";

// 🟢 helper function ดึง URL รูปภาพจาก Strapi
function getImageUrl(photo) {
  if (!photo) return null;
  if (typeof photo === "string") return photo;
  if (photo.url) {
    return `${process.env.REACT_APP_API_URL || "http://localhost:1337"}${photo.url}`;
  }
  return null;
}

// 🟢 mapping วัน อังกฤษ -> ไทย
const dayMap = {
  monday: "จันทร์",
  tuesday: "อังคาร",
  wednesday: "พุธ",
  thursday: "พฤหัสบดี",
  friday: "ศุกร์",
  saturday: "เสาร์",
  sunday: "อาทิตย์",
};

// 🟢 mapping วัน ไทย -> ไทย (เก็บเป็นไทยใน DB)
const dayMapReverse = Object.fromEntries(
  Object.values(dayMap).map((th) => [th, th])
);

function EditPharmacist_admin() {
  const { id } = useParams(); // pharmacy profile id
  const navigate = useNavigate();
  const jwt = localStorage.getItem("jwt");

  const [formData, setFormData] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageId, setImageId] = useState(null); // 🟢 เก็บ id ของรูปเก่า

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `http://localhost:1337/api/pharmacy-profiles/${id}?populate=*`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );

        if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลเภสัชกรได้");

        const data = await res.json();
        const p = data.data;
        console.log("Loaded pharmacist data:", p); // Debug log

        if (p) {
          const fullName = p.users_permissions_user?.full_name || "";
          const [firstname, ...lastnameParts] = fullName.split(" ");
          const lastname = lastnameParts.join(" ");

          // 🟢 ดึงข้อมูลรูปภาพ - แก้ไขให้ตรงกับโครงสร้างจริง
          let previewUrl = null;
          let profileImgId = null;

          console.log("Profile image data:", p.profileimage); // Debug log

          if (p.profileimage) {
            // กรณี profileimage เป็น array
            if (Array.isArray(p.profileimage)) {
              if (p.profileimage.length > 0) {
                const img = p.profileimage[0];
                previewUrl = `http://localhost:1337${img.url}`;
                profileImgId = img.id;
              }
            }
            // กรณี profileimage เป็น object เดี่ยว
            else if (p.profileimage.url) {
              previewUrl = `http://localhost:1337${p.profileimage.url}`;
              profileImgId = p.profileimage.id;
            }
            // กรณี profileimage มี data wrapper
            else if (p.profileimage.data) {
              if (Array.isArray(p.profileimage.data) && p.profileimage.data.length > 0) {
                const img = p.profileimage.data[0];
                previewUrl = `http://localhost:1337${img.attributes.url}`;
                profileImgId = img.id;
              } else if (p.profileimage.data.attributes) {
                previewUrl = `http://localhost:1337${p.profileimage.data.attributes.url}`;
                profileImgId = p.profileimage.data.id;
              }
            }
          }

          console.log("Preview URL:", previewUrl); // Debug log
          console.log("Profile Image ID:", profileImgId); // Debug log

          setFormData({
            id: p.id,
            firstname: firstname || "",
            lastname: lastname || "",
            license_number: p.license_number || "",
            phone: p.users_permissions_user?.phone || "",
            services: p.services || {
              sell_products: false,
              consulting: false,
              wholesale: false,
              delivery: false,
            },
            drug_store: p.drug_stores?.[0]?.documentId || p.drug_stores?.[0]?.id || null,
            user: p.users_permissions_user?.id || null,
            username: p.users_permissions_user?.username || "",
            password: "********",
            working_times:
              Array.isArray(p.working_time) && p.working_time.length > 0
                ? p.working_time.map((wt) => ({
                    ...wt,
                    day: dayMap[wt.day] || wt.day, // แปลงอังกฤษ → ไทย
                  }))
                : [{ day: "จันทร์", time_in: "", time_out: "" }],
          });

          setImagePreview(previewUrl);
          setImageId(profileImgId);
        }
      } catch (err) {
        console.error("Load pharmacist error:", err);
      }
    };
    load();
  }, [id, jwt]);

  if (!formData) return <div className="p-6">กำลังโหลดข้อมูล...</div>;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setFormData({
        ...formData,
        services: { ...formData.services, [name]: checked },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        alert("กรุณาเลือกไฟล์รูปภาพ");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return imageId; // ใช้ id เก่าถ้าไม่ได้เลือกใหม่
    
    const formDataUpload = new FormData();
    formDataUpload.append("files", imageFile);

    try {
      const res = await fetch("http://localhost:1337/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formDataUpload,
      });

      if (!res.ok) throw new Error("ไม่สามารถอัปโหลดรูปภาพได้");

      const uploadedFiles = await res.json();
      console.log("Uploaded files:", uploadedFiles); // Debug log
      return uploadedFiles[0]?.id || null;
    } catch (err) {
      console.error("Upload error:", err);
      throw err;
    }
  };

  // 👉 จัดการ working_times
  const addWorkingTime = () => {
    setFormData({
      ...formData,
      working_times: [
        ...formData.working_times,
        { day: "จันทร์", time_in: "", time_out: "" },
      ],
    });
  };

  const handleWorkingTimeChange = (index, field, value) => {
    const updated = [...formData.working_times];
    updated[index][field] = value;
    setFormData({ ...formData, working_times: updated });
  };

  const removeWorkingTime = (index) => {
    const updated = [...formData.working_times];
    updated.splice(index, 1);
    setFormData({ ...formData, working_times: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const newImageId = await uploadImage();
      console.log("Final image ID:", newImageId); // Debug log

      // ✅ Update User
      const userPayload = {
        username: formData.username,
        full_name: `${formData.firstname} ${formData.lastname}`,
        phone: formData.phone,
      };
      if (formData.password && formData.password !== "********") {
        userPayload.password = formData.password;
      }

      await fetch(`http://localhost:1337/api/users/${formData.user}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(userPayload),
      });

      // ✅ Update Pharmacy Profile
      const payload = {
        data: {
          license_number: formData.license_number,
          services: formData.services,
          profileimage: newImageId ? newImageId : (imageId || null), // ส่งเป็น single ID ไม่ใช่ array
          working_time: formData.working_times.map((wt) => ({
            day: dayMapReverse[wt.day] || wt.day,
            time_in: wt.time_in,
            time_out: wt.time_out,
          })),
        },
      };

      console.log("Update payload:", payload); // Debug log

      const res = await fetch(
        `http://localhost:1337/api/pharmacy-profiles/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        console.error("Update error:", error); // Debug log
        throw new Error(error.error?.message || "อัปเดตข้อมูลไม่สำเร็จ");
      }

      alert("✅ อัปเดตข้อมูลเภสัชกรเรียบร้อย!");
      navigate(`/pharmacist_detail_admin/${formData.drug_store}`);
    } catch (err) {
      console.error("Update pharmacist error:", err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  return (
    <>
      <HomeHeader />
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-bold text-green-700 mb-4">
          แก้ไขข้อมูลเภสัชกร
        </h2>

        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          onSubmit={handleSubmit}
        >
          {/* Profile Image */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">รูปโปรไฟล์</label>
            <div className="space-y-4">
              {imagePreview && (
                <div className="flex justify-center">
                  <img
                    src={imagePreview}
                    alt="Profile Preview"
                    className="w-32 h-32 object-cover rounded-full border-4 border-gray-300"
                  />
                </div>
              )}
              <div className="flex justify-center">
                <label className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300">
                  เลือกรูปภาพ
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* User Info */}
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

          {/* Pharmacy Profile */}
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

          {/* Working Times */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-2">วันและเวลาเข้างาน*</label>
            {formData.working_times.map((item, index) => (
              <div key={index} className="flex gap-2 items-center mb-2">
                <select
                  value={item.day}
                  onChange={(e) =>
                    handleWorkingTimeChange(index, "day", e.target.value)
                  }
                  className="border p-2 rounded"
                >
                  {Object.values(dayMap).map((thDay) => (
                    <option key={thDay} value={thDay}>
                      {thDay}
                    </option>
                  ))}
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

            <button
              type="button"
              onClick={addWorkingTime}
              className="mt-2 bg-gray-200 px-3 py-1 rounded"
            >
              + เพิ่มวัน/เวลา
            </button>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">การให้บริการ*</label>
            <div className="space-y-2 p-4 bg-gray-100 rounded">
              {[
                { key: "sell_products", label: "จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ" },
                { key: "consulting", label: "ให้คำปรึกษาทางเภสัชกรรม" },
                { key: "wholesale", label: "ขายปลีกและขายส่ง" },
                { key: "delivery", label: "บริการจัดส่งกล่องยาสามัญประจำบ้าน" },
              ].map((s) => (
                <label key={s.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={s.key}
                    checked={formData.services[s.key]}
                    onChange={handleChange}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default EditPharmacist_admin;
