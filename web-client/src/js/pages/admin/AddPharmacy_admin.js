import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../db";

function AddPharmacyAdmin() {
  const navigate = useNavigate();
  const { storeId } = useParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pharmacist management state
  const [mode, setMode] = useState("new");
  const [allPharmacists, setAllPharmacists] = useState([]);
  const [selectedPharmacistId, setSelectedPharmacistId] = useState(null);
  const [selectedPharmacist, setSelectedPharmacist] = useState(null);

  const [formData, setFormData] = useState({
    // Store data
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
    // Pharmacist data
    firstname: "",
    lastname: "",
    phone: "",
    time_in: "",
    time_out: "",
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

  // Load existing pharmacists
  useEffect(() => {
    const load = async () => {
      const list = await db.pharmacists.toArray();
      setAllPharmacists(list);
    };
    load();
  }, []);

  // Load selected pharmacist data
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
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      if (name.startsWith("services.") || name in formData.services) {
        const serviceName = name.replace("services.", "");
        setFormData({
          ...formData,
          services: { ...formData.services, [serviceName]: checked }
        });
      } else {
        setFormData({ ...formData, [name]: checked });
      }
    } else if (type === "file") {
      const file = files[0];
      if (file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          alert(`ไฟล์ ${file.name} ไม่ใช่รูปภาพที่ถูกต้อง\nรองรับเฉพาะ: JPEG, PNG, GIF, WebP`);
          e.target.value = '';
          return;
        }
        
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          alert(`ไฟล์ ${file.name} มีขนาดใหญ่เกินไป\nขนาดสูงสุด: 10MB\nขนาดไฟล์ปัจจุบัน: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
          e.target.value = '';
          return;
        }
      }
      setFormData({ ...formData, [name]: file });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) {
      console.log("กำลัง submit อยู่แล้ว ไม่สามารถ submit ซ้ำได้");
      return;
    }
    
    setIsSubmitting(true);

    try {
      if (step === 2) {
        // Step 2: Create pharmacy store
        const token = localStorage.getItem("jwt");
        if (!token) {
          throw new Error("ไม่พบ token การยืนยันตัวตน กรุณาเข้าสู่ระบบใหม่");
        }
        
        if (!formData.name_th || !formData.license_number || !formData.address || !formData.phone_store) {
          throw new Error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        }
        
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
        const newStoreId = createdStore.data.id;

        // Upload images
        const imageFields = [
          { field: 'photo_front', file: formData.photo_front, displayName: 'รูปด้านหน้าร้าน' },
          { field: 'photo_in', file: formData.photo_in, displayName: 'รูปด้านในร้าน' },
          { field: 'photo_staff', file: formData.photo_staff, displayName: 'รูปเภสัชกรและพนักงาน' }
        ];

        let uploadErrors = [];

        for (const { field, file, displayName } of imageFields) {
          if (file) {
            try {
              const formDataImg = new FormData();
              formDataImg.append('files', file);
              formDataImg.append('ref', 'api::drug-store.drug-store');
              formDataImg.append('refId', newStoreId.toString());
              formDataImg.append('field', field);

              const uploadRes = await fetch("http://localhost:1337/api/upload", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
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

        // Store the created store ID for pharmacist assignment
        setFormData({ ...formData, storeId: newStoreId });
        
        if (uploadErrors.length > 0) {
          alert(`บันทึกร้านยาสำเร็จ!\n\nแต่มีปัญหาในการอัพโหลดรูปภาพ:\n${uploadErrors.join('\n')}`);
        }
        
        setStep(3); // Move to pharmacist step
      } else if (step === 3) {
        // Step 3: Handle pharmacist
        const currentStoreId = formData.storeId || storeId;
        
        if (mode === "new") {
          const pharmacist = {
            storeIds: [currentStoreId],
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
          alert(`บันทึกเภสัชกรใหม่เรียบร้อย! (ร้าน ${currentStoreId})`);
        } else {
          const pharmacist = await db.pharmacists.get(Number(selectedPharmacistId));
          const newStores = pharmacist.storeIds
            ? [...new Set([...pharmacist.storeIds, currentStoreId])]
            : [currentStoreId];
          await db.pharmacists.update(pharmacist.id, { storeIds: newStores });
          alert(`เพิ่มเภสัชกรเดิมเข้าร้าน ${currentStoreId} เรียบร้อย!`);
        }

        navigate("/adminhome");
      }
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
              {isSubmitting ? "กำลังบันทึก..." : "สร้างร้านยา"}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <>
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

            <div className="md:col-span-2 flex justify-between">
              <button
                type="button"
                className="bg-gray-500 text-white font-bold py-2 px-6 rounded hover:bg-gray-600"
                onClick={handleBack}
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกเภสัชกร"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default AddPharmacyAdmin;