import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function PharmacistDetail_admin() {
  const { storeId } = useParams(); // documentId ของ drug-store
  const navigate = useNavigate();
  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacists, setPharmacists] = useState([]);
  const [loading, setLoading] = useState(true);

  const jwt = localStorage.getItem("jwt");

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!jwt) {
          alert("กรุณาเข้าสู่ระบบใหม่");
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
          alert("ไม่พบข้อมูลร้านยา");
          navigate(-1);
          return;
        }
        setPharmacy(store);

        // ✅ โหลดข้อมูลเภสัชกร (จาก pharmacy-profiles)
        const pharmacistRes = await fetch(
          `http://localhost:1337/api/pharmacy-profiles?filters[drug_store][documentId][$eq]=${storeId}&populate=users_permissions_user,drug_store`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        const pharmacistData = await pharmacistRes.json();

        setPharmacists(pharmacistData.data || []);
      } catch (err) {
        console.error("โหลดข้อมูลผิดพลาด:", err);
        alert("ไม่สามารถโหลดข้อมูลเภสัชกรได้");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [storeId, jwt, navigate]);

  // ✅ ฟังก์ชันลบเภสัช
  const handleDelete = async (id) => {
    if (!window.confirm("คุณต้องการลบเภสัชกรคนนี้หรือไม่?")) return;

    try {
      const res = await fetch(`http://localhost:1337/api/pharmacy-profiles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      });

      if (res.ok) {
        setPharmacists((prev) => prev.filter((p) => p.id !== id));
        alert("ลบเภสัชกรเรียบร้อยแล้ว");
      } else {
        const error = await res.json();
        console.error("❌ ลบไม่สำเร็จ:", error);
        alert("ลบไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  if (loading) return <div className="p-6 text-center">กำลังโหลดข้อมูล...</div>;

  if (!pharmacy) {
    return (
      <div className="p-6 text-center">
        <p>ไม่พบข้อมูลร้านยา</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          กลับ
        </button>
      </div>
    );
  }

  return (
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
      {/* {pharmacists.length === 0 ? (
        <p className="text-center text-gray-500">ไม่พบข้อมูลเภสัชกรในร้านนี้</p>
      ) : (
        <div className="space-y-6">
          {pharmacists.map((pharmacist) => (
            <div
              key={pharmacist.id}
              className="border rounded-lg p-4 bg-gray-50 shadow-sm flex justify-between items-start"
            >
              <div className="text-left">
                <p>
                  <span className="font-semibold">ชื่อ-นามสกุล:</span>{" "}
                  {pharmacist.attributes?.firstname} {pharmacist.attributes?.lastname}
                </p>
                <p>
                  <span className="font-semibold">เลขที่ใบอนุญาต:</span>{" "}
                  {pharmacist.attributes?.license_number}
                </p>
                <p>
                  <span className="font-semibold">เวลาปฏิบัติงาน:</span>{" "}
                  {pharmacist.attributes?.working_time}
                </p>
                <p>
                  <span className="font-semibold">เบอร์โทรศัพท์:</span>{" "}
                  {pharmacist.attributes?.phone}
                </p>
                <p>
                  <span className="font-semibold">Username:</span>{" "}
                  {pharmacist.attributes?.users_permissions_user?.data?.attributes?.username}
                </p>
                <p>
                  <span className="font-semibold">ร้านที่สังกัด:</span>{" "}
                  {pharmacist.attributes?.drug_store?.data?.attributes?.name_th}
                </p>

                <p className="font-semibold mt-2">การให้บริการ:</p>
                <ul className="list-disc ml-6">
                  {pharmacist.attributes?.services?.sell_products && (
                    <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>
                  )}
                  {pharmacist.attributes?.services?.consulting && (
                    <li>ให้คำปรึกษาทางเภสัชกรรม</li>
                  )}
                  {pharmacist.attributes?.services?.wholesale && (
                    <li>ขายปลีกและขายส่ง</li>
                  )}
                  {pharmacist.attributes?.services?.delivery && (
                    <li>บริการจัดส่งกล่องยาสามัญประจำบ้าน</li>
                  )}
                </ul>
              </div>

              <div className="flex flex-col gap-2 ml-4">
                <button
                  onClick={() => navigate(`/edit_pharmacist_admin/${pharmacist.id}`)}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => handleDelete(pharmacist.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )} */}

      {/* ปุ่มกลับ
      <div className="mt-6 text-center">
        <button
          onClick={() => navigate(`/drug_store_admin/${storeId}`)}
          className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
        >
          กลับ
        </button>
      </div> */}
    </div>
  );
}

export default PharmacistDetail_admin;