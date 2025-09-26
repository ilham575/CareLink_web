import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import HomeHeader from "../../components/HomeHeader";
import Footer from "../../components/footer";

// ✅ default service keys
const defaultServices = {
  sell_products: false,
  consulting: false,
  health_check: false,
  delivery: false,
};

// ✅ helper แปลงเวลา
const formatTime = (time) => {
  if (!time) return null;
  return `${time}:00.000`;
};

// ✅ helper ดึง url รูป
const getImageUrl = (photo) => {
  if (!photo) return null;
  if (typeof photo === "string") return photo;
  if (photo.url) {
    return `${process.env.REACT_APP_API_URL || "http://localhost:1337"}${photo.url}`;
  }
  return null;
};

function EditStore_admin() {
  const navigate = useNavigate();
  const { id: documentId } = useParams(); // ✅ documentId ของ drug-store
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    services: defaultServices,
    confirm: false,
  });

  const jwt = localStorage.getItem("jwt");

  // ✅ โหลดข้อมูลร้านจาก Strapi
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${documentId}&populate=*`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );

        if (!res.ok) throw new Error("โหลดข้อมูลร้านไม่สำเร็จ");
        const data = await res.json();
        const store = data.data[0];

        if (!store) {
          alert("ไม่พบร้านนี้ หรือคุณไม่มีสิทธิ์เข้าถึง");
          navigate(-1);
          return;
        }

        setFormData({
          name_th: store.name_th || "",
          name_en: store.name_en || "",
          license_number: store.license_number || "",
          license_doc: store.license_doc || "",
          address: store.address || "",
          phone_store: store.phone_store || "",
          time_open: store.time_open ? store.time_open.substring(0, 5) : "",
          time_close: store.time_close ? store.time_close.substring(0, 5) : "",
          link_gps: store.link_gps || "",
          type: store.type || "",
          photo_front: store.photo_front?.id || null,
          photo_front_preview: getImageUrl(store.photo_front),
          photo_in: store.photo_in?.id || null,
          photo_in_preview: getImageUrl(store.photo_in),
          photo_staff: store.photo_staff?.id || null,
          photo_staff_preview: getImageUrl(store.photo_staff),
          services: { ...defaultServices, ...(store.services || {}) },
          confirm: false,
        });
      } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการโหลดข้อมูลร้าน");
        navigate(-1);
      }
    };

    fetchData();
  }, [documentId, jwt, navigate]);

  // ✅ handleChange
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
        setFormData({
          ...formData,
          [name]: files[0],
          [`${name}_preview`]: previewUrl,
        });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // ✅ อัพโหลดรูปไป Strapi
  const uploadImageToStrapi = async (file) => {
    const uploadData = new FormData();
    uploadData.append("files", file);

    const res = await fetch("http://localhost:1337/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: uploadData,
    });

    if (!res.ok) throw new Error("อัพโหลดรูปไม่สำเร็จ");
    const data = await res.json();
    return data[0].id;
  };

  // ✅ บันทึกข้อมูลแก้ไข
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let photoFrontId = formData.photo_front;
      let photoInId = formData.photo_in;
      let photoStaffId = formData.photo_staff;

      if (formData.photo_front instanceof File) {
        photoFrontId = await uploadImageToStrapi(formData.photo_front);
      }
      if (formData.photo_in instanceof File) {
        photoInId = await uploadImageToStrapi(formData.photo_in);
      }
      if (formData.photo_staff instanceof File) {
        photoStaffId = await uploadImageToStrapi(formData.photo_staff);
      }

      const payload = {
        data: {
          name_th: formData.name_th,
          name_en: formData.name_en,
          license_number: formData.license_number,
          license_doc: formData.license_doc,
          address: formData.address,
          phone_store: formData.phone_store,
          time_open: formatTime(formData.time_open),
          time_close: formatTime(formData.time_close),
          link_gps: formData.link_gps,
          type: formData.type,
          services: formData.services,
          photo_front: photoFrontId,
          photo_in: photoInId,
          photo_staff: photoStaffId,
        },
      };

      const res = await fetch(
        `http://localhost:1337/api/drug-stores/${documentId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("อัปเดตร้านไม่สำเร็จ");
      await res.json();

      alert("แก้ไขข้อมูลร้านเรียบร้อย!");
      navigate(`/drug_store_admin/${documentId}`); // ✅ กลับไปหน้ารายละเอียดร้าน
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <HomeHeader />
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-700">
          แก้ไขร้านขายยา
        </h2>

        {step === 1 && (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ฟอร์มข้อมูลเหมือน AddStore_admin */}
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
                required
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
                required
              />
            </div>

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

            <div>
              <label className="block font-semibold mb-1">เบอร์โทรศัพท์ร้านยา*</label>
              <input
                type="tel"
                name="phone_store"
                value={formData.phone_store}
                onChange={handleChange}
                className="w-full border rounded p-2"
                required
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
                required
              />
            </div>

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
                {Object.entries(formData.services).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name={key}
                      checked={value}
                      onChange={handleChange}
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-4">
              <button
                type="button"
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                onClick={() => navigate(`/drug_store_admin/${documentId}`)}
              >
                กลับ
              </button>
              <button
                type="button"
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700"
                onClick={() => setStep(2)}
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
                {formData.photo_front_preview && (
                  <img
                    src={formData.photo_front_preview}
                    alt="preview_front"
                    className="w-40 h-40 object-cover rounded mb-2"
                  />
                )}
                <input
                  type="file"
                  name="photo_front"
                  onChange={handleChange}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">รูปด้านในร้านยา*</label>
                {formData.photo_in_preview && (
                  <img
                    src={formData.photo_in_preview}
                    alt="preview_in"
                    className="w-40 h-40 object-cover rounded mb-2"
                  />
                )}
                <input
                  type="file"
                  name="photo_in"
                  onChange={handleChange}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">รูปเภสัชกร*</label>
                {formData.photo_staff_preview && (
                  <img
                    src={formData.photo_staff_preview}
                    alt="preview_staff"
                    className="w-40 h-40 object-cover rounded mb-2"
                  />
                )}
                <input
                  type="file"
                  name="photo_staff"
                  onChange={handleChange}
                  className="w-full"
                />
              </div>
            </div>

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
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                className={`py-2 px-6 rounded font-bold ${
                  formData.confirm && !isSubmitting
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                disabled={!formData.confirm || isSubmitting}
              >
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        )}
      </div>
      <Footer />
    </>
  );
}

export default EditStore_admin;
