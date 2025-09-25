import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function EditPharmacist_admin() {
  const { id } = useParams(); // id ของเภสัชกร
  const navigate = useNavigate();
  const jwt = localStorage.getItem("jwt");

  const [formData, setFormData] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`http://localhost:1337/api/pharmacy-profiles/${id}?populate=*`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลเภสัชกรได้");

        const data = await res.json();
        const p = data.data;

        if (p) {
          const [time_in, time_out] = p.working_time?.split(" - ") || ["", ""];
          setFormData({
            id: p.id,
            firstname: p.users_permissions_user?.full_name?.split(" ")[0] || "",
            lastname: p.users_permissions_user?.full_name?.split(" ").slice(1).join(" ") || "",
            license_number: p.license_number || "",
            phone: p.users_permissions_user?.phone || "",
            time_in,
            time_out,
            services: p.services || {
              sell_products: false,
              consulting: false,
              wholesale: false,
              delivery: false,
            },
            profileimage: p.profileimage,
            drug_store: p.drug_stores?.[0]?.id || null,
            user: p.users_permissions_user?.id || null,
            username: p.users_permissions_user?.username || "",
          });
          
          // Set current image preview if exists
          if (p.profileimage) {
            setImagePreview(`http://localhost:1337${p.profileimage.url}`);
          }
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
      if (name === "is_primary") {
        setFormData({ ...formData, is_primary: checked });
      } else {
        setFormData({
          ...formData,
          services: { ...formData.services, [name]: checked },
        });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert("กรุณาเลือกไฟล์รูปภาพ");
        return;
      }
      
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    
    const formData = new FormData();
    formData.append('files', imageFile);
    
    try {
      const res = await fetch('http://localhost:1337/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: formData,
      });
      
      if (!res.ok) throw new Error('ไม่สามารถอัปโหลดรูปภาพได้');
      
      const uploadedFiles = await res.json();
      return uploadedFiles[0]?.id || null;
    } catch (err) {
      console.error('Image upload error:', err);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let imageId = formData.profileimage?.id;
      
      // Upload new image if selected
      if (imageFile) {
        imageId = await uploadImage();
      }

      const payload = {
        data: {
          license_number: formData.license_number,
          working_time: `${formData.time_in} - ${formData.time_out}`,
          services: formData.services,
          profileimage: imageId,
        },
      };

      const res = await fetch(`http://localhost:1337/api/pharmacy-profiles/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
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
    <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-green-700 mb-4">
        แก้ไขข้อมูลเภสัชกร
      </h2>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
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
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full border rounded p-2"
            />
            <p className="text-sm text-gray-500">
              รองรับไฟล์: JPG, PNG, GIF (ขนาดไม่เกิน 5MB)
            </p>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">ชื่อ-นามสกุล*</label>
          <input
            type="text"
            name="firstname"
            value={`${formData.firstname} ${formData.lastname}`.trim()}
            onChange={(e) => {
              const fullName = e.target.value;
              const parts = fullName.split(" ");
              setFormData({
                ...formData,
                firstname: parts[0] || "",
                lastname: parts.slice(1).join(" ") || ""
              });
            }}
            className="w-full border rounded p-2 bg-gray-100"
            readOnly
            title="ชื่อ-นามสกุลถูกกำหนดจาก User Account"
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
            readOnly
            title="เบอร์โทรศัพท์ถูกกำหนดจาก User Account"
          />
        </div>
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
          <label className="block font-semibold mb-1">เวลาเข้างาน*</label>
          <input
            type="time"
            name="time_in"
            value={formData.time_in}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">เวลาออกงาน*</label>
          <input
            type="time"
            name="time_out"
            value={formData.time_out}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">USERNAME (จาก User)</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            readOnly
            className="w-full border rounded p-2 bg-gray-100"
          />
        </div>

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

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_primary"
                checked={formData.is_primary}
                onChange={handleChange}
              />
              <span>เป็นเภสัชกรประจำร้านนี้</span>
            </label>
          </div>
        </div>

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
  );
}

export default EditPharmacist_admin;
