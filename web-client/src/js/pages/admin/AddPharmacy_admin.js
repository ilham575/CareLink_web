import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/HomeHeader";
import Footer from "../../components/footer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AddPharmacist_admin() {
  const navigate = useNavigate();
  const { storeId } = useParams(); // documentId ของร้าน
  const jwt = localStorage.getItem("jwt");

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    license_number: "",
    time_in: "",
    time_out: "",
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
    // is_primary: false, // ❌ ปิดการใช้งานไปก่อน
  });

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setFormData({
        ...formData,
        services: { ...formData.services, [name]: checked },
      });
    } else if (type === "file") {
      setFormData({ ...formData, profileImage: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!jwt) {
      toast.error("กรุณาเข้าสู่ระบบใหม่");
      navigate("/login");
      return;
    }

    try {
      // ✅ 1. สมัคร User
      const userRes = await fetch("http://localhost:1337/api/auth/local/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: `${formData.username}@mail.com`,
          password: formData.password,
        }),
      });

      if (!userRes.ok) {
        const error = await userRes.json();
        throw new Error(error.error?.message || "สร้าง User ไม่สำเร็จ");
      }

      const userData = await userRes.json();

      // ✅ 2. หา role pharmacist
      const roleRes = await fetch("http://localhost:1337/api/users-permissions/roles", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const roleData = await roleRes.json();
      const pharmacistRole = roleData.roles.find((r) => r.name === "pharmacy");
      if (!pharmacistRole) throw new Error("ไม่พบ role pharmacist");

      // ✅ 2.1 อัปเดต User (เพิ่ม full_name, phone, role)
      await fetch(`http://localhost:1337/api/users/${userData.user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`, // ต้องเป็น admin jwt
        },
        body: JSON.stringify({
          full_name: `${formData.firstname} ${formData.lastname}`,
          phone: formData.phone,
          role: pharmacistRole.id, // เพิ่ม role เหมือน formStaffPage
        }),
      });

      // ✅ 3. อัปโหลดรูปถ้ามี
      let uploadedImageId = null;
      if (formData.profileImage) {
        const imageForm = new FormData();
        imageForm.append("files", formData.profileImage);

        const uploadRes = await fetch("http://localhost:1337/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
          body: imageForm,
        });

        if (!uploadRes.ok) {
          throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");
        }

        const uploadData = await uploadRes.json();
        uploadedImageId = uploadData[0].id;
      }

      // ✅ 4. สร้าง Pharmacy Profile
      const payload = {
        data: {
          license_number: formData.license_number,
          working_time: `${formData.time_in} - ${formData.time_out}`,
          services: formData.services,
          drug_stores: [storeId],
          users_permissions_user: userData.user.id,
          profileimage: uploadedImageId ? [uploadedImageId] : [],
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
        <h2 className="text-2xl font-bold text-green-700 mb-4">
          เพิ่มเภสัชกรประจำร้านขายยา
        </h2>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
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

          <div className="md:col-span-2">
            <label className="block font-semibold mb-2">รูปภาพโปรไฟล์</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="w-full"
            />
          </div>

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
