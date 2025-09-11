import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function AddPharmacyAdmin() {
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
    photo_in: null,
    photo_staff: null,
    confirm: false,
  });

  // เพิ่ม state เพื่อป้องกันการ submit ซ้ำ
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked });
    } else if (type === "file") {
      // ตรวจสอบไฟล์ทันทีเมื่อเลือก
      const file = files[0];
      if (file) {
        // ตรวจสอบประเภทไฟล์
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          alert(`ไฟล์ ${file.name} ไม่ใช่รูปภาพที่ถูกต้อง\nรองรับเฉพาะ: JPEG, PNG, GIF, WebP`);
          e.target.value = ''; // ล้างการเลือกไฟล์
          return;
        }
        
        // ตรวจสอบขนาดไฟล์
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          alert(`ไฟล์ ${file.name} มีขนาดใหญ่เกินไป\nขนาดสูงสุด: 10MB\nขนาดไฟล์ปัจจุบัน: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
          e.target.value = ''; // ล้างการเลือกไฟล์
          return;
        }
      }
      setFormData({ ...formData, [name]: file });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleNext = () => setStep(2);
  const handleBack = () => setStep(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ป้องกันการ submit ซ้ำอย่างเข้มงวด
    if (isSubmitting) {
      console.log("กำลัง submit อยู่แล้ว ไม่สามารถ submit ซ้ำได้");
      return;
    }
    
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("jwt");
      if (!token) {
        throw new Error("ไม่พบ token การยืนยันตัวตน กรุณาเข้าสู่ระบบใหม่");
      }
      
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!formData.name_th || !formData.license_number || !formData.address || !formData.phone_store) {
        throw new Error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      }
      
      // Step 1: สร้าง drug-store record ก่อน (ไม่มีรูป)
      const storeData = {
        data: {
          name_th: formData.name_th.trim(),
          name_en: formData.name_en.trim(),
          drug_regiter_no: formData.license_number.trim(),
          drug_business_no: formData.license_doc.trim(),
          address: formData.address.trim(),
          phone_store: formData.phone_store.trim(),
          time_open: formData.time_open ? `${formData.time_open}:00.000` : "08:00:00.000",
          time_close: formData.time_close ? `${formData.time_close}:00.000` : "21:00:00.000",
          link_gps: formData.link_gps.trim(),
          // type: formData.type || "type1", // เพิ่ม type กลับมาพร้อมค่าเริ่มต้น
        }
      };

      const storeRes = await fetch("http://localhost:1337/api/drug-stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(storeData),
      });

      if (!storeRes.ok) {
        const error = await storeRes.json();
        throw new Error(error.error?.message || error.message || "ไม่สามารถสร้างร้านยาได้");
      }

      const createdStore = await storeRes.json();
      const storeId = createdStore.data.id;

      // Step 2: อัพโหลดรูปภาพทีละรูป (เฉพาะที่มีไฟล์)
      const imageFields = [
        { field: 'photo_front', file: formData.photo_front, displayName: 'รูปด้านหน้าร้าน' },
        { field: 'photo_in', file: formData.photo_in, displayName: 'รูปด้านในร้าน' },
        { field: 'photo_staff', file: formData.photo_staff, displayName: 'รูปเภสัชกรและพนักงาน' }
      ];

      let uploadErrors = [];

      for (const { field, file, displayName } of imageFields) {
        if (file) {
          try {
            // ตรวจสอบไฟล์อีกครั้งก่อนอัพโหลด
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
              throw new Error(`${displayName}: ประเภทไฟล์ไม่ถูกต้อง`);
            }

            // สร้าง FormData ใหม่สำหรับแต่ละรูป
            const formDataImg = new FormData();
            formDataImg.append('files', file);
            formDataImg.append('ref', 'api::drug-store.drug-store');
            formDataImg.append('refId', storeId.toString());
            formDataImg.append('field', field);

            const uploadRes = await fetch("http://localhost:1337/api/upload", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                // ไม่ต้องใส่ Content-Type สำหรับ FormData
              },
              body: formDataImg,
            });

            if (!uploadRes.ok) {
              const error = await uploadRes.json();
              uploadErrors.push(`${displayName}: ${error.error?.message || 'ไม่ทราบสาเหตุ'}`);
            }
          } catch (uploadError) {
            uploadErrors.push(`${displayName}: ${uploadError.message || 'เกิดข้อผิดพลาดในการอัพโหลด'}`);
          }
        }
      }

      // แสดงผลลัพธ์
      if (uploadErrors.length > 0) {
        alert(`บันทึกร้านยาสำเร็จ!\n\nแต่มีปัญหาในการอัพโหลดรูปภาพ:\n${uploadErrors.join('\n')}\n\nคุณสามารถแก้ไขรูปภาพได้ในภายหลัง`);
      } else {
        alert("บันทึกร้านขายยาเรียบร้อย!");
      }
      
      // ป้องกันการนำทางซ้ำ
      if (!isSubmitting) return;
      navigate("/adminhome");

    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-green-700">
        เพิ่มร้านขายยา
      </h2>

      {step === 1 && (
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ฟอร์มกรอกข้อมูลร้าน */}
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
          <div>
            <label className="block font-semibold mb-1">เวลาปิดทำการ*</label>
            <input
              type="time"
              name="time_close"
              value={formData.time_close}
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
          {/* อัพโหลดรูป */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block font-semibold mb-1">รูปด้านหน้าร้านยา*</label>
              <input 
                type="file" 
                name="photo_front" 
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleChange} 
                className="w-full" 
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">รูปด้านในร้านยา*</label>
              <input 
                type="file" 
                name="photo_in" 
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleChange} 
                className="w-full" 
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">รูปเภสัชกรและพนักงาน*</label>
              <input 
                type="file" 
                name="photo_staff" 
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleChange} 
                className="w-full" 
              />
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
                formData.confirm && !isSubmitting
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!formData.confirm || isSubmitting}
              style={{ pointerEvents: isSubmitting ? 'none' : 'auto' }}
            >
              {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default AddPharmacyAdmin;
