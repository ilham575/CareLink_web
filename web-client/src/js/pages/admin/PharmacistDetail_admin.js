import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import HomeHeader from "../../components/HomeHeader";
// Footer is rendered globally in App.js
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API } from "../../../utils/apiConfig";

// 🟢 helper function ดึง URL รูปภาพ
function getImageUrl(photoAttr) {
  if (!photoAttr) return null;
  // ใช้ documentId บังคับสำหรับการดึงรูปผ่าน custom endpoint
  if (photoAttr.documentId) {
    return `${API.BASE_URL}/api/upload/files/${photoAttr.documentId}/serve`;
  }
  // Fallback สำหรับข้อมูลเก่า
  if (photoAttr.formats?.medium?.url) return photoAttr.formats.medium.url;
  if (photoAttr.url) return photoAttr.url;
  if (photoAttr.formats?.thumbnail?.url) return photoAttr.formats.thumbnail.url;
  return null;
}

function PharmacistDetail_admin() {
  const { storeId, pharmacistId } = useParams();
  const navigate = useNavigate();
  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacists, setPharmacists] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const fromPage = location.state?.from;

  const jwt = localStorage.getItem("jwt");

  // toast-based confirmation helper returns a Promise<boolean>
  const askConfirm = (message) => {
    return new Promise((resolve) => {
      toast.info(
        ({ closeToast }) => (
          <div>
            <div>{message}</div>
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button
                className="px-3 py-1 rounded bg-red-600 text-white mr-2"
                onClick={() => { closeToast?.(); resolve(true); }}
              >
                ใช่
              </button>
              <button
                className="px-3 py-1 rounded bg-gray-300 text-black"
                onClick={() => { closeToast?.(); resolve(false); }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ),
        { autoClose: false, closeButton: false }
      );
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!jwt) {
          toast.error("กรุณาเข้าสู่ระบบใหม่");
          navigate("/login");
          return;
        }

        // ✅ โหลดข้อมูลร้าน
        const storeRes = await fetch(
          API.drugStores.getByDocumentId(storeId),
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        const storeData = await storeRes.json();
        const store = storeData.data[0];
        if (!store) {
          toast.error("ไม่พบข้อมูลร้านยา");
          navigate(-1);
          return;
        }
        setPharmacy(store);

        // ✅ โหลดข้อมูลเภสัชกร
        let pharmacistRes;
        if (pharmacistId) {
          // Get specific pharmacist by documentId
          pharmacistRes = await fetch(
            `${API.BASE_URL}/api/pharmacy-profiles?filters[documentId][$eq]=${pharmacistId}&populate=*`,
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
        } else {
          // Get all pharmacists for this store
          pharmacistRes = await fetch(
            `${API.BASE_URL}/api/pharmacy-profiles?filters[drug_stores][documentId][$eq]=${storeId}&populate=*`,
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
        }
        const pharmacistData = await pharmacistRes.json();
        setPharmacists(pharmacistData.data || []);
      } catch (err) {
        console.error("โหลดข้อมูลผิดพลาด:", err);
        toast.error("ไม่สามารถโหลดข้อมูลเภสัชกรได้");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [storeId, pharmacistId, jwt, navigate]);

  // ✅ ฟังก์ชันลบเภสัชกร (แก้ไขใหม่) - ไม่ลบ profile ทั้งหมด
  const handleDelete = async (documentId) => {
    const proceed = await askConfirm("คุณต้องการลบเภสัชกรจากร้านนี้หรือไม่?");
    if (!proceed) return;

    try {
      // 1. ดึง pharmacy-profile ที่จะแก้ไข
      const profileRes = await fetch(
        `${API.BASE_URL}/api/pharmacy-profiles?filters[documentId][$eq]=${documentId}&populate=*`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      const profileData = await profileRes.json();
      const profile = profileData.data?.[0];
      
      if (!profile) {
        toast.error("ไม่พบข้อมูลเภสัชกร");
        return;
      }

      const pharmacyProfileDocId = profile.documentId;
      const userId = profile.users_permissions_user?.data?.documentId || 
                    profile.users_permissions_user?.documentId || null;
      
      // 🔧 แก้ไขการเข้าถึง drug_stores - ลองหลายรูปแบบ
      const currentStores = profile.drug_stores?.data || profile.drug_stores || [];

      console.log("=== ข้อมูลที่จะลบ ===");
      console.log("Pharmacy Profile DocumentId:", pharmacyProfileDocId);
      console.log("Document ID:", documentId);
      console.log("User DocumentId:", userId);
      console.log("Store to remove:", storeId);
      console.log("Current stores:", currentStores);
      
      // 🔍 Debug เพิ่มเติม - ดูโครงสร้างข้อมูลทั้งหมด
      console.log("=== DEBUG: โครงสร้างข้อมูล profile ทั้งหมด ===");
      console.log("Full profile object:", profile);
      console.log("profile.drug_stores:", profile.drug_stores);
      console.log("profile.working_time:", profile.working_time);

      // 2. กรอง working_time ให้เหลือเฉพาะของร้านอื่น
      const currentWorkingTime = Array.isArray(profile.working_time) ? profile.working_time : [];
      const filteredWorkingTime = currentWorkingTime.filter(wt => 
        wt.store_id !== storeId && wt.store_id !== parseInt(storeId)
      );

      // 3. กรอง drug_stores ให้เหลือเฉพาะร้านอื่น
      const filteredStores = currentStores.filter(store => {
        const storeDocId = store.documentId || store.attributes?.documentId || store.id;
        console.log(`🔍 Comparing store: ${storeDocId} with target: ${storeId}`);
        return storeDocId !== storeId;
      });

      console.log("=== ข้อมูลหลังกรอง ===");
      console.log("Current working time:", currentWorkingTime);
      console.log("Filtered working time:", filteredWorkingTime);
      console.log("Filtered stores:", filteredStores);

      // 🔍 เพิ่มการตรวจสอบว่ามี working_time ของร้านนี้หรือไม่
      const currentStoreWorkingTime = currentWorkingTime.filter(wt => 
        wt.store_id === storeId || wt.store_id === parseInt(storeId)
      );
      console.log("🔍 Working time ของร้านนี้:", currentStoreWorkingTime);

      // 🟢 เปลี่ยนเงื่อนไข: ไม่ลบ profile ทั้งหมด แค่อัพเดท working_time และ drug_stores เสมอ
      console.log("=== การตัดสินใจ (ใหม่) ===");
      console.log("🟢 ระบบใหม่: ไม่ลบ profile ทั้งหมด แค่อัพเดท working_time และ drug_stores");
      console.log("Working time ที่เหลือหลังลบร้านนี้:", filteredWorkingTime);
      console.log("Stores ที่เหลือหลังลบร้านนี้:", filteredStores);

      // 🟢 เปิดการลบจริง
      console.log("=== เริ่มดำเนินการลบจริง ===");

      // 5. อัพเดท working_time และ drug_stores เท่านั้น (ไม่ลบ profile)
      console.log("กำลังอัพเดท working_time และ drug_stores...");
      
      const storeIds = filteredStores.map(store => {
        return store.documentId || store.attributes?.documentId || store.id;
      });
      
      console.log("Store IDs ที่จะเหลือ:", storeIds);
      
      const updateRes = await fetch(
        API.pharmacyProfiles.update(pharmacyProfileDocId),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            data: {
              working_time: filteredWorkingTime,
              drug_stores: storeIds
            },
          }),
        }
      );

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        throw new Error(`Update failed: ${updateRes.status} - ${errorText}`);
      }
      
      console.log("อัพเดท working_time และ drug_stores สำเร็จ");
      
      if (filteredWorkingTime.length === 0 && filteredStores.length === 0) {
        toast.success("ลบเภสัชกรจากร้านนี้เรียบร้อยแล้ว (profile ว่างเปล่าแต่ยังคงอยู่)");
      } else {
        toast.success("ลบเภสัชกรจากร้านนี้เรียบร้อยแล้ว (profile ยังคงอยู่สำหรับร้านอื่น)");
      }

      // อัพเดท state: ลบเภสัชกรออกจากรายการหน้านี้
      setPharmacists((prev) => prev.filter((p) => p.documentId !== documentId));
      
    } catch (err) {
      console.error("เกิดข้อผิดพลาด:", err);
      toast.error(`เกิดข้อผิดพลาดในการลบ: ${err.message}`);
    }
  };

  if (loading)
    return (
      <>
        <HomeHeader />
        <div className="p-6 text-center">กำลังโหลดข้อมูล...</div>
      </>
    );

  if (!pharmacy) {
    return (
      <>
        <HomeHeader />
        <div className="p-6 text-center">
          <p>ไม่พบข้อมูลร้านยา</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            กลับ
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <HomeHeader pharmacyName={pharmacy.attributes?.name_th || pharmacy.name_th} />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              เภสัชกรประจำร้าน
            </h2>
            <p className="text-slate-500 mt-1">{pharmacy.attributes?.name_th || pharmacy.name_th}</p>
          </div>
          <button
            onClick={() => navigate(`/add_pharmacy_admin/${storeId}`)}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md active:scale-95 w-full sm:w-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            เพิ่มเภสัชกร
          </button>
        </div>

        {/* Pharmacists List */}
        {pharmacists.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">ยังไม่มีข้อมูลเภสัชกร</h3>
            <p className="text-slate-500">คลิกปุ่ม "เพิ่มเภสัชกร" ด้านบนเพื่อเพิ่มข้อมูล</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {pharmacists.map((pharmacist) => {
              const imgUrl = pharmacist.profileimage?.data?.attributes
                ? getImageUrl(pharmacist.profileimage.data.attributes)
                : null;

              return (
                <div
                  key={pharmacist.documentId}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8">
                    {/* Profile Image & Basic Info */}
                    <div className="flex flex-col items-center md:items-start md:w-64 shrink-0">
                      <div className="relative w-32 h-32 mb-4">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt="pharmacist"
                            className="w-full h-full object-cover rounded-2xl shadow-sm border border-slate-100"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
                            <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm">
                          เภสัชกร
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-slate-800 text-center md:text-left w-full">
                        {pharmacist.users_permissions_user?.full_name || "-"}
                      </h3>
                      <p className="text-slate-500 text-sm mt-1 text-center md:text-left w-full">
                        @{pharmacist.users_permissions_user?.username || "-"}
                      </p>
                      
                      <div className="mt-4 w-full space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="truncate">{pharmacist.users_permissions_user?.phone || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                          </svg>
                          <span className="truncate">ใบอนุญาต: {pharmacist.license_number || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
                      {/* Working Hours */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          เวลาทำการ
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const storeWorkingTimes = Array.isArray(pharmacist.working_time) 
                              ? pharmacist.working_time.filter(wt => {
                                  return wt.store_id === storeId || (!wt.store_id && pharmacist.drug_stores?.length === 1);
                                })
                              : [];
                            
                            return storeWorkingTimes.length > 0 ? (
                              storeWorkingTimes.map((wt, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg text-sm">
                                  <span className="font-medium text-slate-700">{wt.day}</span>
                                  <span className="text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                                    {wt.time_in} - {wt.time_out}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-slate-400 italic bg-slate-50 px-3 py-2 rounded-lg">
                                ไม่ระบุเวลาทำการ
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Services */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          บริการ
                        </h4>
                        <div className="space-y-2">
                          {pharmacist.services?.sell_products && (
                            <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                              <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              <span>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</span>
                            </div>
                          )}
                          {pharmacist.services?.consulting && (
                            <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                              <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              <span>ให้คำปรึกษาทางเภสัชกรรม</span>
                            </div>
                          )}
                          {pharmacist.services?.wholesale && (
                            <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                              <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              <span>ขายปลีกและขายส่ง</span>
                            </div>
                          )}
                          {pharmacist.services?.delivery && (
                            <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                              <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              <span>บริการจัดส่งกล่องยาสามัญประจำบ้าน</span>
                            </div>
                          )}
                          {(!pharmacist.services || Object.values(pharmacist.services).every((v) => !v)) && (
                            <div className="text-sm text-slate-400 italic bg-slate-50 px-3 py-2 rounded-lg">
                              ไม่ระบุบริการ
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row md:flex-col gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-6 shrink-0 justify-end md:justify-start">
                      <button
                        onClick={() =>
                          navigate(`/edit_pharmacist_admin/${pharmacist.documentId}`, {
                            state: { fromStoreId: storeId }
                          })
                        }
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        แก้ไข
                      </button>
                      <button
                        onClick={() => handleDelete(pharmacist.documentId)}
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-600 px-4 py-2 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => {
              if (fromPage === "adminHome") {
                navigate("/adminHome");
              } else {
                navigate(`/drug_store_admin/${storeId}`);
              }
            }}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับไปหน้าก่อนหน้า
          </button>
        </div>
      </div>
    </div>
  );
}

export default PharmacistDetail_admin;