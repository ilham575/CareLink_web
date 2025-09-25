import React, { useState } from "react";
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
  const { storeId } = useParams(); // documentId ของร้าน
  const jwt = localStorage.getItem("jwt");

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
    working_times: [{ day: "จันทร์", time_in: "", time_out: "" }], // 🟢 default วันไทย
  });

  const [imagePreview, setImagePreview] = useState(null);

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

  // ✅ Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!jwt) {
      toast.error("กรุณาเข้าสู่ระบบใหม่");
      navigate("/login");
      return;
    }

    try {
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

      // 5. สร้าง Pharmacy Profile
      const payload = {
        data: {
          license_number: formData.license_number,
          services: formData.services,
          drug_stores: [storeId],
          users_permissions_user: userData.user.id,
          profileimage: uploadedImageId || null,
          working_times: formData.working_times.map((wt) => ({
            ...wt,
            day: dayMapReverse[wt.day] || wt.day, // 🟢 เก็บวันเป็นภาษาไทย
          })),
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

      toast.success(`✅ เพิ่มเภสัชกรเรียบร้อย! (ร้าน ${storeId})`);
      navigate(`/pharmacist_detail_admin/${storeId}`);
    } catch (err) {
      console.error(err);
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

        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          onSubmit={handleSubmit}
        >
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
            {formData.working_times.map((item, index) => (
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
                { key: "sell_products", label: "จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ" },
                { key: "consulting", label: "ให้คำปรึกษาทางเภสัชกรรม" },
                { key: "wholesale", label: "ขายปลีกและขายส่ง" },
                { key: "delivery", label: "บริการจัดส่งกล่องยาสามัญประจำบ้าน" },
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

          {/* Submit */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            >
              บันทึก
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
