import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function EditPharmacist_admin() {
  const { id } = useParams(); // id ของเภสัชกร
  const navigate = useNavigate();
  const jwt = localStorage.getItem("jwt");

  const [formData, setFormData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`http://localhost:1337/api/pharmacists/${id}?populate=user,drug_store`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลเภสัชกรได้");

        const data = await res.json();
        const p = data.data?.attributes;

        if (p) {
          const [time_in, time_out] = p.working_time?.split(" - ") || ["", ""];
          setFormData({
            id: data.data.id,
            firstname: p.firstname || "",
            lastname: p.lastname || "",
            license_number: p.license_number || "",
            phone: p.phone || "",
            time_in,
            time_out,
            services: p.services || {
              sell_products: false,
              consulting: false,
              wholesale: false,
              delivery: false,
            },
            is_primary: p.is_primary || false,
            drug_store: p.drug_store?.data?.id || null,
            user: p.user?.data?.id || null,
            username: p.user?.data?.attributes?.username || "",
          });
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      data: {
        firstname: formData.firstname,
        lastname: formData.lastname,
        license_number: formData.license_number,
        phone: formData.phone,
        working_time: `${formData.time_in} - ${formData.time_out}`,
        services: formData.services,
        is_primary: formData.is_primary,
        drug_store: formData.drug_store,
        user: formData.user,
      },
    };

    try {
      const res = await fetch(`http://localhost:1337/api/pharmacists/${id}`, {
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
