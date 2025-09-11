import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../db";

function EditPharmacist_admin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    const load = async () => {
      const pharmacist = await db.pharmacists.get(parseInt(id, 10));
      if (pharmacist) {
        const [time_in, time_out] = pharmacist.working_time?.split(" - ") || ["", ""];
        setFormData({
          ...pharmacist,
          time_in,
          time_out,
          services: pharmacist.services || {
            sell_products: false,
            consulting: false,
            wholesale: false,
            delivery: false,
          },
        });
      }
    };
    load();
  }, [id]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updated = {
      ...formData,
      working_time: `${formData.time_in} - ${formData.time_out}`,
    };

    await db.pharmacists.put(updated);
    alert("อัปเดตข้อมูลเภสัชกรเรียบร้อย!");
    navigate(`/pharmacist_detail_admin/${formData.storeId}`);
  };

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-green-700 mb-4">
        แก้ไขข้อมูลเภสัชกร
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

        {/* ✅ เบอร์โทรศัพท์เภสัชกร */}
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
            title="กรุณากรอกเฉพาะตัวเลข"
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
          <div className="space-y-2 p-4 bg-gray-100 rounded">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="sell_products"
                checked={formData.services.sell_products}
                onChange={handleChange}
              />
              <span>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="consulting"
                checked={formData.services.consulting}
                onChange={handleChange}
              />
              <span>ให้คำปรึกษาทางเภสัชกรรม</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="wholesale"
                checked={formData.services.wholesale}
                onChange={handleChange}
              />
              <span>ขายปลีกและขายส่ง</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="delivery"
                checked={formData.services.delivery}
                onChange={handleChange}
              />
              <span>บริการจัดส่งกล่องยาสามัญประจำบ้าน</span>
            </label>
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
