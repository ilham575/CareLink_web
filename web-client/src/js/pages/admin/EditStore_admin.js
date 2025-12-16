import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate, useParams } from "react-router-dom";
import HomeHeader from "../../components/HomeHeader";
import Footer from "../../components/footer";
import { API } from "../../../utils/apiConfig";

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

  // ถ้าเป็น string โดยตรง (URL)
  if (typeof photo === "string") return photo;

  // ใช้ documentId บังคับสำหรับการดึงรูปผ่าน custom endpoint
  if (photo.documentId) {
    return `${API.BASE_URL}/api/upload/files/${photo.documentId}/serve`;
  }

  // สำหรับกรณีที่มี attributes (Strapi v4 style)
  if (photo.attributes) {
    if (photo.attributes.documentId) {
      return `${API.BASE_URL}/api/upload/files/${photo.attributes.documentId}/serve`;
    }
    if (photo.attributes.url) {
      return photo.attributes.url.startsWith('http') ? photo.attributes.url : `${API.BASE_URL}${photo.attributes.url}`;
    }
  }

  // สำหรับกรณีที่มี url โดยตรง
  if (photo.url) {
    return photo.url.startsWith('http') ? photo.url : `${API.BASE_URL}${photo.url}`;
  }

  // Fallback สำหรับข้อมูลเก่า
  if (photo.formats?.large?.url) return photo.formats.large.url;
  if (photo.formats?.medium?.url) return photo.formats.medium.url;
  if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;

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
  });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapData, setMapData] = useState({
    name: '',
    latitude: '',
    longitude: ''
  });
  const [storeId, setStoreId] = useState(null); // numeric Strapi id

  const jwt = localStorage.getItem("jwt");

  // ✅ โหลดข้อมูลร้านจาก Strapi
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Validate documentId before making requests
        if (!documentId || documentId === 'undefined' || documentId === 'null') {
          throw new Error('Invalid document ID');
        }

        // Try to fetch by documentId first
        let res = await fetch(
          `${API.BASE_URL}/api/drug-stores?filters[documentId][$eq]=${documentId}&populate[0]=photo_front&populate[1]=photo_in&populate[2]=photo_staff`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );

        let data = await res.json();
        let store = data.data?.[0];

        // If not found by documentId and documentId is a valid integer, try by regular id
        if (!store && !isNaN(parseInt(documentId)) && parseInt(documentId) > 0) {
          res = await fetch(
            `${API.BASE_URL}/api/drug-stores/${documentId}?populate[0]=photo_front&populate[1]=photo_in&populate[2]=photo_staff`,
            {
              headers: { Authorization: `Bearer ${jwt}` },
            }
          );
          
          if (res.ok) {
            data = await res.json();
            store = data.data; // single entity shape
          }
        }

        if (!res.ok || !store) {
          throw new Error("โหลดข้อมูลร้านไม่สำเร็จ");
        }

        // Extract attributes if nested
        const storeData = store.attributes || store;

        // Save numeric Strapi id for update/publish actions
        const numericId = store.id || (storeData && storeData.id) || null;
        setStoreId(numericId);

        setFormData({
          name_th: storeData.name_th || "",
          name_en: storeData.name_en || "",
          license_number: storeData.license_number || "",
          license_doc: storeData.license_doc || "",
          address: storeData.address || "",
          phone_store: storeData.phone_store || "",
          time_open: storeData.time_open ? storeData.time_open.substring(0, 5) : "",
          time_close: storeData.time_close ? storeData.time_close.substring(0, 5) : "",
          link_gps: storeData.link_gps || "",
          type: storeData.type || "",
          photo_front: storeData.photo_front?.data?.id || storeData.photo_front?.id || null,
          photo_front_preview: getImageUrl(storeData.photo_front?.data || storeData.photo_front),
          photo_in: storeData.photo_in?.data?.id || storeData.photo_in?.id || null,
          photo_in_preview: getImageUrl(storeData.photo_in?.data || storeData.photo_in),
          photo_staff: storeData.photo_staff?.data?.id || storeData.photo_staff?.id || null,
          photo_staff_preview: getImageUrl(storeData.photo_staff?.data || storeData.photo_staff),
          services: { ...defaultServices, ...(storeData.services || {}) },
          confirm: false,
        });
      } catch (err) {
        console.error('Fetch error:', err);
        toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูลร้าน: " + err.message);
        navigate(-1);
      }
    };

    if (documentId) {
      fetchData();
    }
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

  // ฟังก์ชันเปิด Google Map Picker
  const openMapPicker = () => {
    setShowMapPicker(true);
  };

  // ฟังก์ชันปิด Google Map Picker
  const closeMapPicker = () => {
    setShowMapPicker(false);
  };

  // ฟังก์ชันเซ็ต Google Map Link
  const setMapLink = () => {
    if (mapData.latitude && mapData.longitude) {
      // ใช้ query parameter format เพื่อให้ปักหมุดที่พิกัดที่ต้องการ
      const gpsLink = `https://www.google.com/maps/search/${mapData.latitude}+${mapData.longitude}/@${mapData.latitude},${mapData.longitude},18z`;
      setFormData({ ...formData, link_gps: gpsLink });
      closeMapPicker();
      toast.success('บันทึกพิกัดร้านยาเรียบร้อยแล้ว!');
    } else {
      toast.error('กรุณากำหนดพิกัดร้านยา');
    }
  };

  // ฟังก์ชันรับพิกัดจาก Geolocation API ของเครื่อง
  const getLocationFromDevice = () => {
    if (!navigator.geolocation) {
      toast.error('เบราว์เซอร์ของคุณไม่รองรับการหาพิกัด');
      return;
    }

    toast.info('กำลังค้นหาพิกัด... (กรุณายอมรับการขออนุญาต)', { autoClose: false });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapData({
          ...mapData,
          latitude: latitude.toFixed(4),
          longitude: longitude.toFixed(4),
          name: `พิกัดปัจจุบัน (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
        });
        toast.dismiss();
        toast.success(`✓ พบพิกัด: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      (error) => {
        toast.dismiss();
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('คุณปฏิเสธการเข้าถึงพิกัด กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error('ไม่สามารถหาพิกัดได้ โปรดลองใหม่');
        } else if (error.code === error.TIMEOUT) {
          toast.error('หมดเวลาการหาพิกัด กรุณาลองใหม่');
        } else {
          toast.error('เกิดข้อผิดพลาดในการหาพิกัด');
        }
      }
    );
  };

  // ✅ อัพโหลดรูปไป Strapi
  const uploadImageToStrapi = async (file) => {
    const uploadData = new FormData();
    uploadData.append("files", file);

    const res = await fetch(API.upload(), {
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
      // Validate documentId before making requests
      if (!documentId || documentId === 'undefined' || documentId === 'null') {
        throw new Error('Invalid document ID');
      }

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

          publishedAt: new Date().toISOString(),
        },
      };

      // Prefer numeric storeId for the update endpoint
      const targetId = storeId || documentId;
      const res = await fetch(
        API.drugStores.update(targetId),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        // Try to extract backend error message
        let errorMsg = "อัปเดตร้านไม่สำเร็จ";
        try {
          const errorData = await res.json();
          if (errorData && errorData.error && errorData.error.message) {
            errorMsg += `: ${errorData.error.message}`;
          }
        } catch (_) {
          // ignore JSON parse errors
        }
        throw new Error(errorMsg);
      }
      await res.json();

      toast.success("แก้ไขข้อมูลร้านเรียบร้อย!");
      const role = localStorage.getItem('role');
      if (role === 'pharmacy') {
        navigate(`/drug_store_pharmacy/${documentId}`);
      } else {
        navigate(`/drug_store_admin/${documentId}`);
        // หรือใช้ window.location.reload(); ถ้า navigate แล้วข้อมูลยังไม่ใหม่
      }
    } catch (err) {
      console.error(err);
      toast.error("เกิดข้อผิดพลาด: " + err.message);
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
              <div className="flex gap-2">
                <input
                  type="text"
                  name="link_gps"
                  value={formData.link_gps}
                  onChange={handleChange}
                  className="flex-1 border rounded p-2"
                  placeholder="https://www.google.com/maps/search/lat+lng/@lat,lng,18z"
                  required
                />
                <button
                  type="button"
                  onClick={openMapPicker}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap"
                  title="เลือกสถานที่จาก Google Maps"
                >
                  📍 เลือก
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                หรือคลิกปุ่ม "เลือก" เพื่อเปลี่ยนสถานที่
              </p>
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
                onClick={() => {
                  const role = localStorage.getItem('role');
                  if (role === 'pharmacy') {
                    navigate(`/drug_store_pharmacy/${documentId}`);
                  } else {
                    navigate(`/drug_store_admin/${documentId}`);
                  }
                }}
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

      {/* Google Map Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold">เลือกสถานที่ร้านยา</h2>
              <button
                onClick={closeMapPicker}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4 flex flex-col gap-4">
              {/* ส่วนหาพิกัดจากเครื่อง */}
              <div className="border rounded p-4 bg-yellow-50">
                <h3 className="font-semibold mb-3 text-amber-900">📍 วิธี 0: ใช้พิกัดจากเครื่องของคุณ (ด่วนที่สุด)</h3>
                <button
                  type="button"
                  onClick={getLocationFromDevice}
                  className="w-full px-4 py-3 bg-amber-500 text-white rounded hover:bg-amber-600 font-semibold flex items-center justify-center gap-2"
                >
                  🎯 ค้นหาพิกัดปัจจุบัน
                </button>
                <p className="text-xs text-amber-700 mt-2">
                  💡 กดปุ่มนี้เพื่อให้ระบบหาพิกัดของตำแหน่งปัจจุบันของคุณ (ต้องอนุญาตในเบราว์เซอร์)
                </p>
              </div>

              {/* ส่วนใส่พิกัด */}
              <div className="border rounded p-4 bg-gray-50">
                <h3 className="font-semibold mb-3">วิธี 1: ใส่พิกัดโดยตรง (ทั้ง 2 ช่อง)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">ละติจูด (Latitude)</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="13.7563"
                      value={mapData.latitude}
                      onChange={(e) => setMapData({...mapData, latitude: e.target.value})}
                      className="w-full border rounded p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ลองจิจูด (Longitude)</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="100.4925"
                      value={mapData.longitude}
                      onChange={(e) => setMapData({...mapData, longitude: e.target.value})}
                      className="w-full border rounded p-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* ส่วนใส่ชื่อสถานที่ */}
              <div className="border rounded p-4 bg-gray-50">
                <h3 className="font-semibold mb-3">วิธี 2: ค้นหาชื่อสถานที่</h3>
                <input
                  type="text"
                  placeholder="ใส่ชื่อร้านยา หรือที่อยู่ (เช่น 'ร้านยาสวัสดิ์ บางนา')"
                  value={mapData.name}
                  onChange={(e) => setMapData({...mapData, name: e.target.value})}
                  className="w-full border rounded p-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  💡 ทำการค้นหา Google Maps จากชื่อ แล้วสำเร็จรูป URL จากการค้นหา
                </p>
              </div>

              {/* ส่วนสาธิตการใช้ */}
              <div className="border rounded p-4 bg-blue-50">
                <h3 className="font-semibold mb-2 text-blue-900">📌 วิธีการหาพิกัด:</h3>
                <ol className="text-sm text-blue-900 list-decimal list-inside space-y-1">
                  <li>เปิด <strong>Google Maps</strong> ใน browser</li>
                  <li>ค้นหาชื่อร้านยา หรือปักหมุดตำแหน่ง</li>
                  <li>กดเลือก <strong>แชร์</strong> → คัดลอก URL</li>
                  <li>หรือดูแถบ address bar ที่มี <code>@lat,lng</code></li>
                  <li>ใส่ละติจูด กับ ลองจิจูด ด้านบน</li>
                </ol>
              </div>

              {/* แสดงตัวอย่าง */}
              {mapData.latitude && mapData.longitude && (
                <div className="border rounded p-4 bg-green-50">
                  <p className="text-sm font-semibold text-green-900">✅ URL ที่สร้างจาก:</p>
                  <code className="text-xs bg-white border rounded p-2 block mt-2 break-all">
                    https://www.google.com/maps/search/{mapData.latitude}+{mapData.longitude}/@{mapData.latitude},{mapData.longitude},18z
                  </code>
                </div>
              )}
            </div>

            <div className="border-t px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={closeMapPicker}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={setMapLink}
                disabled={!mapData.latitude || !mapData.longitude}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ✓ บันทึกพิกัด
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default EditStore_admin;
