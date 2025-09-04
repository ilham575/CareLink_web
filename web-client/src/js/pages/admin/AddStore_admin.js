import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../db"; // ✅ ใช้ IndexedDB

function AddStore_admin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name_th: "",
    name_en: "",
    license_number: "",
    license_doc: "",
    address: "",
    phone_store: "",
    time_open: "",
    link_gps: "",
    type: "",
    photo_front: null,
    photo_in: null,
    photo_staff: null,
    confirm: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked });
    } else if (type === "file") {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleNext = () => setStep(2);
  const handleBack = () => setStep(1);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const photoFrontBase64 = formData.photo_front ? await fileToBase64(formData.photo_front) : null;
    const photoInBase64 = formData.photo_in ? await fileToBase64(formData.photo_in) : null;
    const photoStaffBase64 = formData.photo_staff ? await fileToBase64(formData.photo_staff) : null;

    const mockPharmacy = {
      name_th: formData.name_th,
      name_en: formData.name_en,
      license_number: formData.license_number,
      license_doc: formData.license_doc,
      address: formData.address,
      phone_store: formData.phone_store,
      time_open: formData.time_open,
      time_close: "20:00",
      link_gps: formData.link_gps,
      type: formData.type,
      photo_front: photoFrontBase64,
      photo_in: photoInBase64,
      photo_staff: photoStaffBase64,
    };

    // ✅ บันทึกลง IndexedDB
    await db.pharmacies.add(mockPharmacy);

    alert("บันทึกร้านขายยาเรียบร้อย!");
    navigate("/adminhome");
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-green-700">เพิ่มร้านขายยา</h2>

      {step === 1 && (
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block font-semibold mb-1">ชื่อร้านยา (ภาษาไทย)*</label>
            <input
              type="text"
              name="name_th"
              value={formData.name_th}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">ชื่อร้านยา (ภาษาอังกฤษ)</label>
            <input
              type="text"
              name="name_en"
              value={formData.name_en}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">เลขทะเบียนร้านยา*</label>
            <input
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">ใบอนุญาต/เอกสารประกอบ*</label>
            <input
              type="text"
              name="license_doc"
              value={formData.license_doc}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">ที่อยู่ร้านยา*</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full border rounded p-2"
            ></textarea>
          </div>
          <div>
            <label className="block font-semibold mb-1">เบอร์โทรศัพท์ร้านยา*</label>
            <input
              type="text"
              name="phone_store"
              value={formData.phone_store}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">เวลาเปิดทำการ*</label>
            <input
              type="time"
              name="time_open"
              value={formData.time_open}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">Link Google Map*</label>
            <input
              type="text"
              name="link_gps"
              value={formData.link_gps}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">ประเภทร้านยา*</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full border rounded p-2"
            >
              <option value="">-- เลือกประเภท --</option>
              <option value="type1">ร้านขายยาแผนปัจจุบัน ประเภทที่ 1</option>
              <option value="type2">ร้านขายยาแผนปัจจุบัน ประเภทที่ 2</option>
              <option value="type3">ร้านขายยาแผนโบราณ</option>
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              className="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700"
              onClick={handleNext}
            >
              ถัดไป
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block font-semibold mb-1">รูปด้านหน้าร้านยา*</label>
              <input type="file" name="photo_front" onChange={handleChange} className="w-full" />
            </div>
            <div>
              <label className="block font-semibold mb-1">รูปด้านในร้านยา*</label>
              <input type="file" name="photo_in" onChange={handleChange} className="w-full" />
            </div>
            <div>
              <label className="block font-semibold mb-1">รูปเภสัชกรและพนักงาน*</label>
              <input type="file" name="photo_staff" onChange={handleChange} className="w-full" />
            </div>
          </div>

          <div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                name="confirm"
                checked={formData.confirm}
                onChange={handleChange}
                className="mr-2"
              />
              ข้าพเจ้ายอมรับและตรวจสอบครบถ้วนแล้วว่าข้อมูลทั้งหมดถูกต้อง
            </label>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              className="bg-gray-500 text-white font-bold py-2 px-6 rounded hover:bg-gray-600"
              onClick={handleBack}
            >
              ย้อนกลับ
            </button>
            <button
              type="submit"
              className={`py-2 px-6 rounded font-bold ${
                formData.confirm
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!formData.confirm}
            >
              บันทึก
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default AddStore_admin;
