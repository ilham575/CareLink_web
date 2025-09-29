import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import HomeHeader from "../../components/HomeHeader";
import Footer from "../../components/footer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// 🟢 helper function ดึง URL รูปภาพ
function getImageUrl(photoAttr) {
  if (!photoAttr) return null;
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
          `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${storeId}&populate=*`,
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
          pharmacistRes = await fetch(
            `http://localhost:1337/api/pharmacy-profiles?filters[documentId][$eq]=${pharmacistId}&populate=*`,
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
        } else {
          pharmacistRes = await fetch(
            `http://localhost:1337/api/pharmacy-profiles?filters[drug_stores][documentId][$eq]=${storeId}&populate=*`,
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

  // ✅ ฟังก์ชันลบเภสัช
  const handleDelete = async (documentId) => {
    if (!window.confirm("คุณต้องการลบเภสัชกรคนนี้หรือไม่?")) return;

    try {
      // 1. ดึง pharmacy-profile ที่จะลบ
      const profileRes = await fetch(
        `http://localhost:1337/api/pharmacy-profiles?filters[documentId][$eq]=${documentId}&populate=users_permissions_user`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      const profileData = await profileRes.json();
      const profile = profileData.data?.[0];
      const pharmacyProfileId = profile?.documentId;
      const user =
        profile?.users_permissions_user?.id ||
        profile?.users_permissions_user?.data?.id ||
        null;

      // 2. ตัด relation user-permission ออกจาก pharmacy-profile
      if (pharmacyProfileId) {
        await fetch(
          `http://localhost:1337/api/pharmacy-profiles/${pharmacyProfileId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              data: { users_permissions_user: null },
            }),
          }
        );
      }

      // 3. ลบ pharmacy-profile
      if (pharmacyProfileId) {
        await fetch(
          `http://localhost:1337/api/pharmacy-profiles/${pharmacyProfileId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );
      }

      // 4. เช็กว่ามี pharmacy-profile อื่นที่ยังเชื่อม user-permission นี้อยู่ไหม
      if (user) {
        const checkRes = await fetch(
          `http://localhost:1337/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${user}`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        const checkData = await checkRes.json();
        const relatedProfiles = Array.isArray(checkData?.data) ? checkData.data : [];
        if (relatedProfiles.length === 0) {
          // 5. ถ้าไม่มี profile อื่น ลบ user-permission
          await fetch(
            `http://localhost:1337/api/users/${user}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } }
          );
        }
      }

      setPharmacists((prev) => prev.filter((p) => p.documentId !== documentId));
      toast.success("ลบเภสัชกรเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      toast.error("เกิดข้อผิดพลาดในการลบ");
    }
  };

  if (loading)
    return (
      <>
        <HomeHeader />
        <div className="p-6 text-center">กำลังโหลดข้อมูล...</div>
        <Footer />
        <ToastContainer />
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
        <Footer />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <HomeHeader pharmacyName={pharmacy.attributes?.name_th} />
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
                pharmacist.users_permissions_user?.id ||
                pharmacist.users_permissions_user?.data?.id ||
                null;

              return (
                <div
                  key={pharmacist.id}
                  className="border rounded-lg p-6 bg-gray-50 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center"
                >
                  <div className="flex-1 space-y-2 text-left">
                    {/* รูปโปรไฟล์ */}
                    {imgUrl && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={imgUrl.startsWith("/") ? `http://localhost:1337${imgUrl}` : imgUrl}
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
                        {Array.isArray(pharmacist.working_time) && pharmacist.working_time.length > 0 ? (
                          pharmacist.working_time.map((wt, idx) => (
                            <li key={idx}>
                              {wt.day} : {wt.time_in} - {wt.time_out}
                            </li>
                          ))
                        ) : (
                          <li>-</li>
                        )}
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
                        navigate(`/edit_pharmacist_admin/${pharmacist.documentId}`)
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
      <Footer />
      <ToastContainer />
    </>
  );
}

export default PharmacistDetail_admin;
