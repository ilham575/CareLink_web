import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../db"; // ✅ ใช้ IndexedDB

function PharmacistDetail_admin() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacists, setPharmacists] = useState([]);

  // ✅ โหลดข้อมูลร้าน + เภสัชกร
  useEffect(() => {
    const load = async () => {
      // ✅ pharmacy.id เป็น number → แปลง storeId เป็น Number
      const foundPharmacy = await db.pharmacies.get(Number(storeId));
      setPharmacy(foundPharmacy);

      // ✅ โหลดเภสัชทั้งหมด แล้ว filter เอาคนที่มี storeIds รวมร้านนี้อยู่
      const allPharmacists = await db.pharmacists.toArray();
      const foundPharmacists = allPharmacists.filter((p) =>
        p.storeIds?.includes(storeId) // storeId มาจาก useParams เป็น string → เก็บใน array ควรเก็บเป็น string เหมือนกัน
      );
      setPharmacists(foundPharmacists);
    };
    load();
  }, [storeId]);

  // ✅ ลบเภสัชกรออกจากร้านนี้ (ไม่ลบทั้ง record ถ้ายังอยู่ร้านอื่น)
  const handleDelete = async (id) => {
    if (window.confirm("คุณต้องการเอาเภสัชกรคนนี้ออกจากร้านนี้หรือไม่?")) {
      const pharmacist = await db.pharmacists.get(Number(id));
      if (!pharmacist) return;

      // ลบ storeId ปัจจุบันออกจาก storeIds
      const newStores = pharmacist.storeIds.filter((sid) => sid !== storeId);

      if (newStores.length === 0) {
        // ❌ ถ้าไม่เหลือร้าน → ลบ record ออกเลย
        await db.pharmacists.delete(pharmacist.id);
      } else {
        // ✅ ถ้ายังมีร้านอื่นอยู่ → update storeIds
        await db.pharmacists.update(pharmacist.id, { storeIds: newStores });
      }

      setPharmacists((prev) => prev.filter((p) => p.id !== id));
    }
  };

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
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-green-700 mb-4">
        เภสัชกรประจำร้าน {pharmacy.name_th}
      </h2>

      {pharmacists.length === 0 ? (
        <p className="text-center text-gray-500">
          ไม่พบข้อมูลเภสัชกรในร้านนี้
        </p>
      ) : (
        <div className="space-y-6">
          {pharmacists.map((pharmacist) => (
            <div
              key={pharmacist.id}
              className="border rounded-lg p-4 bg-gray-50 shadow-sm flex justify-between items-start"
            >
              {/* ✅ ข้อมูลเภสัชกร */}
              <div className="text-left">
                <p>
                  <span className="font-semibold">ชื่อ-นามสกุล:</span>{" "}
                  {pharmacist.firstname} {pharmacist.lastname}
                </p>
                <p>
                  <span className="font-semibold">เลขที่ใบอนุญาต:</span>{" "}
                  {pharmacist.license_number}
                </p>
                <p>
                  <span className="font-semibold">เวลาปฏิบัติงาน:</span>{" "}
                  {pharmacist.working_time}
                </p>
                <p>
                  <span className="font-semibold">เบอร์โทรศัพท์:</span>{" "}
                  {pharmacist.phone}
                </p>
                <p>
                  <span className="font-semibold">Username:</span>{" "}
                  {pharmacist.username}
                </p>
                <p>
                  <span className="font-semibold">Password:</span>{" "}
                  {pharmacist.password}
                </p>

                {/* ✅ แสดงบริการที่ติ๊ก */}
                <p className="font-semibold mt-2">การให้บริการ:</p>
                <ul className="list-disc ml-6">
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
                </ul>

        
              </div>

              {/* ✅ ปุ่มแก้ไข + ลบ */}
              <div className="flex flex-col gap-2 ml-4">
                <button
                  onClick={() =>
                    navigate(`/edit_pharmacist_admin/${pharmacist.id}`)
                  }
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => handleDelete(pharmacist.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  เอาออกจากร้านนี้
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ ปุ่มกลับ */}
      <div className="mt-6 text-center">
        <button
          onClick={() => navigate(`/drug_store_admin/${storeId}`)}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
        >
          กลับ
        </button>
      </div>
    </div>
  );
}

export default PharmacistDetail_admin;
