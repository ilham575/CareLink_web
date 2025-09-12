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
    time_close: "",
    link_gps: "",
    type: "",
    photo_front: null,
    photo_front_preview: null,
    photo_in: null,
    photo_in_preview: null,
    photo_staff: null,
    photo_staff_preview: null,
    services: {
      sell_products: false,
      consulting: false,
      health_check: false,
      delivery: false,
    },
    confirm: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      if (name in formData.services) {
        setFormData({
          ...formData,
          services: { ...formData.services, [name]: checked },
        });
      } else {
        setFormData({ ...formData, [name]: checked });
      }
    } else if (type === "file") {
      if (files && files[0]) {
        const previewUrl = URL.createObjectURL(files[0]); // ✅ สร้าง preview
        setFormData({ ...formData, [name]: files[0], [`${name}_preview`]: previewUrl });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    const form = e.target.closest("form");
    if (form.checkValidity()) {
      setStep(2);
    } else {
      form.reportValidity();
    }
  };

  const handleBack = () => setStep(1);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

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
      time_close: formData.time_close,
      link_gps: formData.link_gps,
      type: formData.type,
      photo_front: photoFrontBase64,
      photo_in: photoInBase64,
      photo_staff: photoStaffBase64,
      services: formData.services,
    };

    await db.pharmacies.add(mockPharmacy);
    alert("บันทึกร้านขายยาเรียบร้อย!");
    navigate("/adminhome");
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-green-700">เพิ่มร้านขายยา</h2>

      {step === 1 && (
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ชื่อร้าน (ไทย) */}
          <div>
            <label className="block font-semibold mb-1">ชื่อร้านยา (ภาษาไทย)*</label>
            <input
              type="text"
              name="name_th"
              value={formData.name_th}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* ชื่อร้าน (อังกฤษ) */}
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

          {/* เลขทะเบียน */}
          <div>
            <label className="block font-semibold mb-1">เลขทะเบียนร้านยา*</label>
            <input
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* เอกสาร */}
          <div>
            <label className="block font-semibold mb-1">ใบอนุญาต/เอกสารประกอบ*</label>
            <input
              type="text"
              name="license_doc"
              value={formData.license_doc}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* ที่อยู่ */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">ที่อยู่ร้านยา*</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            ></textarea>
          </div>

          {/* เบอร์โทร */}
          <div>
            <label className="block font-semibold mb-1">เบอร์โทรศัพท์ร้านยา*</label>
            <input
              type="tel"
              name="phone_store"
              value={formData.phone_store}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
              pattern="[0-9]+"
              inputMode="numeric"
            />
          </div>

          {/* เวลาเปิด */}
          <div>
            <label className="block font-semibold mb-1">เวลาเปิดทำการ*</label>
            <input
              type="time"
              name="time_open"
              value={formData.time_open}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* เวลาปิด */}
          <div>
            <label className="block font-semibold mb-1">เวลาปิดทำการ*</label>
            <input
              type="time"
              name="time_close"
              value={formData.time_close}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Google map */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">Link Google Map*</label>
            <input
              type="text"
              name="link_gps"
              value={formData.link_gps}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* ประเภทร้าน */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">ประเภทร้านยา*</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            >
              <option value="">-- เลือกประเภท --</option>
              <option value="type1">ร้านขายยาแผนปัจจุบัน ประเภทที่ 1</option>
              <option value="type2">ร้านขายยาแผนปัจจุบัน ประเภทที่ 2</option>
              <option value="type3">ร้านขายยาแผนโบราณ</option>
            </select>
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
                  name="health_check"
                  checked={formData.services.health_check}
                  onChange={handleChange}
                  className="mt-1"
                />
                <span>ตรวจสุขภาพเบื้องต้น</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="delivery"
                  checked={formData.services.delivery}
                  onChange={handleChange}
                  className="mt-1"
                />
                <span>บริการจัดส่งยา/เวชภัณฑ์</span>
              </label>
            </div>
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
            {/* Front */}
            <div>
              <label className="block font-semibold mb-1">รูปด้านหน้าร้านยา*</label>
              {formData.photo_front_preview && (
                <img
                  src={formData.photo_front_preview}
                  alt="preview_front"
                  className="w-40 h-40 object-cover rounded mb-2"
                />
              )}
              <input type="file" name="photo_front" onChange={handleChange} className="w-full" required />
            </div>

            {/* In */}
            <div>
              <label className="block font-semibold mb-1">รูปด้านในร้านยา*</label>
              {formData.photo_in_preview && (
                <img
                  src={formData.photo_in_preview}
                  alt="preview_in"
                  className="w-40 h-40 object-cover rounded mb-2"
                />
              )}
              <input type="file" name="photo_in" onChange={handleChange} className="w-full" required />
            </div>

            {/* Staff */}
            <div>
              <label className="block font-semibold mb-1">รูปเภสัชกรและพนักงาน*</label>
              {formData.photo_staff_preview && (
                <img
                  src={formData.photo_staff_preview}
                  alt="preview_staff"
                  className="w-40 h-40 object-cover rounded mb-2"
                />
              )}
              <input type="file" name="photo_staff" onChange={handleChange} className="w-full" required />
            </div>
          </div>

          {/* ยืนยัน */}
          <div className="flex justify-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="confirm"
                checked={formData.confirm}
                onChange={handleChange}
                className="mt-1"
                required
              />
              <span>ข้าพเจ้ายอมรับและตรวจสอบครบถ้วนแล้วว่าข้อมูลทั้งหมดถูกต้อง</span>
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
                formData.confirm ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
