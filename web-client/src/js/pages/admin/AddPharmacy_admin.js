import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../db"; // ✅ ใช้ IndexedDB

function AddPharmacy_admin() {
  const navigate = useNavigate();
  const { storeId } = useParams();

  const [mode, setMode] = useState("new"); // new | existing
  const [allPharmacists, setAllPharmacists] = useState([]);
  const [selectedPharmacistId, setSelectedPharmacistId] = useState(null);
  const [selectedPharmacist, setSelectedPharmacist] = useState(null);

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

  // โหลดเภสัชที่มีอยู่แล้ว
  useEffect(() => {
    const load = async () => {
      const list = await db.pharmacists.toArray();
      setAllPharmacists(list);
    };
    load();
  }, []);

  // ถ้ามีการเลือกเภสัชกรเดิม → โหลดข้อมูลมาโชว์
  useEffect(() => {
    const fetchPharmacist = async () => {
      if (!selectedPharmacistId) {
        setSelectedPharmacist(null);
        return;
      }
      const pharmacist = await db.pharmacists.get(Number(selectedPharmacistId));
      setSelectedPharmacist(pharmacist || null);
    };
    fetchPharmacist();
  }, [selectedPharmacistId]);

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

    if (mode === "new") {
      // ✅ เพิ่มเภสัชกรใหม่
      const pharmacist = {
        storeIds: [storeId], // เก็บ array ของร้าน
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
      await db.pharmacists.add(pharmacist);
      alert(`บันทึกเภสัชกรใหม่เรียบร้อย! (ร้าน ${storeId})`);
    } else {
      // ✅ เลือกเภสัชกรเก่า → update storeIds
      const pharmacist = await db.pharmacists.get(Number(selectedPharmacistId));
      const newStores = pharmacist.storeIds
        ? [...new Set([...pharmacist.storeIds, storeId])]
        : [storeId];
      await db.pharmacists.update(pharmacist.id, { storeIds: newStores });
      alert(`เพิ่มเภสัชกรเดิมเข้าร้าน ${storeId} เรียบร้อย!`);
    }

    navigate("/adminhome");
  };

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-green-700 mb-4">
        เพิ่มเภสัชกรประจำร้านขายยา
      </h2>

      {/* ✅ Toggle เลือกโหมด */}
      <div className="flex gap-4 mb-6">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`px-4 py-2 rounded ${
            mode === "new" ? "bg-green-600 text-white" : "bg-gray-200"
          }`}
        >
          เพิ่มเภสัชกรใหม่
        </button>
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`px-4 py-2 rounded ${
            mode === "existing" ? "bg-green-600 text-white" : "bg-gray-200"
          }`}
        >
          เลือกเภสัชกรเดิม
        </button>
      </div>

      <form
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        onSubmit={handleSubmit}
      >
        {mode === "new" ? (
          <>
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
              <label className="block font-semibold mb-1">
                เบอร์โทรศัพท์เภสัชกร*
              </label>
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
              <label className="block font-semibold mb-2">การให้บริการ*</label>
              <div className="space-y-3 p-4 bg-gray-100 rounded">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="sell_products"
                    checked={formData.services.sell_products}
                    onChange={handleChange}
                    className="mt-1"
                  />
                  <span>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="consulting"
                    checked={formData.services.consulting}
                    onChange={handleChange}
                    className="mt-1"
                  />
                  <span>ให้คำปรึกษาทางเภสัชกรรม</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="wholesale"
                    checked={formData.services.wholesale}
                    onChange={handleChange}
                    className="mt-1"
                  />
                  <span>ขายปลีกและขายส่ง</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="delivery"
                    checked={formData.services.delivery}
                    onChange={handleChange}
                    className="mt-1"
                  />
                  <span>บริการจัดส่งกล่องยาสามัญประจำบ้าน</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="is_primary"
                    checked={formData.is_primary}
                    onChange={handleChange}
                    className="mt-1"
                  />
                  <span>เป็นเภสัชกรประจำร้านนี้</span>
                </label>
              </div>
            </div>
          </>
        ) : (
          <div className="md:col-span-2 space-y-4">
            <label className="block font-semibold mb-1">
              เลือกเภสัชกรเดิม*
            </label>
            <select
              value={selectedPharmacistId || ""}
              onChange={(e) => setSelectedPharmacistId(e.target.value)}
              className="w-full border rounded p-2"
              required
            >
              <option value="">-- เลือก --</option>
              {allPharmacists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstname} {p.lastname} (เลขที่ {p.license_number})
                </option>
              ))}
            </select>

            {/* ✅ แสดงข้อมูลเภสัชกรที่เลือก */}
            {selectedPharmacist && (
              <div className="border rounded p-4 bg-gray-50 text-left">
                <p>
                  <span className="font-semibold">ชื่อ-นามสกุล:</span>{" "}
                  {selectedPharmacist.firstname} {selectedPharmacist.lastname}
                </p>
                <p>
                  <span className="font-semibold">เลขที่ใบอนุญาต:</span>{" "}
                  {selectedPharmacist.license_number}
                </p>
                <p>
                  <span className="font-semibold">เบอร์โทร:</span>{" "}
                  {selectedPharmacist.phone}
                </p>
                <p>
                  <span className="font-semibold">เวลาปฏิบัติงาน:</span>{" "}
                  {selectedPharmacist.working_time}
                </p>
                <p>
                  <span className="font-semibold">Username:</span>{" "}
                  {selectedPharmacist.username}
                </p>
                <p>
                  <span className="font-semibold">Password:</span>{" "}
                  {selectedPharmacist.password}
                </p>
                <p className="font-semibold mt-2">การให้บริการ:</p>
                <ul className="list-disc ml-6">
                  {selectedPharmacist.services?.sell_products && (
                    <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>
                  )}
                  {selectedPharmacist.services?.consulting && (
                    <li>ให้คำปรึกษาทางเภสัชกรรม</li>
                  )}
                  {selectedPharmacist.services?.wholesale && (
                    <li>ขายปลีกและขายส่ง</li>
                  )}
                  {selectedPharmacist.services?.delivery && (
                    <li>บริการจัดส่งกล่องยาสามัญประจำบ้าน</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

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
