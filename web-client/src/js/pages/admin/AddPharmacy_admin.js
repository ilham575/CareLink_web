import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../db"; // ✅ ใช้ IndexedDB

function AddPharmacy_admin() {
  const navigate = useNavigate();
  const { storeId } = useParams(); // ✅ รับค่า storeId จาก path param

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    license_number: "",
    time_in: "",
    time_out: "",
    phone: "",
    username: "",
    password: "",
    services: {
      sell_products: false,
      consulting: false,
      wholesale: false,
      delivery: false,
    },
    is_primary: false,
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const pharmacist = {
      storeId,
      firstname: formData.firstname,
      lastname: formData.lastname,
      license_number: formData.license_number,
      working_time: `${formData.time_in} - ${formData.time_out}`,
      phone: formData.phone,
      username: formData.username,
      password: formData.password,
      services: formData.services,
      is_primary: formData.is_primary,
    };

    // ✅ บันทึกลง IndexedDB
    await db.pharmacists.add(pharmacist);

    alert(`บันทึกเภสัชกรเรียบร้อย! (ร้าน ${storeId})`);
    navigate("/adminhome");
  };

  return (
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

        <div>
          <label className="block font-semibold mb-1">
            เลขที่ใบอนุญาตประกอบวิชาชีพเภสัชกรรม*
          </label>
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
          <label className="block font-semibold mb-1">เบอร์โทรศัพท์เภสัชกร*</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          />
        </div>

        {/* เวลาทำการ */}
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

        {/* Services */}
        <div className="md:col-span-2">
          <label className="block font-semibold mb-1">การให้บริการ*</label>
          <div className="space-y-10 p-10 bg-gray-100 rounded">
            <label className="block">
              <input
                type="checkbox"
                name="sell_products"
                checked={formData.services.sell_products}
                onChange={handleChange}
              />{" "}
              จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ
            </label>
            <label className="block">
              <input
                type="checkbox"
                name="consulting"
                checked={formData.services.consulting}
                onChange={handleChange}
              />{" "}
              ให้คำปรึกษาทางเภสัชกรรม
            </label>
            <label className="block">
              <input
                type="checkbox"
                name="wholesale"
                checked={formData.services.wholesale}
                onChange={handleChange}
              />{" "}
              ขายปลีกและขายส่ง
            </label>
            <label className="block">
              <input
                type="checkbox"
                name="delivery"
                checked={formData.services.delivery}
                onChange={handleChange}
              />{" "}
              บริการจัดส่งกล่องยาสามัญประจำบ้าน
            </label>
          </div>
        </div>

        {/* Primary pharmacist */}
        <div className="md:col-span-2">
          <label>
            <input
              type="checkbox"
              name="is_primary"
              checked={formData.is_primary}
              onChange={handleChange}
            />{" "}
            เป็นเภสัชกรประจำร้านนี้
          </label>
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
  );
}

export default AddPharmacy_admin;
