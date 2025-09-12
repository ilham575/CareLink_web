import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../db"; // ✅ ใช้ IndexedDB

function EditStore_admin() {
  const navigate = useNavigate();
  const { id } = useParams();
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

  // ✅ โหลดข้อมูลร้านจาก IndexedDB
  useEffect(() => {
    const loadData = async () => {
      const store = await db.pharmacies.get(Number(id));
      if (store) {
        setFormData({
          ...store,
          photo_front: store.photo_front || null,
          photo_in: store.photo_in || null,
          photo_staff: store.photo_staff || null,
          photo_front_preview: null,
          photo_in_preview: null,
          photo_staff_preview: null,
          services: {
            sell_products: store.services?.sell_products || false,
            consulting: store.services?.consulting || false,
            health_check: store.services?.health_check || false,
            delivery: store.services?.delivery || false,
          },
          confirm: false,
        });
      }
    };
    loadData();
  }, [id]);

  // ✅ handleChange รองรับ preview
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
        const previewUrl = URL.createObjectURL(files[0]);
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
    const photoFrontBase64 =
      formData.photo_front instanceof File
        ? await fileToBase64(formData.photo_front)
        : formData.photo_front;
    const photoInBase64 =
      formData.photo_in instanceof File
        ? await fileToBase64(formData.photo_in)
        : formData.photo_in;
    const photoStaffBase64 =
      formData.photo_staff instanceof File
        ? await fileToBase64(formData.photo_staff)
        : formData.photo_staff;

    const updatedPharmacy = {
      ...formData,
      id: Number(id),
      photo_front: photoFrontBase64,
      photo_in: photoInBase64,
      photo_staff: photoStaffBase64,
    };

    await db.pharmacies.put(updatedPharmacy);
    alert("แก้ไขข้อมูลร้านขายยาเรียบร้อย!");
    navigate("/adminhome");
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-blue-700">
        แก้ไขร้านขายยา
      </h2>

      {step === 1 && (
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ชื่อร้าน (ไทย) */}
          <div>
            <label className="block font-semibold mb-1">
              ชื่อร้านยา (ภาษาไทย)*
            </label>
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
            <label className="block font-semibold mb-1">
              ชื่อร้านยา (ภาษาอังกฤษ)
            </label>
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
            <label className="block font-semibold mb-1">
              เลขทะเบียนร้านยา*
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

          {/* เอกสาร */}
          <div>
            <label className="block font-semibold mb-1">
              ใบอนุญาต/เอกสารประกอบ*
            </label>
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
            <label className="block font-semibold mb-1">
              เบอร์โทรศัพท์ร้านยา*
            </label>
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
            <label className="block font-semibold mb-1">
              เวลาเปิดทำการ*
            </label>
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
            <label className="block font-semibold mb-1">
              เวลาปิดทำการ*
            </label>
            <input
              type="time"
              name="time_close"
              value={formData.time_close}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Google Map */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">
              Link Google Map*
            </label>
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
                  name="health_check"
                  checked={formData.services.health_check}
                  onChange={handleChange}
                />
                <span>ตรวจสุขภาพเบื้องต้น</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="delivery"
                  checked={formData.services.delivery}
                  onChange={handleChange}
                />
                <span>บริการจัดส่งยา/เวชภัณฑ์</span>
              </label>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700"
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
            {/* รูปด้านหน้า */}
            <div>
              <label className="block font-semibold mb-1">รูปด้านหน้าร้านยา*</label>
              {formData.photo_front_preview ? (
                <img
                  src={formData.photo_front_preview}
                  alt="preview_front"
                  className="w-40 h-40 object-cover rounded mb-2"
                />
              ) : (
                formData.photo_front &&
                typeof formData.photo_front === "string" && (
                  <img
                    src={formData.photo_front}
                    alt="photo_front"
                    className="w-40 h-40 object-cover rounded mb-2"
                  />
                )
              )}
              <input type="file" name="photo_front" onChange={handleChange} className="w-full" />
            </div>

            {/* รูปด้านใน */}
            <div>
              <label className="block font-semibold mb-1">รูปด้านในร้านยา*</label>
              {formData.photo_in_preview ? (
                <img
                  src={formData.photo_in_preview}
                  alt="preview_in"
                  className="w-40 h-40 object-cover rounded mb-2"
                />
              ) : (
                formData.photo_in &&
                typeof formData.photo_in === "string" && (
                  <img
                    src={formData.photo_in}
                    alt="photo_in"
                    className="w-40 h-40 object-cover rounded mb-2"
                  />
                )
              )}
              <input type="file" name="photo_in" onChange={handleChange} className="w-full" />
            </div>

            {/* รูปเภสัชกร */}
            <div>
              <label className="block font-semibold mb-1">รูปเภสัชกรและพนักงาน*</label>
              {formData.photo_staff_preview ? (
                <img
                  src={formData.photo_staff_preview}
                  alt="preview_staff"
                  className="w-40 h-40 object-cover rounded mb-2"
                />
              ) : (
                formData.photo_staff &&
                typeof formData.photo_staff === "string" && (
                  <img
                    src={formData.photo_staff}
                    alt="photo_staff"
                    className="w-40 h-40 object-cover rounded mb-2"
                  />
                )
              )}
              <input type="file" name="photo_staff" onChange={handleChange} className="w-full" />
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
                formData.confirm
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!formData.confirm}
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default EditStore_admin;
