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
    <>
      <HomeHeader pharmacyName={pharmacy.attributes?.name_th || pharmacy.name_th} />
      <div className="max-w-5xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
        {/* หัวข้อ */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-green-700">
            เภสัชกรประจำร้าน {pharmacy.attributes?.name_th}
          </h2>
          <button
            onClick={() => navigate(`/add_pharmacy_admin/${storeId}`)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + เพิ่มเภสัชกร
          </button>
        </div>

        {/* รายการเภสัชกร */}
        {pharmacists.length === 0 ? (
          <p className="text-center text-gray-500">ไม่พบข้อมูลเภสัชกรในร้านนี้</p>
        ) : (
          <div className="space-y-6">
            {pharmacists.map((pharmacist) => {
              const imgUrl = pharmacist.profileimage?.data?.attributes
                ? getImageUrl(pharmacist.profileimage.data.attributes)
                : null;
              const userId =
                pharmacist.users_permissions_user?.documentId ||
                pharmacist.users_permissions_user?.data?.documentId ||
                null;

              return (
                <div
                  key={pharmacist.documentId}
                  className="border rounded-lg p-6 bg-gray-50 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center"
                >
                  <div className="flex-1 space-y-2 text-left">
                    {/* รูปโปรไฟล์ */}
                    {imgUrl && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={imgUrl}
                          alt="pharmacist"
                          className="w-24 h-24 object-cover rounded-full border"
                        />
                      </div>
                    )}

                    <div>
                      <span className="font-semibold">ชื่อ-นามสกุล:</span>{" "}
                      {pharmacist.users_permissions_user?.full_name || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">USERNAME:</span>{" "}
                      {pharmacist.users_permissions_user?.username || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">เบอร์โทรศัพท์:</span>{" "}
                      {pharmacist.users_permissions_user?.phone || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">เลขที่ใบอนุญาต:</span>{" "}
                      {pharmacist.license_number || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">วันและเวลาเข้างาน:</span>
                      <ul className="ml-6 list-disc space-y-1">
                        {(() => {
                          // กรองเวลาทำงานเฉพาะของร้านนี้
                          const storeWorkingTimes = Array.isArray(pharmacist.working_time) 
                            ? pharmacist.working_time.filter(wt => {
                                const isMatch = wt.store_id === storeId || (!wt.store_id && pharmacist.drug_stores?.length === 1);
                                console.log(`🔍 Detail: wt.day: ${wt.day}, wt.store_id: ${wt.store_id}, storeId: ${storeId}, isMatch: ${isMatch}`);
                                return isMatch;
                              })
                            : [];
                          
                          console.log(`🔍 Detail: All working times:`, pharmacist.working_time);
                          console.log(`🔍 Detail: filtered working times for store ${storeId}:`, storeWorkingTimes);
                          
                          return storeWorkingTimes.length > 0 ? (
                            storeWorkingTimes.map((wt, idx) => (
                              <li key={idx}>
                                {wt.day} : {wt.time_in} - {wt.time_out}
                              </li>
                            ))
                          ) : (
                            <li>-</li>
                          );
                        })()}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold">การให้บริการ:</span>
                      <ul className="list-disc ml-6 mt-1 space-y-1">
                        {pharmacist.services?.sell_products && (
                          <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>
                        )}
                        {pharmacist.services?.consulting && (
                          <li>ให้คำปรึกษาทางเภสัชกรรม</li>
                        )}
                        {pharmacist.services?.wholesale && (
                          <li>ขายปลีกและขายส่ง</li>
                        )}
                        {pharmacist.services?.delivery && (
                          <li>บริการจัดส่งกล่องยาสามัญประจำบ้าน</li>
                        )}
                        {!pharmacist.services ||
                        Object.values(pharmacist.services).every((v) => !v) ? (
                          <li>-</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>

                  {/* ปุ่มจัดการ */}
                  <div className="flex flex-row md:flex-col gap-2 mt-4 md:mt-0 ml-0 md:ml-4">
                    <button
                      onClick={() =>
                        navigate(`/edit_pharmacist_admin/${pharmacist.documentId}`, {
                          state: { fromStoreId: storeId }
                        })
                      }
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(pharmacist.documentId)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ปุ่มกลับ */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              if (fromPage === "adminHome") {
                navigate("/adminHome");
              } else {
                navigate(`/drug_store_admin/${storeId}`);
              }
            }}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
          >
            กลับ
          </button>
        </div>
      </div>
      {/* Global ToastContainer in App.js will render toasts */}
    </>
  );
}

export default PharmacistDetail_admin;